"""
ASTRA - Autonomous Spaceflight Telemetry, Risk Analytics & Emergency Response
Autonomous Emergency Response Engine & Interactive Medical Checklists
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
from backend.security import append_audit_log

logger = logging.getLogger("ASTRA.EmergencyEngine")

PROCEDURES_FILE = os.path.join(PROJECT_ROOT, "data", "medical_procedures", "procedures.json")

class EmergencyManager:
    """
    Supervises clinical triage, emergency activation, checklist progression,
    and incident timeline logging.
    """
    def __init__(self):
        self.procedures: Dict[str, Dict[str, Any]] = {}
        self.load_procedures()

    def load_procedures(self):
        try:
            if os.path.exists(PROCEDURES_FILE):
                with open(PROCEDURES_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for proc in data.get("procedures", []):
                        self.procedures[proc["id"]] = proc
                logger.info(f"Loaded {len(self.procedures)} clinical emergency procedures.")
        except Exception as e:
            logger.error(f"Failed to load clinical procedures: {e}")

    def get_all_procedures(self) -> List[Dict[str, Any]]:
        return list(self.procedures.values())

    def get_procedure(self, proc_id: str) -> Optional[Dict[str, Any]]:
        return self.procedures.get(proc_id)

    def trigger_emergency(self, astronaut_id: str, code: str, title: str, severity: str, checklist_id: str, triggered_by="AI_AUTONOMOUS_SYSTEM", notes="") -> Dict[str, Any]:
        """
        Activates an emergency state. Records incident in database and audit log.
        """
        conn = get_connection()
        cursor = conn.cursor()

        emergency_id = f"EMERG-{astronaut_id}-{int(datetime.now().timestamp())}"
        started_at = datetime.now(timezone.utc).isoformat()

        cursor.execute("""
        INSERT INTO emergencies (id, astronaut_id, started_at, severity, code, title, checklist_id, completed_steps, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, '[]', 'ACTIVE', ?);
        """, (emergency_id, astronaut_id, started_at, severity, code, title, checklist_id, notes))

        # Update astronaut status
        cursor.execute("UPDATE astronauts SET status = ? WHERE id = ?;", (severity, astronaut_id))

        conn.commit()
        conn.close()

        append_audit_log(triggered_by, "EMERGENCY_SYSTEM", "EMERGENCY_DECLARED",
                         f"Code: {code} | Title: {title} | Severity: {severity} | Astro: {astronaut_id}")

        logger.warning(f"EMERGENCY DECLARED: [{severity}] {code} - {title} for astronaut {astronaut_id}")

        return {
            "id": emergency_id,
            "astronaut_id": astronaut_id,
            "started_at": started_at,
            "severity": severity,
            "code": code,
            "title": title,
            "checklist_id": checklist_id,
            "completed_steps": [],
            "status": "ACTIVE",
            "notes": notes
        }

    def acknowledge_emergency(self, emergency_id: str, user_id: str, role: str) -> bool:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE emergencies SET status = 'ACKNOWLEDGED' WHERE id = ? AND status = 'ACTIVE';", (emergency_id,))
        success = cursor.rowcount > 0
        conn.commit()
        conn.close()

        if success:
            append_audit_log(user_id, role, "EMERGENCY_ACKNOWLEDGED", f"Emergency ID: {emergency_id}")
        return success

    def update_checklist_step(self, emergency_id: str, step_id: int, user_id: str, role: str) -> Dict[str, Any]:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT completed_steps, status, checklist_id FROM emergencies WHERE id = ?;", (emergency_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            return {"error": "Emergency not found"}

        completed = json.loads(row["completed_steps"])
        if row["status"] == "RESOLVED":
            conn.close()
            return {"error": "Cannot update a resolved incident."}

        procedure = self.get_procedure(row["checklist_id"])
        valid_steps = {step.get("step_id") for step in (procedure or {}).get("steps", [])}
        if not isinstance(step_id, int) or isinstance(step_id, bool) or step_id not in valid_steps:
            conn.close()
            return {"error": "Checklist step is not defined for this incident."}

        if step_id not in completed:
            completed.append(step_id)

        cursor.execute("UPDATE emergencies SET completed_steps = ? WHERE id = ?;", (json.dumps(completed), emergency_id))
        conn.commit()
        conn.close()

        append_audit_log(user_id, role, "CHECKLIST_STEP_COMPLETED", f"Emergency: {emergency_id} | Step: {step_id}")
        return {"emergency_id": emergency_id, "completed_steps": completed}

    def resolve_emergency(self, emergency_id: str, user_id: str, role: str, resolution_notes: str) -> bool:
        now_iso = datetime.now(timezone.utc).isoformat()
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT astronaut_id, status FROM emergencies WHERE id = ?;", (emergency_id,))
        row = cursor.fetchone()
        if not row or row["status"] == "RESOLVED":
            conn.close()
            return False
        astro_id = row["astronaut_id"]

        cursor.execute("""
        UPDATE emergencies SET status = 'RESOLVED', resolved_at = ?, notes = notes || ' | ' || ?
        WHERE id = ? AND status != 'RESOLVED';
        """, (now_iso, resolution_notes, emergency_id))
        if cursor.rowcount == 0:
            conn.close()
            return False

        # Check if any other active emergencies exist for this astronaut
        cursor.execute("SELECT COUNT(*) FROM emergencies WHERE astronaut_id = ? AND status != 'RESOLVED';", (astro_id,))
        count = cursor.fetchone()[0]
        if count == 0:
            cursor.execute("UPDATE astronauts SET status = 'NORMAL' WHERE id = ?;", (astro_id,))

        conn.commit()
        conn.close()

        append_audit_log(user_id, role, "EMERGENCY_RESOLVED", f"Emergency: {emergency_id} | Notes: {resolution_notes}")
        return True

    def get_active_emergencies(self) -> List[Dict[str, Any]]:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
        SELECT e.id, e.astronaut_id, a.name, e.started_at, e.severity, e.code, e.title,
               e.checklist_id, e.completed_steps, e.status, e.notes
        FROM emergencies e
        JOIN astronauts a ON e.astronaut_id = a.id
        WHERE e.status != 'RESOLVED'
        ORDER BY e.started_at DESC;
        """)
        rows = cursor.fetchall()
        conn.close()

        results = []
        for r in rows:
            results.append({
                "id": r[0],
                "astronaut_id": r[1],
                "astronaut_name": r[2],
                "started_at": r[3],
                "severity": r[4],
                "code": r[5],
                "title": r[6],
                "checklist_id": r[7],
                "completed_steps": json.loads(r[8]),
                "status": r[9],
                "notes": r[10]
            })
        return results

emergency_manager = EmergencyManager()

if __name__ == "__main__":
    print("Testing Emergency Manager...")
    procs = emergency_manager.get_all_procedures()
    print(f"Procedures loaded: {len(procs)}")
    emerg = emergency_manager.trigger_emergency("ASTRA-01", "EMERG-CARD-01", "Microgravity Cardiac Arrest", "CRITICAL", "PROC-CARD-01")
    print(f"Triggered emergency: {emerg['id']} for {emerg['astronaut_id']}")
    emergency_manager.update_checklist_step(emerg["id"], 1, "SURGEON_01", "FLIGHT_SURGEON")
    actives = emergency_manager.get_active_emergencies()
    print(f"Active emergencies count: {len(actives)}")
    emergency_manager.resolve_emergency(emerg["id"], "SURGEON_01", "FLIGHT_SURGEON", "Rhythm restored, patient stabilized on CMRS.")
    print("Emergency resolved.")
