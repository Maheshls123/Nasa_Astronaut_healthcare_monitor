# ASTRA — Comprehensive Master Technical Specification & Architecture Manual

## 1. Executive Summary & Mission Profile
**ASTRA** (*Autonomous Spaceflight Telemetry, Risk Analytics & Emergency Response*) is an offline-first aerospace medical intelligence platform designed for long-duration human exploration missions (Lunar Artemis base, Mars Transit, and Deep Space Habitation).

During exploration beyond Low Earth Orbit (LEO), real-time telemedicine with Earth becomes physically impossible due to speed-of-light latency (3 to 22 minutes each way to Mars) and periods of total solar conjunction blackout (lasting up to two weeks). ASTRA provides crew medical autonomy through onboard real-time sensor processing, edge AI anomaly detection, explainable clinical triage, interactive offline emergency procedures, and store-and-forward synchronization.

> [!NOTE]
> **Research Prototype Notice**: ASTRA is an engineering and biomedical software prototype developed for hackathon and aerospace medicine research demonstrations. It is not flight-certified by NASA, not FDA/CE cleared, and does not claim access to classified astronaut health records.

---

## 2. Feature Implementation Status Matrix

| Subsystem / Feature | Classification | Implementation Status & Evidence |
| :--- | :---: | :--- |
| **Local SQLite WAL Engine** | `FUNCTIONAL` | `backend/database.py`: Fully operational SQLite with Write-Ahead Logging (WAL) and synchronous normal mode. |
| **PWA & Offline Shell** | `PARTIALLY IMPLEMENTED` | A manifest and service worker exist, but the frontend unregisters service workers at startup and the cached paths do not match the decoupled layout. Do not rely on browser offline operation. Local SQLite and the encrypted sync queue work only while the local backend is running. |
| **Signal Quality Assessor (SQI)** | `FUNCTIONAL` | `backend/sensor_gateway.py`: Detects motion artifacts, lead-off disconnection, amplifier clipping, and extreme outliers. |
| **Dynamic Canvas ECG Oscilloscope** | `FUNCTIONAL` | `frontend/js/oscilloscope.js`: 60 FPS Canvas renderer with Lead II biopotential sweep, phosphor decay, and clinical grid. |
| **Personal Baseline Calibration** | `FUNCTIONAL` | `backend/ai_engine.py`: Dynamic rolling window stats, individual variance, and Z-score calculations. |
| **Multivariate Anomaly Detection** | `FUNCTIONAL` | `backend/ai_engine.py`: Identifies inappropriate tachycardia, hypoxia, bradycardia, and orthostatic intolerance. |
| **Explainable AI (XAI) Attribution** | `FUNCTIONAL` | `backend/ai_engine.py`, `frontend/js/app.js`: Explains what changed, metrics involved, baseline delta, and procedure reference. |
| **Predictive Risk Horizons** | `SIMULATED` | `backend/ai_engine.py`: Heuristic demo scores only; not calibrated, clinically validated, or trained to predict live astronaut emergencies. |
| **Astronaut Health Timeline** | `PARTIALLY IMPLEMENTED` | `GET /api/astronauts/{id}` returns up to 50 stored samples with provenance and measured field completeness; `frontend/js/app.js` charts HR, SpO2, respiratory rate, or systolic BP against configured baseline. Backend simulation snapshots are saved every 30 seconds and labeled simulated; physical sensor packets are stored when received. No long-term cohort analysis or clinical interpretation. |
| **Emergency Triage & State Machine** | `PARTIALLY IMPLEMENTED` | `backend/emergency_engine.py`, `frontend/js/app.js`: Local incident console lists unresolved incidents, acknowledgement, checklist-step tracking, and review/closure notes; validates checklist steps and blocks updates to resolved incidents. No backend authentication/role enforcement; not authorized for real medical response. |
| **Interactive Emergency Checklists** | `PARTIALLY IMPLEMENTED` | `data/medical_procedures/procedures.json`, `frontend/index.html`: Procedures are displayed with incident progress and step actions. Content is prototype material and requires review/approval by mission medical authorities before operational use. |
| **Psychomotor Vigilance Task (PVT)**| `FUNCTIONAL` | `frontend/js/app.js`: Real interactive reaction time stimulus (ms) measuring cognitive alertness and fatigue in browser. |
| **Medical Formulary & Inventory** | `FUNCTIONAL` | `backend/database.py`, `backend/app.py`: Tracks medication batches, expiry, consumption logs, and depletion days. |
| **Spacecraft ECLSS Atmospheric Ingest**| `FUNCTIONAL` | `backend/app.py`: Cabin O2 %, CO2 mmHg, pressure kPa, temp, humidity, and atmospheric drill injection. |
| **NASA OSDR search, metadata, files, download** | `PARTIALLY IMPLEMENTED` | `backend/nasa_osdr.py`, `backend/app.py`, `frontend/index.html`, `frontend/js/app.js`: Live search and metadata/file discovery, curated offline summaries, public-file access checks, size-limited unchanged downloads with SHA-256 and version provenance. No file parsing, dataset preview, data dictionary, research analysis, or cohort comparison. |
| **Store-and-Forward Sync Queue** | `FUNCTIONAL` | `backend/sync_engine.py`: Priority queue (1=Crit, 2=Warn, 3=Routine), duplicate prevention, and DSN states. |
| **Role-Based Access Control (RBAC)**| `PARTIALLY IMPLEMENTED` | `backend/security.py` declares roles and permissions, but most API routes do not enforce authenticated role authorization. Frontend role selection is not a security boundary. |
| **AES-256-GCM Payload Encryption** | `FUNCTIONAL` | `backend/security.py`: Hardware-grade authenticated 256-bit encryption for sensitive medical records in transit/rest. |
| **SHA-256 Tamper-Evident Audit Log** | `FUNCTIONAL` | `backend/security.py`: Cryptographic hash chaining with verification function detecting tampering or deletion. |
| **Physical Serial/USB Microcontroller**| `FUNCTIONAL` | `backend/sensor_gateway.py`: PySerial hardware adapter for ESP32 with MAX30102 / AD8232 COM ingestion. |
| **Synthetic Simulation Lab** | `SIMULATED` | `backend/sensor_gateway.py`: Deterministic multi-astronaut simulation with tachycardia, hypoxia, orthostatic scenarios. |
| **Hardware BOM Cost Estimation** | `FUNCTIONAL` | `backend/app.py`, `frontend/js/app.js`: Comprehensive COTS open-hardware pricing breakdown ($218 total). |
| **Autonomous Robotic Surgery** | `FUTURE DEVELOPMENT` | Architectural hooks reserved for modular remote telemetry and surgical robotics interfaces. |
| **Smart Garment Biosensors** | `FUTURE DEVELOPMENT` | Adapter interfaces prepared for dry-electrode smart fabrics and ultrasound telemetry. |

---

## 3. Database Schema Reference

The local onboard SQLite database (`data/astra.db`) contains 10 specialized tables:

```sql
-- 1. Crew Profiles & Baselines
CREATE TABLE astronauts (
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
    created_at TEXT NOT NULL
);

-- 2. Validated Physiological Telemetry
CREATE TABLE telemetry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    astronaut_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    hr REAL, hrv REAL, spo2 REAL, resp_rate REAL,
    bp_sys REAL, bp_dia REAL, temp_c REAL,
    ecg_amplitude REAL, activity_g REAL,
    sqi REAL DEFAULT 100.0,
    provenance TEXT NOT NULL, -- LIVE_SENSOR_DATA | NASA_RESEARCH_DATA | SIMULATED_PROTOTYPE_DATA
    sensor_id TEXT,
    FOREIGN KEY (astronaut_id) REFERENCES astronauts(id) ON DELETE CASCADE
);

-- 3. Spacecraft Environmental Telemetry (ECLSS)
CREATE TABLE environmental_telemetry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    cabin_o2_pct REAL NOT NULL,
    cabin_co2_mmhg REAL NOT NULL,
    cabin_pressure_kpa REAL NOT NULL,
    cabin_temp_c REAL NOT NULL,
    cabin_humidity_pct REAL NOT NULL,
    ambient_radiation_usvh REAL NOT NULL,
    provenance TEXT NOT NULL
);

-- 4. Active & Historical Emergencies
CREATE TABLE emergencies (
    id TEXT PRIMARY KEY,
    astronaut_id TEXT NOT NULL,
    started_at TEXT NOT NULL,
    severity TEXT NOT NULL,
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    checklist_id TEXT NOT NULL,
    completed_steps TEXT DEFAULT '[]',
    status TEXT DEFAULT 'ACTIVE',
    resolved_at TEXT,
    notes TEXT,
    FOREIGN KEY (astronaut_id) REFERENCES astronauts(id) ON DELETE CASCADE
);

-- 5. Medical Resource Formulary
CREATE TABLE medical_inventory (
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

-- 6. Cryptographic Tamper-Evident Audit Log
CREATE TABLE audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL,
    prev_hash TEXT NOT NULL,
    hash TEXT NOT NULL
);

-- 7. Store-and-Forward Synchronization Queue
CREATE TABLE sync_queue (
    event_id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    priority INTEGER NOT NULL, -- 1=CRITICAL, 2=WARNING, 3=ROUTINE
    payload_type TEXT NOT NULL,
    encrypted_payload TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING',
    retry_count INTEGER DEFAULT 0,
    last_attempt TEXT
);
```

---

## 4. REST & WebSocket API Specification

### Status & Core
- `GET /api/status`: Returns system operational mode, monitored crew count, DSN uplink connection state, storage health, and ECLSS nominal status.
- `GET /api/astronauts`: Returns the 2 active astronaut profiles, roles, assigned cabins, and baseline physiological thresholds. Inactive historical profiles remain stored but are not included in the live roster.
- `GET /api/ground/staff`: Returns three ground support people: a flight surgeon, a ground scientist, and a biomedical engineer.
- `GET /api/astronauts/{id}`: Returns the astronaut profile, up to 50 stored telemetry samples with source labels, sample count, measured field completeness, recent cognitive assessments, and current heuristic alerts. Does not provide a complete biological twin or verified countermeasure compliance.

### Telemetry & Hardware Ingestion
- `GET /api/telemetry/live`: Snapshot of simulated multi-astronaut vitals and cabin metrics. The backend persists a labeled simulation snapshot at most every 30 seconds for the health timeline; external sensor packets are persisted at ingestion.
- `POST /api/telemetry/ingest`: JSON payload ingestion endpoint for physical microcontrollers (ESP32, BLE gateway, Raspberry Pi) with Signal Quality Index assessment.
- `WebSocket /ws/telemetry`: High-frequency real-time telemetry streaming (2 Hz - 10 Hz) for Canvas ECG oscilloscopes and HUD cards.

### Environmental Control (ECLSS)
- `GET /api/environmental`: Current cabin ppCO2, ppO2, total pressure, temperature, humidity, and ambient radiation flux.
- `POST /api/environmental/inject`: Allows flight surgeons or drill instructors to simulate atmospheric events (e.g. CO2 scrubber failure, depressurization).

### AI Health Intelligence & Emergencies
- `GET /api/anomalies`: Active crew anomalies with Explainable AI attribution and baseline Z-score deviation.
- `GET /api/emergencies`: Active emergency incident status and checklist progress.
- `POST /api/emergencies/trigger`: Manual emergency activation.
- `POST /api/emergencies/{id}/acknowledge`: Medical officer acknowledgement.
- `POST /api/emergencies/{id}/step`: Completes a specific step in an interactive clinical checklist.
- `POST /api/emergencies/{id}/resolve`: Resolves the emergency and restores crew status to NOMINAL.

### NASA OSDR Research Integration
- `GET /api/nasa/search?term={query}&category={category}&from={offset}&size={count}`: Searches live OSDR or returns matching curated offline summaries when the service is unreachable.
- `GET /api/nasa/dataset/{id}`: Returns available study metadata, a metadata-completeness review, and the first file page.
- `GET /api/nasa/dataset/{id}/files?page={page}&page_size={count}`: Retrieves a page of file metadata and access flags.
- `POST /api/nasa/dataset/{id}/download`: Saves a listed, visible, unrestricted file (up to 100 MiB) locally and records its SHA-256 checksum and provenance.

The workbench does not parse or import data files, provide a data dictionary or dataset preview, connect research values to crew health records, or support research reports/cohort analysis.

### Store-and-Forward Synchronization
- `GET /api/sync/status`: Queue status, pending packet counts, storage usage, and DSN uplink mode.
- `POST /api/sync/trigger`: Triggers batch synchronization of queued encrypted telemetry to Earth.
- `POST /api/sync/connection?state={state}`: Sets link state (`ONLINE`, `OFFLINE`, `SYNCING`).

### Cognitive Assessment
- `POST /api/cognitive/pvt`: Records interactive Psychomotor Vigilance Task reaction times (ms), lapse counts, and attention scores.

### Hardware BOM & Diagnostics
- `GET /api/hardware/bom`: Returns low-cost open-hardware cost breakdown ($218 total system estimate).
- `GET /api/audit`: Returns recent audit trail entries along with SHA-256 cryptographic chain integrity verification.

---

## 5. Security & Cryptographic Verification

1. **Role-Based Access Control (RBAC)**:
   - Enforces strict separation between crew self-reporting (`ASTRONAUT`), clinical triage (`FLIGHT_SURGEON`), telemetry overview (`MISSION_CONTROL`), and system diagnostics (`SYSTEM_ADMIN`).
2. **Authenticated Symmetric Encryption (AES-256-GCM)**:
   - Uses persistent 256-bit keys and 96-bit random initialization vectors (nonces) per transmission packet, ensuring both confidentiality and cryptographic integrity.
3. **SHA-256 Hash Chained Audit Trail**:
   - Each audit record incorporates the SHA-256 digest of the immediately preceding entry. Any alteration, deletion, or manual row tampering invalidates the chain head immediately.

---

## 6. Known Limitations & Roadmap

### Current Limitations
1. Consumer prototype sensors (MAX30102, AD8232) exhibit baseline wander and motion artifacts during intense EVA physical activity; they are suitable for research prototypes but not clinical life-support.
2. The anomaly and risk logic is heuristic prototype code; risk scores/confidence have not been calibrated or clinically validated and cannot predict live astronaut emergencies. It does not prescribe treatment.
3. NASA OSDR studies are public research datasets covering space biology, not private real-time astronaut medical records.
4. Backend authentication and route-level role authorization are not implemented; role declarations and frontend selection do not protect health data.
5. Browser offline operation is incomplete. A local backend, durable client cache, reliable PWA shell, and restart/recovery behavior still require implementation and tests.

### Future Development Roadmap
- **Phase 9**: Integration of low-power Edge TPU / NPU hardware accelerators for ONNX Runtime transformer-based arrhythmia classification.
- **Phase 10**: Privacy-preserving Federated Learning across isolated spacecraft nodes to refine personal baselines without sharing unencrypted health twins.
- **Phase 11**: Modular integration with portable point-of-care ultrasound (POCUS) and autonomous robotic medical assist manipulators.
