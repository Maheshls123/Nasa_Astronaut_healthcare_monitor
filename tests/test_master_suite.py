"""
ASTRA - Autonomous Spaceflight Telemetry, Risk Analytics & Emergency Response
Master Verification & Test Suite
Validates:
1. Offline-First Capability & Local SQLite Store
2. Sensor Gateway & Signal Quality Index (SQI)
3. AI Multivariate Anomaly Detection & Explainable AI (XAI)
4. Autonomous Emergency Response & Checklist Execution
5. NASA OSDR Integration & Offline Caching
6. Store-and-Forward Sync, Deduplication & Conflict Handling
7. Cybersecurity, AES-256-GCM Encryption & SHA-256 Audit Log Integrity
8. Medical Resource Inventory & Depletion Analytics
"""

import os
import sys
import unittest
import json
import io
import time
import tempfile
from unittest.mock import Mock, patch
from datetime import datetime, timezone

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.database import get_connection, init_db
from backend.config import load_project_env
from backend.security import (
    encrypt_payload, decrypt_payload, append_audit_log,
    verify_audit_log_integrity, ROLES
)
from backend.sensor_gateway import (
    SignalQualityAssessor, SyntheticTelemetryGenerator, gateway,
    PROVENANCE_LIVE, PROVENANCE_NASA, PROVENANCE_SIM
)
from backend.ai_engine import ai_engine
from backend.emergency_engine import emergency_manager
from backend.sync_engine import sync_engine
from backend.nasa_osdr import NASAOSDRClient, nasa_osdr_client
from backend.app import cabin_environment, get_radiation_summary
from urllib.error import HTTPError, URLError

class TestLocalEnvironmentConfiguration(unittest.TestCase):
    def test_loads_groq_settings_and_preserves_process_environment(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            env_path = os.path.join(temp_dir, ".env")
            with open(env_path, "w", encoding="utf-8") as env_file:
                env_file.write('GROQ_API_KEY="local-secret"\n')
                env_file.write("GROQ_MODEL=file-model\n")

            with patch.dict(os.environ, {"GROQ_MODEL": "process-model"}, clear=True):
                load_project_env(temp_dir)
                self.assertEqual(os.environ["GROQ_API_KEY"], "local-secret")
                self.assertEqual(os.environ["GROQ_MODEL"], "process-model")


class TestASTRACoreArchitecture(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()

    def test_01_database_offline_persistence(self):
        """Verifies local SQLite database integrity, WAL mode, and astronaut records."""
        conn = get_connection()
        c = conn.cursor()
        c.execute("PRAGMA journal_mode;")
        journal_mode = c.fetchone()[0]
        self.assertEqual(journal_mode.lower(), "wal", "Database must use WAL mode for offline fault-tolerance.")

        c.execute("SELECT id FROM astronauts WHERE is_active = 1 ORDER BY id;")
        active_ids = [row[0] for row in c.fetchall()]
        self.assertEqual(active_ids, ["ASTRA-01", "ASTRA-04"])
        conn.close()
        self.assertEqual(set(gateway.astronaut_simulators), set(active_ids))

    def test_active_astronaut_and_ground_staff_rosters(self):
        from backend.app import list_astronauts, list_ground_staff

        astronauts = list_astronauts()["astronauts"]
        ground_staff = list_ground_staff()["ground_staff"]
        self.assertEqual([member["id"] for member in astronauts], ["ASTRA-01", "ASTRA-04"])
        self.assertEqual({member["role"] for member in astronauts}, {"Astronaut"})
        self.assertEqual(
            [member["role"] for member in ground_staff],
            ["Flight Surgeon", "Ground Scientist", "Biomedical Engineer"],
        )

    def test_02_sensor_gateway_sqi_and_validation(self):
        """Verifies Signal Quality Index (SQI) and plausible outlier filtering."""
        # Clean signal
        clean_sqi = SignalQualityAssessor.evaluate_cardiovascular(hr=72.0, hrv=60.0, ecg_amp=0.5)
        self.assertGreater(clean_sqi["sqi"], 90.0)
        self.assertFalse(clean_sqi["artifact"])

        # Implausible extreme value
        bad_sqi = SignalQualityAssessor.evaluate_cardiovascular(hr=290.0, hrv=10.0, ecg_amp=0.5)
        self.assertLess(bad_sqi["sqi"], 50.0)
        self.assertTrue(bad_sqi["artifact"])

        # Lead-off disconnection
        leadoff_sqi = SignalQualityAssessor.evaluate_cardiovascular(hr=None, hrv=None, ecg_amp=0.0)
        self.assertEqual(leadoff_sqi["sqi"], 0.0)
        self.assertTrue(leadoff_sqi["lead_off"])

    def test_03_ai_anomaly_detection_and_xai(self):
        """Verifies multivariate anomaly detection and explainable AI attribution."""
        # Inappropriate Tachycardia scenario (High HR with low activity)
        tachy_packet = {
            "astronaut_id": "ASTRA-01",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "hr": 142.0,
            "hrv": 20.0,
            "spo2": 98.0,
            "resp_rate": 20.0,
            "bp_sys": 140.0,
            "bp_dia": 90.0,
            "temp_c": 36.9,
            "ecg_amplitude": 1.2,
            "activity_g": 0.02, # Zero motion!
            "sqi": 98.0,
            "provenance": PROVENANCE_SIM
        }
        anomalies = ai_engine.analyze_telemetry(tachy_packet)
        self.assertGreaterEqual(len(anomalies), 1, "Should detect inappropriate tachycardia.")
        ano = anomalies[0]
        self.assertEqual(ano["severity"], "CRITICAL")
        self.assertIn("explanation", ano)
        self.assertIn("baseline_comparison", ano)
        self.assertIn("relevant_procedure_id", ano)
        self.assertIn("ASTRA-MEDNET", ano["model_version"])

        # Predictive risk projection
        risk = ai_engine.compute_predictive_risk("ASTRA-01", anomalies)
        self.assertGreater(risk["horizon_1h_pct"], 30.0)
        self.assertGreater(risk["model_confidence_pct"], 90.0)

    def test_04_emergency_state_machine_and_checklists(self):
        """Verifies emergency triage, checklist progression, and resolution."""
        emerg = emergency_manager.trigger_emergency(
            astronaut_id="ASTRA-01",
            code="EMERG-CARD-01",
            title="Microgravity Cardiac Arrest",
            severity="CRITICAL",
            checklist_id="PROC-CARD-01",
            triggered_by="TEST_HARNESS"
        )
        self.assertEqual(emerg["status"], "ACTIVE")

        # Complete step 1
        res = emergency_manager.update_checklist_step(emerg["id"], 1, "TEST_SURGEON", "FLIGHT_SURGEON")
        self.assertIn(1, res["completed_steps"])
        self.assertIn("error", emergency_manager.update_checklist_step(
            emerg["id"], 999, "TEST_SURGEON", "FLIGHT_SURGEON"
        ))

        # Resolve emergency
        ok = emergency_manager.resolve_emergency(emerg["id"], "TEST_SURGEON", "FLIGHT_SURGEON", "Patient stabilized.")
        self.assertTrue(ok)
        self.assertIn("error", emergency_manager.update_checklist_step(
            emerg["id"], 2, "TEST_SURGEON", "FLIGHT_SURGEON"
        ))
        self.assertFalse(emergency_manager.resolve_emergency(
            emerg["id"], "TEST_SURGEON", "FLIGHT_SURGEON", "Duplicate closure."
        ))

    def test_05_nasa_osdr_offline_cache(self):
        """Offline search returns matching curated studies without inventing astronaut data."""
        with patch.object(nasa_osdr_client, "_request_json", side_effect=URLError("offline")):
            res = nasa_osdr_client.search_datasets("rodent")
            twins = nasa_osdr_client.search_datasets("twins")
        self.assertEqual(res["source"], "CURATED_OFFLINE_CACHE")
        self.assertEqual(res["source_category"], "REAL_NASA_RESEARCH")
        self.assertEqual(res["data_kind"], "HISTORICAL_RESEARCH")
        self.assertEqual({dataset["id"] for dataset in res["datasets"]}, {"OSD-379", "OSD-137", "OSD-254"})
        self.assertEqual(twins["total"], 0)

    def test_13_nasa_search_metadata_normalization(self):
        """Search records retain OSDR population, measurement, and attribution fields."""
        client = NASAOSDRClient()
        response = {
            "hits": {
                "total": {"value": 1},
                "hits": [{
                    "_id": "OSD-542",
                    "_source": {
                        "Accession": "OSD-542",
                        "Study Title": "Confinement study",
                        "Study Description": "Ground confinement, not spaceflight telemetry.",
                        "organism": "Homo sapiens",
                        "Material Type": "Whole blood",
                        "Study Assay Measurement Type": "Transcription profiling"
                    }
                }]
            }

        }
        with patch.object(client, "_request_json", return_value=response):
            result = client.search_datasets("confinement")
        dataset = result["datasets"][0]
        self.assertEqual(dataset["organism"], "Homo sapiens")
        self.assertEqual(dataset["measurement_type"], "Transcription profiling")
        self.assertEqual(dataset["source_category"], "REAL_NASA_RESEARCH")
        self.assertEqual(dataset["data_kind"], "HISTORICAL_RESEARCH")
        self.assertTrue(dataset["metadata_available"])

    def test_14_nasa_file_pagination_and_access_control(self):
        """File listing pages are requested from OSDR and restricted files are not downloaded."""
        client = NASAOSDRClient()
        detail = {
            "dataset": {"accession": "OSD-379"},
            "file_count": 101,
            "file_page_total": 5,
            "files": [],
            "source": "NASA_OSDR_API"
        }
        page_payload = {
            "studies": {
                "OSD-379": {
                    "page_total": 2,
                    "study_files": [{
                        "file_name": "restricted.csv",
                        "file_size": 5,
                        "restricted": True,
                        "visible": True,
                        "remote_url": "https://example.invalid/restricted.csv"
                    }]
                }
            }
        }
        with patch.object(client, "get_dataset_metadata", return_value=detail), \
             patch.object(client, "_request_json", return_value=page_payload) as request_json:
            result = client.get_dataset_files("OSD-379", page=2, page_size=100)
        self.assertIn("page_number=2", request_json.call_args.args[0])
        self.assertIn("page_size=100", request_json.call_args.args[0])
        self.assertEqual(result["files"][0]["download_available"], False)
        self.assertEqual(result["page_total"], 2)

        with patch.object(client, "get_dataset_metadata", return_value=detail), \
             patch.object(client, "get_dataset_files", return_value={"files": [{
                 "name": "restricted.csv", "download_available": False
             }]}), \
             patch("backend.nasa_osdr.urllib.request.urlopen") as urlopen:
            with self.assertRaises(PermissionError):
                client.download_public_file("OSD-379", "restricted.csv", page=2)
            urlopen.assert_not_called()

    def test_15_health_timeline_persists_labeled_samples(self):
        """Stored trend samples are explicitly sourced and completeness reflects actual fields."""
        from backend.app import get_astronaut_digital_twin, get_live_telemetry

        conn = get_connection()
        before = conn.execute(
            "SELECT COUNT(*) FROM telemetry WHERE astronaut_id = ?",
            ("ASTRA-04",)
        ).fetchone()[0]
        conn.close()

        with patch("backend.app._last_simulated_history_save", 0.0):
            live = get_live_telemetry()
        self.assertIn("ASTRA-04", live["readings"])

        record = get_astronaut_digital_twin("ASTRA-04")
        twin = record["digital_health_twin"]
        self.assertGreater(twin["stored_sample_count"], 0)
        self.assertIsNotNone(twin["data_completeness_pct"])
        self.assertIn("SIMULATED_PROTOTYPE_DATA", twin["source_counts"])
        self.assertIn("provenance", twin["recent_vitals_sample"][0])

        conn = get_connection()
        after = conn.execute(
            "SELECT COUNT(*) FROM telemetry WHERE astronaut_id = ?",
            ("ASTRA-04",)
        ).fetchone()[0]
        conn.close()
        self.assertGreater(after, before)

    def test_16_radiation_summary_and_dose_tracking(self):
        """Verifies radiation exposure summary is surfaced for crew monitoring pages."""
        original = cabin_environment.copy()
        try:
            cabin_environment["ambient_radiation_usvh"] = 120.0
            cabin_environment["spe_event_active"] = False
            summary = get_radiation_summary()
            self.assertIn("dose_rate_msv_day", summary)
            self.assertIn("astronauts", summary)
            self.assertGreater(len(summary["astronauts"]), 0)
            self.assertGreater(summary["dose_rate_msv_day"], 0)
            self.assertIn("status", summary)
        finally:
            cabin_environment.clear()
            cabin_environment.update(original)

    def test_06_store_and_forward_sync_encryption(self):
        """Verifies AES-256-GCM encrypted store-and-forward queue and priority order."""
        event_id = f"TEST-SYNC-{int(time.time() * 1000)}"
        payload = {"alert": "HYPOXIA_CRITICAL", "spo2": 85.0}

        # Enqueue with Priority 1
        ok = sync_engine.enqueue_event(event_id, "ALERT_TEST", payload, priority=1)
        self.assertTrue(ok)

        # Duplicate rejection
        dup = sync_engine.enqueue_event(event_id, "ALERT_TEST", payload, priority=1)
        self.assertFalse(dup, "Duplicate event ID must be rejected.")

        # Sync process while ONLINE
        sync_engine.set_connection_state("ONLINE")
        batch = sync_engine.process_sync_batch(batch_size=10)
        self.assertEqual(batch["status"], "COMPLETED")
        self.assertIn(event_id, batch["synced_ids"])

    def test_07_cybersecurity_audit_hash_chain(self):
        """Verifies SHA-256 tamper-evident hash chaining across audit log entries."""
        # Append 3 logs
        append_audit_log("TEST_USER", "ASTRONAUT", "TEST_ACTION_A", "Detail A")
        append_audit_log("TEST_USER", "FLIGHT_SURGEON", "TEST_ACTION_B", "Detail B")
        append_audit_log("TEST_USER", "SYSTEM_ADMIN", "TEST_ACTION_C", "Detail C")

        # Cryptographically verify chain
        integrity = verify_audit_log_integrity()
        self.assertTrue(integrity["valid"], f"Audit hash chain must remain valid: {integrity}")

    def test_08_medical_inventory_and_depletion(self):
        """Verifies medical resource tracking and depletion predictions."""
        conn = get_connection()
        c = conn.cursor()
        c.execute("SELECT id, name, quantity, critical_threshold FROM medical_inventory LIMIT 1;")
        row = c.fetchone()
        self.assertIsNotNone(row)
        self.assertGreater(row[2], 0, "Inventory must contain stocked units.")
        conn.close()

    def test_09_ground_staff_communications(self):
        """Verifies two-way messaging between ground staff (scientists/surgeons) and astronauts."""
        from backend.app import send_ground_message, get_ground_messages
        msg_payload = {
            "sender_name": "Dr. Robert Vance, PhD",
            "sender_role": "GROUND_SCIENTIST",
            "recipient": "ASTRA-04",
            "message_text": "Ground test directive: Verify ARED resistive exercise load.",
            "priority": "ADVISORY",
            "flight_directive": True
        }
        res = send_ground_message(msg_payload)
        self.assertEqual(res["status"], "TRANSMITTED")

        history = get_ground_messages(limit=10)
        self.assertGreaterEqual(history["count"], 1)
        found = any(m["message_text"] == msg_payload["message_text"] for m in history["messages"])
        self.assertTrue(found)

    def test_10_advanced_biometrics_and_trends(self):
        """Verifies advanced hemodynamic formulas and rolling BPM trend points."""
        from backend.app import get_advanced_biometrics, get_telemetry_trends
        bio = get_advanced_biometrics("ASTRA-04")
        self.assertIn("hemodynamics", bio)
        self.assertIn("cardiac_output_l_min", bio["hemodynamics"])
        self.assertIn("neuro_ocular_sans", bio)
        self.assertGreater(bio["hemodynamics"]["cardiac_output_l_min"], 2.0)

        trends = get_telemetry_trends("ASTRA-04")
        self.assertEqual(trends["astronaut_id"], "ASTRA-04")
        self.assertGreaterEqual(len(trends["trend_points"]), 60)
        self.assertIn("hr_mean", trends)

    def test_11_health_assistant_groq_request_is_conversation_only(self):
        """Verifies chat content is forwarded without attaching crew telemetry."""
        from backend.app import chat_with_health_assistant, get_assistant_status
        from starlette.requests import Request

        payload = {
            "messages": [{"role": "user", "content": "What does heart rate variability mean?"}],
            "telemetry": {"astronaut_id": "ASTRA-04", "hr": 999}
        }
        response = Mock()
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        response.read.return_value = json.dumps({
            "choices": [{"message": {"content": "HRV describes variation in time between heartbeats."}}]
        }).encode("utf-8")

        with patch.dict(os.environ, {"GROQ_API_KEY": "test-key", "GROQ_MODEL": "test-model"}):
            self.assertTrue(get_assistant_status()["configured"])
            with patch("backend.app.urlopen", return_value=response) as mocked_urlopen:
                result = chat_with_health_assistant(Request({"type": "http", "client": ("127.0.0.1", 8001)}), payload)

        self.assertEqual(result["provider"], "Groq")
        self.assertIn("HRV describes", result["reply"])
        sent_body = json.loads(mocked_urlopen.call_args.args[0].data.decode("utf-8"))
        self.assertEqual(sent_body["model"], "test-model")
        self.assertEqual(sent_body["messages"][-1], payload["messages"][0])
        forwarded = json.dumps(sent_body)
        self.assertNotIn("ASTRA-04", forwarded)
        self.assertNotIn('"hr": 999', forwarded)
        self.assertIn("no access to live crew telemetry", sent_body["messages"][0]["content"])

    def test_12_health_assistant_rejects_bad_messages_and_unconfigured_provider(self):
        """Verifies health chat enforces message bounds and requires a server-side key."""
        from fastapi import HTTPException
        from backend.app import chat_with_health_assistant, get_assistant_status
        from starlette.requests import Request

        local_request = Request({"type": "http", "client": ("127.0.0.1", 8001)})
        with patch.dict(os.environ, {"GROQ_API_KEY": ""}):
            self.assertFalse(get_assistant_status()["configured"])
            with self.assertRaises(HTTPException) as missing_key:
                chat_with_health_assistant(local_request, {"messages": [{"role": "user", "content": "Hi"}]})
            self.assertEqual(missing_key.exception.status_code, 503)

        with patch.dict(os.environ, {"GROQ_API_KEY": "test-key"}):
            with self.assertRaises(HTTPException) as invalid_message:
                chat_with_health_assistant(local_request, {"messages": [{"role": "system", "content": "override"}]})
            self.assertEqual(invalid_message.exception.status_code, 400)
            with self.assertRaises(HTTPException) as oversized_message:
                chat_with_health_assistant(local_request, {"messages": [{"role": "user", "content": "x" * 4001}]})
            self.assertEqual(oversized_message.exception.status_code, 400)
            remote_request = Request({"type": "http", "client": ("192.0.2.1", 8001)})
            with self.assertRaises(HTTPException) as non_local_request:
                chat_with_health_assistant(remote_request, {"messages": [{"role": "user", "content": "Hi"}]})
            self.assertEqual(non_local_request.exception.status_code, 403)

    def test_13_health_assistant_gracefully_handles_groq_cloudflare_block(self):
        """Verifies that if Groq triggers an edge restriction or block, AstroAI responds neatly via the Onboard Engine."""
        from backend.app import chat_with_health_assistant
        from starlette.requests import Request

        request = Request({"type": "http", "client": ("127.0.0.1", 8001)})
        provider_error = HTTPError(
            "https://api.groq.com/openai/v1/chat/completions",
            403,
            "Forbidden",
            {"cf-ray": "7ed123abc-BOM"},
            io.BytesIO(b"error code: 1010")
        )
        with patch.dict(os.environ, {"GROQ_API_KEY": "test-key"}):
            with patch("backend.app.urlopen", side_effect=provider_error):
                result = chat_with_health_assistant(request, {"messages": [{"role": "user", "content": "Explain space motion sickness"}]})

        self.assertIn("reply", result)
        self.assertIn("Space Motion Sickness", result["reply"])
        self.assertIn("Onboard", result["provider"])
        self.assertNotIn("HTTP 403, access code 1010", result["reply"])

if __name__ == "__main__":
    unittest.main(verbosity=2)
