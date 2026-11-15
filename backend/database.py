"""
ASTRA - Autonomous Spaceflight Telemetry, Risk Analytics & Emergency Response
Database Layer - High-Reliability Local SQLite Store (Offline-First)
"""

import sqlite3
import os
import json
import logging
from datetime import datetime, timezone

DB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
DB_PATH = os.path.join(DB_DIR, "astra.db")
ACTIVE_ASTRONAUT_IDS = ("ASTRA-01", "ASTRA-04")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ASTRA.DB")

def get_connection():
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    # Enable Write-Ahead Logging (WAL) for concurrent reads and writes, high fault-tolerance
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    # 1. Astronauts Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS astronauts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        age INTEGER NOT NULL,
        blood_type TEXT NOT NULL,
        assigned_cabin TEXT NOT NULL,
        baseline_hr REAL DEFAULT 70.0,
        baseline_hrv REAL DEFAULT 55.0,
        baseline_bp_sys REAL DEFAULT 120.0,
        baseline_bp_dia REAL DEFAULT 80.0,
        baseline_spo2 REAL DEFAULT 98.0,
        baseline_temp REAL DEFAULT 36.8,
        baseline_resp_rate REAL DEFAULT 14.0,
        mission_day INTEGER DEFAULT 142,
        status TEXT DEFAULT 'NORMAL',
        created_at TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1
    );
    """)
    astronaut_columns = {row["name"] for row in cursor.execute("PRAGMA table_info(astronauts);").fetchall()}
    if "is_active" not in astronaut_columns:
        cursor.execute("ALTER TABLE astronauts ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;")

    cursor.execute(
        "UPDATE astronauts SET is_active = CASE WHEN id IN (?, ?) THEN 1 ELSE 0 END;",
        ACTIVE_ASTRONAUT_IDS,
    )
    cursor.execute(
        "UPDATE astronauts SET role = 'Astronaut' WHERE id IN (?, ?);",
        ACTIVE_ASTRONAUT_IDS,
    )

    # 2. Physiological Telemetry
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS telemetry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        astronaut_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        hr REAL,
        hrv REAL,
        spo2 REAL,
        resp_rate REAL,
        bp_sys REAL,
        bp_dia REAL,
        temp_c REAL,
        ecg_amplitude REAL,
        activity_g REAL,
        sqi REAL DEFAULT 100.0,
        provenance TEXT NOT NULL, -- LIVE_SENSOR_DATA | NASA_RESEARCH_DATA | SIMULATED_PROTOTYPE_DATA
        sensor_id TEXT,
        FOREIGN KEY (astronaut_id) REFERENCES astronauts(id) ON DELETE CASCADE
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_telemetry_astro_time ON telemetry(astronaut_id, timestamp);")

    # 3. Spacecraft Environmental Telemetry
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS environmental_telemetry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        cabin_o2_pct REAL NOT NULL,
        cabin_co2_mmhg REAL NOT NULL,
        cabin_pressure_kpa REAL NOT NULL,
        cabin_temp_c REAL NOT NULL,
        cabin_humidity_pct REAL NOT NULL,
        ambient_radiation_usvh REAL NOT NULL,
        provenance TEXT NOT NULL -- LIVE_SENSOR_DATA | SIMULATED_PROTOTYPE_DATA
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_env_time ON environmental_telemetry(timestamp);")

    # 4. Radiation Dosimetry
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS radiation_dosimetry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        astronaut_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        dose_rate_usvh REAL NOT NULL,
        cumulative_mission_msv REAL NOT NULL,
        spe_warning_level TEXT DEFAULT 'GREEN', -- GREEN | AMBER | RED
        provenance TEXT NOT NULL,
        FOREIGN KEY (astronaut_id) REFERENCES astronauts(id) ON DELETE CASCADE
    );
    """)

    # 5. Cognitive Assessments (e.g. Psychomotor Vigilance Task)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS cognitive_assessments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        astronaut_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        test_type TEXT NOT NULL, -- 'PVT_REACTION_TIME'
        mean_reaction_time_ms REAL NOT NULL,
        lapse_count INTEGER NOT NULL,
        attention_score REAL NOT NULL,
        subjective_fatigue_level INTEGER NOT NULL, -- 1-10
        provenance TEXT NOT NULL,
        FOREIGN KEY (astronaut_id) REFERENCES astronauts(id) ON DELETE CASCADE
    );
    """)

    # 6. Detected Health Anomalies
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS anomalies (
        id TEXT PRIMARY KEY,
        astronaut_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        severity TEXT NOT NULL, -- INFORMATION | WARNING | CRITICAL | SENSOR_FAILURE
        anomaly_type TEXT NOT NULL,
        triggering_metrics TEXT NOT NULL, -- JSON
        baseline_comparison TEXT NOT NULL, -- JSON
        confidence_score REAL NOT NULL,
        explanation TEXT NOT NULL,
        relevant_procedure_id TEXT,
        status TEXT DEFAULT 'ACTIVE', -- ACTIVE | ACKNOWLEDGED | RESOLVED
        acknowledged_by TEXT,
        acknowledged_at TEXT,
        FOREIGN KEY (astronaut_id) REFERENCES astronauts(id) ON DELETE CASCADE
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_anomalies_astro ON anomalies(astronaut_id, status);")

    # 7. Active & Historical Emergencies
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS emergencies (
        id TEXT PRIMARY KEY,
        astronaut_id TEXT NOT NULL,
        started_at TEXT NOT NULL,
        severity TEXT NOT NULL,
        code TEXT NOT NULL,
        title TEXT NOT NULL,
        checklist_id TEXT NOT NULL,
        completed_steps TEXT DEFAULT '[]', -- JSON array of completed step IDs
        status TEXT DEFAULT 'ACTIVE', -- ACTIVE | ACKNOWLEDGED | RESOLVED
        resolved_at TEXT,
        notes TEXT,
        FOREIGN KEY (astronaut_id) REFERENCES astronauts(id) ON DELETE CASCADE
    );
    """)

    # 8. Medical Resource & Formulary Inventory
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS medical_inventory (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit TEXT NOT NULL,
        batch_lot TEXT NOT NULL,
        expiry_date TEXT NOT NULL,
        storage_temp TEXT NOT NULL,
        daily_consumption_rate REAL DEFAULT 0.05,
        critical_threshold INTEGER NOT NULL,
        last_inspected TEXT NOT NULL
    );
    """)

    # 9. Tamper-Evident SHA-256 Audit Logs
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT NOT NULL,
        prev_hash TEXT NOT NULL,
        hash TEXT NOT NULL
    );
    """)

    # 10. Store-and-Forward Synchronization Queue
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sync_queue (
        event_id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        priority INTEGER NOT NULL, -- 1=CRITICAL, 2=WARNING, 3=ROUTINE
        payload_type TEXT NOT NULL,
        encrypted_payload TEXT NOT NULL,
        status TEXT DEFAULT 'PENDING', -- PENDING | SYNCED | FAILED
        retry_count INTEGER DEFAULT 0,
        last_attempt TEXT
    );
    """)

    # 11. Ground Staff (Scientists/Surgeons) <-> Astronaut Communications
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ground_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        sender_name TEXT NOT NULL,
        sender_role TEXT NOT NULL, -- GROUND_SCIENTIST | FLIGHT_SURGEON | ASTRONAUT | BIOMEDICAL_ENGINEER
        recipient TEXT NOT NULL, -- CREW_ALL | ASTRA-01 | ASTRA-04
        message_text TEXT NOT NULL,
        priority TEXT DEFAULT 'ROUTINE', -- ROUTINE | ADVISORY | URGENT
        flight_directive BOOLEAN DEFAULT 0,
        status TEXT DEFAULT 'TRANSMITTED' -- TRANSMITTED | QUEUED | ACKNOWLEDGED
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS nasa_dataset_cache (
        metadata_version TEXT NOT NULL,
        metadata_json TEXT NOT NULL,
        files_json TEXT NOT NULL,
        source_url TEXT NOT NULL,
        fetched_at TEXT NOT NULL,
        accession TEXT NOT NULL,
        PRIMARY KEY(accession, metadata_version)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS nasa_downloads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        accession TEXT NOT NULL,
        file_name TEXT NOT NULL,
        stored_path TEXT NOT NULL,
        source_url TEXT NOT NULL,
        sha256 TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        dataset_version TEXT,
        source_category TEXT NOT NULL,
        downloaded_at TEXT NOT NULL
    );
    """)

    # Seed initial astronaut profiles if empty
    cursor.execute("SELECT COUNT(*) FROM astronauts;")
    if cursor.fetchone()[0] == 0:
        seed_initial_data(cursor)

    conn.commit()
    conn.close()
    logger.info("ASTRA database schema verified and initialized.")

def seed_initial_data(cursor):
    now = datetime.now(timezone.utc).isoformat()
    crew = [
        ("ASTRA-01", "CDR Alex Mercer", "Astronaut", 42, "O+", "Cabin Alpha", 68.0, 62.0, 118.0, 78.0, 98.5, 36.7, 13.0, 142, "NORMAL", now),
        ("ASTRA-04", "Dr. Sarah Chen", "Astronaut", 37, "O+", "Cupola / Module 4", 68.0, 68.0, 118.0, 76.0, 99.0, 36.9, 14.0, 142, "NORMAL", now),
    ]
    cursor.executemany("""
    INSERT INTO astronauts (
        id, name, role, age, blood_type, assigned_cabin,
        baseline_hr, baseline_hrv, baseline_bp_sys, baseline_bp_dia, baseline_spo2,
        baseline_temp, baseline_resp_rate, mission_day, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, crew)

    # Seed initial medical formulary inventory
    inventory = [
        ("MED-001", "Epinephrine Auto-Injector (0.3mg)", "CARDIOPROTECTIVE", 12, "units", "LOT-EP8892", "2028-06-30", "15-25°C", 0.0, 4, now),
        ("MED-002", "Atropine Sulfate (1mg/mL)", "CARDIOPROTECTIVE", 16, "vials", "LOT-AT4102", "2027-11-15", "15-25°C", 0.0, 4, now),
        ("MED-003", "Amiodarone HCl (150mg)", "CARDIOPROTECTIVE", 10, "ampoules", "LOT-AM9921", "2028-01-20", "20-25°C", 0.0, 3, now),
        ("MED-004", "Ceftriaxone Sodium (1g)", "ANTIBIOTIC", 24, "vials", "LOT-CF3320", "2027-09-10", "15-30°C", 0.02, 6, now),
        ("MED-005", "Albuterol Inhaler (90mcg)", "RESPIRATORY", 8, "canisters", "LOT-AL1044", "2028-04-18", "15-25°C", 0.03, 2, now),
        ("MED-006", "Morphine Sulfate (10mg/mL)", "ANALGESIC", 15, "syrettes", "LOT-MS7741", "2027-12-01", "Locked / 15-25°C", 0.0, 4, now),
        ("MED-007", "Promethazine HCl (25mg)", "ANTIEMETIC", 40, "tablets", "LOT-PR5012", "2028-08-14", "15-30°C", 0.1, 10, now),
        ("MED-008", "Potassium Iodide (130mg)", "RADIOPROTECTIVE", 60, "tablets", "LOT-KI0911", "2030-03-30", "15-30°C", 0.0, 15, now),
        ("MED-009", "Normal Saline IV (500mL)", "FLUIDS", 18, "bags", "LOT-NS6221", "2028-05-15", "20-25°C", 0.05, 5, now),
        ("MED-010", "Dexamethasone (4mg/mL)", "STEROID", 14, "vials", "LOT-DX3819", "2027-10-31", "15-25°C", 0.01, 3, now)
    ]
    cursor.executemany("""
    INSERT INTO medical_inventory (
        id, name, category, quantity, unit, batch_lot, expiry_date,
        storage_temp, daily_consumption_rate, critical_threshold, last_inspected
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, inventory)

    # Seed initial ground staff <-> astronaut messages
    messages = [
        (now, "Dr. Paul Myers, MD", "FLIGHT_SURGEON", "CREW_ALL", "Houston Surgeon Console online. Reviewing Orbit 4,118 cardiovascular trends. Dr. Sarah Chen's resting ECG and SpO2 are optimal.", "ROUTINE", 0, "TRANSMITTED"),
        (now, "Dr. Robert Vance, PhD", "GROUND_SCIENTIST", "ASTRA-04", "Sarah, NASA HRP bone demineralization markers indicate soleus mass is protected at 96.5%. Maintain your 45-min ARED resistive cycle today.", "ADVISORY", 1, "TRANSMITTED"),
        (now, "Dr. Sarah Chen", "ASTRONAUT", "CREW_ALL", "Copy Houston. Completed morning eye exam; Frisén papilledema score is Grade 0, zero retinal edema. Feeling energized for EVA prep.", "ROUTINE", 0, "ACKNOWLEDGED"),
        (now, "Mark Alvarez", "BIOMEDICAL_ENGINEER", "CREW_ALL", "BME Console: Verified Active Personal Dosimeter sync. Space weather GCR flux is quiet at 18.5 uSv/h. Shielding nominal.", "ROUTINE", 0, "TRANSMITTED")
    ]
    cursor.executemany("""
    INSERT INTO ground_messages (timestamp, sender_name, sender_role, recipient, message_text, priority, flight_directive, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    """, messages)

    # Initial genesis audit log with real SHA-256
    prev_hash = "0" * 64
    raw_str = f"{prev_hash}|{now}|SYSTEM_INIT|SYSTEM_ADMIN|SYSTEM_GENESIS|ASTRA database initialized and calibrated."
    import hashlib
    gen_hash = hashlib.sha256(raw_str.encode("utf-8")).hexdigest()
    cursor.execute("""
    INSERT INTO audit_logs (timestamp, user_id, role, action, details, prev_hash, hash)
    VALUES (?, 'SYSTEM_INIT', 'SYSTEM_ADMIN', 'SYSTEM_GENESIS', 'ASTRA database initialized and calibrated.', ?, ?);
    """, (now, prev_hash, gen_hash))

if __name__ == "__main__":
    init_db()
    print("Database initialization successful.")
