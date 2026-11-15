"""
ASTRA - Autonomous Spaceflight Telemetry, Risk Analytics & Emergency Response
Store-and-Forward Offline Synchronization Layer
Priority Queue (Critical > Warning > Routine), AES-256-GCM Payload Encryption,
Deduplication & Conflict Resolution.
"""

import os
import sys
import json
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.database import get_connection
from backend.security import encrypt_payload, decrypt_payload, append_audit_log

logger = logging.getLogger("ASTRA.SyncEngine")

class SyncEngine:
    def __init__(self):
        self.connection_state = "OFFLINE" # ONLINE | OFFLINE | SYNCING
        self.last_sync_timestamp: Optional[str] = None
        self.simulated_uplink_speed_kbps = 64 # Deep Space Network constraint

    def set_connection_state(self, state: str):
        if state in ["ONLINE", "OFFLINE", "SYNCING"]:
            self.connection_state = state
            logger.info(f"Spacecraft DSN uplink connection state: {state}")

    def enqueue_event(self, event_id: str, payload_type: str, raw_payload: dict, priority: int = 3) -> bool:
        """
        Enqueues an event into the persistent store-and-forward SQLite queue.
        Prevents duplicates by checking existing event_id.
        Payload is encrypted using AES-256-GCM before storage.
        """
        conn = get_connection()
        cursor = conn.cursor()

        # Check for duplicate
        cursor.execute("SELECT event_id FROM sync_queue WHERE event_id = ?;", (event_id,))
        if cursor.fetchone():
            conn.close()
            logger.info(f"Event {event_id} already exists in sync queue. Skipping duplicate.")
            return False

        encrypted_payload = encrypt_payload(raw_payload)
        now_iso = datetime.now(timezone.utc).isoformat()

        cursor.execute("""
        INSERT INTO sync_queue (event_id, timestamp, priority, payload_type, encrypted_payload, status, retry_count)
        VALUES (?, ?, ?, ?, ?, 'PENDING', 0);
        """, (event_id, now_iso, priority, payload_type, encrypted_payload))

        conn.commit()
        conn.close()
        return True

    def get_sync_status(self) -> Dict[str, Any]:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM sync_queue WHERE status = 'PENDING';")
        pending_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM sync_queue WHERE status = 'SYNCED';")
        synced_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM sync_queue WHERE status = 'FAILED';")
        failed_count = cursor.fetchone()[0]

        # Calculate database file size for storage health
        db_path = os.path.join(PROJECT_ROOT, "data", "astra.db")
        db_size_kb = round(os.path.getsize(db_path) / 1024.0, 1) if os.path.exists(db_path) else 0.0

        conn.close()

        storage_status = "HEALTHY"
        if db_size_kb > 500000: # 500 MB
            storage_status = "WARNING_CAPACITY_HIGH"

        return {
            "connection_state": self.connection_state,
            "last_sync_timestamp": self.last_sync_timestamp or "Never (Autonomous Flight)",
            "pending_count": pending_count,
            "synced_count": synced_count,
            "failed_count": failed_count,
            "storage_health": storage_status,
            "storage_size_kb": db_size_kb,
            "uplink_rate_kbps": self.simulated_uplink_speed_kbps
        }

    def process_sync_batch(self, batch_size: int = 50) -> Dict[str, Any]:
        """
        Executes store-and-forward batch transmission when connection is ONLINE.
        Orders by Priority ASC (1=Critical, 2=Warning, 3=Routine), then Timestamp ASC.
        """
        if self.connection_state == "OFFLINE":
            return {"status": "ABORTED", "reason": "Earth communication uplink is offline."}

        self.set_connection_state("SYNCING")
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
        SELECT event_id, priority, payload_type, encrypted_payload, retry_count
        FROM sync_queue
        WHERE status = 'PENDING'
        ORDER BY priority ASC, timestamp ASC
        LIMIT ?;
        """, (batch_size,))
        rows = cursor.fetchall()

        synced_ids = []
        now_iso = datetime.now(timezone.utc).isoformat()

        for r in rows:
            event_id, prio, ptype, enc_load, retries = r
            try:
                # In actual deep space flight, transmission packet is sent via DSN protocol
                # Decrypt locally to verify cryptographic integrity before forwarding
                payload = decrypt_payload(enc_load)
                synced_ids.append(event_id)
                cursor.execute("""
                UPDATE sync_queue SET status = 'SYNCED', last_attempt = ?
                WHERE event_id = ?;
                """, (now_iso, event_id))
            except Exception as e:
                logger.error(f"Sync failed for event {event_id}: {e}")
                cursor.execute("""
                UPDATE sync_queue SET status = 'FAILED', retry_count = retry_count + 1, last_attempt = ?
                WHERE event_id = ?;
                """, (now_iso, event_id))

        conn.commit()
        conn.close()

        self.last_sync_timestamp = now_iso
        self.set_connection_state("ONLINE")

        append_audit_log("SYNC_SUBSYSTEM", "COMM_GATEWAY", "BATCH_SYNCHRONIZATION_COMPLETE",
                         f"Synced {len(synced_ids)} telemetry/emergency packets to Mission Control.")

        return {
            "status": "COMPLETED",
            "synced_count": len(synced_ids),
            "synced_ids": synced_ids,
            "timestamp": now_iso
        }

sync_engine = SyncEngine()

if __name__ == "__main__":
    print("Testing Synchronization Engine...")
    sync_engine.enqueue_event("EVT-TEST-001", "CRITICAL_VITALS", {"hr": 145, "spo2": 87}, priority=1)
    status = sync_engine.get_sync_status()
    print("Sync Status (Offline):", status)
    sync_engine.set_connection_state("ONLINE")
    res = sync_engine.process_sync_batch()
    print("Sync Process Result:", res)
    print("Sync Status (Post-Sync):", sync_engine.get_sync_status())
