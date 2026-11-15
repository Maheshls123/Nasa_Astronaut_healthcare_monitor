"""
ASTRA - Autonomous Spaceflight Telemetry, Risk Analytics & Emergency Response
Cybersecurity, RBAC, Encryption (AES-256-GCM), and Tamper-Evident Audit Logging
"""

import os
import sys
import hashlib
import json
import base64
from datetime import datetime, timezone

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from backend.database import get_connection

# Generate or load persistent onboard master encryption key
# In actual flight deployment, key is stored in hardware TPM / secure enclave.
SECRET_KEY_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", ".master_key")

def get_or_create_master_key():
    os.makedirs(os.path.dirname(SECRET_KEY_PATH), exist_ok=True)
    if os.path.exists(SECRET_KEY_PATH):
        with open(SECRET_KEY_PATH, "rb") as f:
            return f.read()
    else:
        # 256-bit AES key
        key = AESGCM.generate_key(bit_length=256)
        with open(SECRET_KEY_PATH, "wb") as f:
            f.write(key)
        return key

MASTER_KEY = get_or_create_master_key()

# Role Hierarchy and Permissions
ROLES = {
    "ASTRONAUT": {
        "description": "Active crew member with access to personal vitals, self-reporting, and emergency procedures",
        "permissions": ["view_own_vitals", "submit_cognitive_test", "view_checklists", "trigger_emergency"]
    },
    "FLIGHT_SURGEON": {
        "description": "Aerospace Medical Officer with comprehensive medical authority and mental health access",
        "permissions": ["view_all_vitals", "view_mental_health", "override_ai", "prescribe_inventory", "acknowledge_emergency", "resolve_emergency", "edit_baselines"]
    },
    "MISSION_CONTROL": {
        "description": "Ground or Flight Dynamics console overseeing mission status and environmental metrics",
        "permissions": ["view_all_vitals", "view_environmental", "view_sync_status", "export_telemetry"]
    },
    "MEDICAL_ADMIN": {
        "description": "Medical Logistics officer managing drug formulary, equipment calibration, and resupply",
        "permissions": ["manage_inventory", "inspect_medical_kits", "record_usage", "view_audit_logs"]
    },
    "SYSTEM_ADMIN": {
        "description": "Autonomous Systems Engineer managing encryption, database health, and system diagnostics",
        "permissions": ["manage_system", "manage_sensors", "view_audit_logs", "verify_integrity", "purge_non_critical"]
    }
}

def encrypt_payload(data: dict) -> str:
    """Encrypts JSON data using AES-256-GCM. Returns base64-encoded string."""
    aesgcm = AESGCM(MASTER_KEY)
    nonce = os.urandom(12) # 96-bit nonce
    plaintext = json.dumps(data).encode("utf-8")
    ciphertext = aesgcm.encrypt(nonce, plaintext, None)
    # Pack nonce + ciphertext
    packed = nonce + ciphertext
    return base64.b64encode(packed).decode("utf-8")

def decrypt_payload(token: str) -> dict:
    """Decrypts base64-encoded AES-256-GCM ciphertext back into dict."""
    packed = base64.b64decode(token.encode("utf-8"))
    nonce = packed[:12]
    ciphertext = packed[12:]
    aesgcm = AESGCM(MASTER_KEY)
    plaintext = aesgcm.decrypt(nonce, ciphertext, None)
    return json.loads(plaintext.decode("utf-8"))

def append_audit_log(user_id: str, role: str, action: str, details: str) -> dict:
    """
    Appends a new entry to the tamper-evident audit log using SHA-256 hash chaining.
    Every log includes the SHA-256 hash of the previous record.
    """
    conn = get_connection()
    cursor = conn.cursor()

    # Retrieve latest log's hash
    cursor.execute("SELECT hash FROM audit_logs ORDER BY id DESC LIMIT 1;")
    row = cursor.fetchone()
    prev_hash = row[0] if row else "0" * 64

    timestamp = datetime.now(timezone.utc).isoformat()
    # Compute SHA-256 digest
    raw_str = f"{prev_hash}|{timestamp}|{user_id}|{role}|{action}|{details}"
    curr_hash = hashlib.sha256(raw_str.encode("utf-8")).hexdigest()

    cursor.execute("""
    INSERT INTO audit_logs (timestamp, user_id, role, action, details, prev_hash, hash)
    VALUES (?, ?, ?, ?, ?, ?, ?);
    """, (timestamp, user_id, role, action, details, prev_hash, curr_hash))

    conn.commit()
    conn.close()

    return {
        "timestamp": timestamp,
        "user_id": user_id,
        "role": role,
        "action": action,
        "details": details,
        "prev_hash": prev_hash,
        "hash": curr_hash
    }

def verify_audit_log_integrity() -> dict:
    """
    Cryptographically verifies the entire SHA-256 hash chain in audit_logs.
    Detects any tampering, deletion, or modification of historical records.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, timestamp, user_id, role, action, details, prev_hash, hash FROM audit_logs ORDER BY id ASC;")
    rows = cursor.fetchall()
    conn.close()

    expected_prev = "0" * 64
    for idx, row in enumerate(rows):
        log_id, ts, uid, role, act, det, phash, h = row
        if phash != expected_prev:
            return {
                "valid": False,
                "corrupted_id": log_id,
                "reason": f"Hash chain broken at ID {log_id}. Previous hash mismatch."
            }
        # Recompute hash
        raw_str = f"{phash}|{ts}|{uid}|{role}|{act}|{det}"
        computed = hashlib.sha256(raw_str.encode("utf-8")).hexdigest()

        if computed != h:
            return {
                "valid": False,
                "corrupted_id": log_id,
                "reason": f"Tampering detected at ID {log_id}. Computed digest does not match recorded hash."
            }
        expected_prev = h

    return {
        "valid": True,
        "total_records_verified": len(rows),
        "chain_head": expected_prev
    }

if __name__ == "__main__":
    log = append_audit_log("SYS_TEST", "SYSTEM_ADMIN", "DIAGNOSTIC_CHECK", "Verification of cryptographic subsystem.")
    print("Audit Log Appended:", log["hash"][:16])
    integ = verify_audit_log_integrity()
    print("Audit Chain Integrity:", integ)
    encrypted = encrypt_payload({"patient": "ASTRA-01", "vitals": "classified"})
    print("Encrypted payload sample:", encrypted[:32] + "...")
    decrypted = decrypt_payload(encrypted)
    print("Decrypted payload:", decrypted)
