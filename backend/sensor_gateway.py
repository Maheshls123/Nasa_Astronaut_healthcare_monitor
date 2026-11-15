"""
ASTRA - Autonomous Spaceflight Telemetry, Risk Analytics & Emergency Response
Sensor Gateway & Preprocessing Layer
Supports Serial/USB COM ports (ESP32 / MAX30102 / AD8232), HTTP/WS streaming, and Multi-Astronaut Simulation.
"""

import os
import sys
import math
import time
import random
import json
import logging
import threading
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.database import get_connection

logger = logging.getLogger("ASTRA.SensorGateway")

# Sensor Provenance Constants
PROVENANCE_LIVE = "LIVE_SENSOR_DATA"
PROVENANCE_NASA = "NASA_RESEARCH_DATA"
PROVENANCE_SIM = "SIMULATED_PROTOTYPE_DATA"

class SignalQualityAssessor:
    """
    Computes Signal Quality Index (SQI: 0 to 100%) and detects sensor artifacts,
    lead-off events, and physiological implausibility.
    """
    @staticmethod
    def evaluate_cardiovascular(hr: Optional[float], hrv: Optional[float], ecg_amp: Optional[float]) -> Dict[str, Any]:
        if hr is None:
            return {"sqi": 0.0, "status": "NO_SIGNAL", "lead_off": True, "artifact": False}

        # Plausibility bounds (NASA human spaceflight medical reference bounds)
        if hr < 25.0 or hr > 240.0:
            return {"sqi": 15.0, "status": "IMPLAUSIBLE_VALUE", "lead_off": False, "artifact": True}

        # Check for noise or clipping in ECG amplitude
        if ecg_amp is not None and abs(ecg_amp) > 5.0: # 5 mV clipping threshold
            return {"sqi": 30.0, "status": "AMPLIFIER_SATURATION", "lead_off": False, "artifact": True}

        # Standard clean signal
        return {"sqi": 98.5, "status": "NOMINAL", "lead_off": False, "artifact": False}

    @staticmethod
    def evaluate_respiratory(spo2: Optional[float], resp_rate: Optional[float]) -> Dict[str, Any]:
        if spo2 is None or resp_rate is None:
            return {"sqi": 0.0, "status": "NO_SIGNAL", "lead_off": True, "artifact": False}

        if spo2 < 50.0 or spo2 > 100.0:
            return {"sqi": 20.0, "status": "IMPLAUSIBLE_SPO2", "lead_off": False, "artifact": True}

        if resp_rate < 3.0 or resp_rate > 60.0:
            return {"sqi": 25.0, "status": "RESP_OUT_OF_BOUNDS", "lead_off": False, "artifact": True}

        return {"sqi": 96.0, "status": "NOMINAL", "lead_off": False, "artifact": False}


class SyntheticTelemetryGenerator:
    """
    Generates deterministic physiological telemetry for simulation testing.
    Every output is rigorously tagged with PROVENANCE_SIM.
    """
    def __init__(self, astronaut_id: str, profile_name: str, baseline_hr=70.0, baseline_spo2=98.5):
        self.astronaut_id = astronaut_id
        self.profile_name = profile_name
        self.baseline_hr = baseline_hr
        self.baseline_spo2 = baseline_spo2
        self.phase = 0.0
        self.scenario = "NORMAL" # NORMAL | TACHYCARDIA | HYPOXIA | ORTHOSTATIC | SENSOR_DISCONNECT
        self.noise_enabled = False
        self.lead_off = False

    def set_scenario(self, scenario: str, noise=False):
        self.scenario = scenario
        self.noise_enabled = noise
        if scenario == "SENSOR_DISCONNECT":
            self.lead_off = True
        else:
            self.lead_off = False

    def generate_step(self, t_seconds: float) -> Dict[str, Any]:
        now_iso = datetime.now(timezone.utc).isoformat()

        if self.lead_off:
            return {
                "astronaut_id": self.astronaut_id,
                "timestamp": now_iso,
                "hr": None,
                "hrv": None,
                "spo2": None,
                "resp_rate": None,
                "bp_sys": None,
                "bp_dia": None,
                "temp_c": None,
                "ecg_amplitude": 0.0,
                "activity_g": 0.0,
                "sqi": 0.0,
                "provenance": PROVENANCE_SIM,
                "sensor_id": f"SIM-NODE-{self.astronaut_id}",
                "status": "SENSOR_DISCONNECTED",
                "alert": "CRITICAL: Sensor telemetry lead disconnected or lost telemetry packet."
            }

        # Scenario physiological adjustments
        hr_offset = 0.0
        spo2_offset = 0.0
        resp_offset = 0.0
        bp_sys_offset = 0.0
        bp_dia_offset = 0.0
        hrv_val = 60.0 + 8.0 * math.sin(t_seconds / 20.0)

        if self.scenario == "TACHYCARDIA":
            # EVA physical exertion or cardiac event
            hr_offset = 58.0 + 10.0 * math.sin(t_seconds / 15.0)
            resp_offset = 12.0
            bp_sys_offset = 28.0
            bp_dia_offset = 14.0
            hrv_val = 22.0 # Depressed HRV
        elif self.scenario == "HYPOXIA":
            # Cabin depressurization or suit scrubber failure
            hr_offset = 32.0
            spo2_offset = -12.5 # Drops SpO2 to ~86%
            resp_offset = 10.0
            bp_sys_offset = 15.0
        elif self.scenario == "ORTHOSTATIC":
            # Post-EVA / microgravity fluid shift orthostatic intolerance
            hr_offset = 42.0
            bp_sys_offset = -32.0 # Hypotensive drop
            bp_dia_offset = -18.0
            hrv_val = 30.0

        # Base sinusoidal circadian drift
        circadian = 2.0 * math.sin(t_seconds / 100.0)
        noise = random.gauss(0, 1.2) if self.noise_enabled else 0.0

        hr = round(self.baseline_hr + hr_offset + circadian + noise, 1)
        spo2 = min(100.0, max(75.0, round(self.baseline_spo2 + spo2_offset + (noise * 0.2), 1)))
        resp_rate = round(14.0 + resp_offset + 0.8 * math.sin(t_seconds / 8.0), 1)
        bp_sys = round(120.0 + bp_sys_offset + noise * 1.5, 0)
        bp_dia = round(80.0 + bp_dia_offset + noise * 0.8, 0)
        temp_c = round(36.8 + 0.15 * math.sin(t_seconds / 200.0), 2)
        activity_g = round(0.04 + (0.85 if self.scenario == "TACHYCARDIA" else 0.02) + random.uniform(0, 0.05), 3)

        # Realistic P-Q-R-S-T ECG Waveform synthesis (Lead II)
        # Period based on heart rate
        cardiac_cycle_period = 60.0 / max(30.0, hr)
        t_in_cycle = (t_seconds % cardiac_cycle_period) / cardiac_cycle_period # 0.0 to 1.0

        ecg_val = self._synthesize_ecg(t_in_cycle)
        if self.noise_enabled:
            ecg_val += random.gauss(0, 0.04)

        sqi_eval = SignalQualityAssessor.evaluate_cardiovascular(hr, hrv_val, ecg_val)

        return {
            "astronaut_id": self.astronaut_id,
            "timestamp": now_iso,
            "hr": hr,
            "hrv": round(hrv_val, 1),
            "spo2": spo2,
            "resp_rate": resp_rate,
            "bp_sys": bp_sys,
            "bp_dia": bp_dia,
            "temp_c": temp_c,
            "ecg_amplitude": round(ecg_val, 3),
            "activity_g": activity_g,
            "sqi": sqi_eval["sqi"],
            "provenance": PROVENANCE_SIM,
            "sensor_id": f"SIM-NODE-{self.astronaut_id}",
            "status": "NOMINAL" if self.scenario == "NORMAL" else f"ALERT_{self.scenario}"
        }

    def _synthesize_ecg(self, phase: float) -> float:
        """Mathematical model of standard P-Q-R-S-T cardiac complex."""
        # Baseline is 0
        val = 0.0
        # P-wave: atrial depolarization (phase ~ 0.15 - 0.25)
        if 0.15 <= phase <= 0.25:
            val += 0.15 * math.sin((phase - 0.15) / 0.10 * math.pi)
        # Q-wave: septal depolarization (phase ~ 0.32 - 0.35)
        elif 0.32 <= phase <= 0.35:
            val -= 0.15 * math.sin((phase - 0.32) / 0.03 * math.pi)
        # R-wave: ventricular depolarization peak (phase ~ 0.35 - 0.40)
        elif 0.35 <= phase <= 0.40:
            val += 1.25 * math.sin((phase - 0.35) / 0.05 * math.pi)
        # S-wave: late ventricular depolarization (phase ~ 0.40 - 0.43)
        elif 0.40 <= phase <= 0.43:
            val -= 0.25 * math.sin((phase - 0.40) / 0.03 * math.pi)
        # T-wave: ventricular repolarization (phase ~ 0.55 - 0.70)
        elif 0.55 <= phase <= 0.70:
            val += 0.30 * math.sin((phase - 0.55) / 0.15 * math.pi)
        return val


class SerialHardwareAdapter:
    """
    Interface for real physical microcontroller hardware (e.g., ESP32 with MAX30102 / AD8232).
    Reads JSON or CSV lines from USB/Serial COM port.
    """
    def __init__(self, port: str = "AUTO", baudrate: int = 115200):
        self.port = port
        self.baudrate = baudrate
        self.serial_conn = None
        self.is_connected = False

    def list_available_ports(self) -> List[Dict[str, str]]:
        try:
            import serial.tools.list_ports
            ports = serial.tools.list_ports.comports()
            return [{"port": p.device, "description": p.description, "hwid": p.hwid} for p in ports]
        except Exception as e:
            logger.warning(f"Unable to query serial ports: {e}")
            return []

    def connect(self) -> bool:
        try:
            import serial
            ports = self.list_available_ports()
            target_port = self.port
            if target_port == "AUTO":
                if not ports:
                    logger.info("No physical serial hardware ports detected. Ingestion will operate in software gateway mode.")
                    return False
                target_port = ports[0]["port"]

            self.serial_conn = serial.Serial(target_port, self.baudrate, timeout=1.0)
            self.is_connected = True
            logger.info(f"Connected to serial sensor gateway at {target_port}")
            return True
        except Exception as e:
            logger.info(f"Serial hardware not connected ({e}). Prototype operating in simulation & network gateway mode.")
            self.is_connected = False
            return False

    def read_telemetry_packet(self) -> Optional[Dict[str, Any]]:
        if not self.is_connected or not self.serial_conn:
            return None
        try:
            line = self.serial_conn.readline().decode("utf-8").strip()
            if not line:
                return None
            data = json.loads(line)
            data["provenance"] = PROVENANCE_LIVE
            return data
        except Exception as e:
            logger.error(f"Error parsing serial stream: {e}")
            return None

class SensorGatewayManager:
    """
    Central hub managing multi-astronaut data feeds, physical sensor adapters,
    data persistence, and broadcasting.
    """
    def __init__(self):
        self.astronaut_simulators: Dict[str, SyntheticTelemetryGenerator] = {
            "ASTRA-01": SyntheticTelemetryGenerator("ASTRA-01", "CDR Alex Mercer", baseline_hr=68.0, baseline_spo2=98.5),
            "ASTRA-04": SyntheticTelemetryGenerator("ASTRA-04", "Dr. Sarah Chen", baseline_hr=68.0, baseline_spo2=99.0)
        }
        self.serial_adapter = SerialHardwareAdapter()
        self.is_running = False
        self.subscribers = []
        self._lock = threading.Lock()
        self.t_counter = 0.0

    def get_latest_readings(self) -> Dict[str, Dict[str, Any]]:
        readings = {}
        for astro_id, sim in self.astronaut_simulators.items():
            readings[astro_id] = sim.generate_step(self.t_counter)
        return readings

    def tick(self) -> Dict[str, Dict[str, Any]]:
        self.t_counter += 1.0
        return self.get_latest_readings()

    def set_astronaut_scenario(self, astronaut_id: str, scenario: str, noise=False):
        if astronaut_id in self.astronaut_simulators:
            self.astronaut_simulators[astronaut_id].set_scenario(scenario, noise)
            logger.info(f"Astronaut {astronaut_id} scenario updated to: {scenario} (noise={noise})")

    def save_telemetry_batch(self, telemetry_dict: Dict[str, Dict[str, Any]]):
        """Persists validated telemetry frames into local SQLite DB."""
        conn = get_connection()
        cursor = conn.cursor()
        rows = []
        for astro_id, data in telemetry_dict.items():
            rows.append((
                data["astronaut_id"],
                data["timestamp"],
                data["hr"],
                data["hrv"],
                data["spo2"],
                data["resp_rate"],
                data["bp_sys"],
                data["bp_dia"],
                data["temp_c"],
                data["ecg_amplitude"],
                data["activity_g"],
                data["sqi"],
                data["provenance"],
                data["sensor_id"]
            ))
        cursor.executemany("""
        INSERT INTO telemetry (
            astronaut_id, timestamp, hr, hrv, spo2, resp_rate,
            bp_sys, bp_dia, temp_c, ecg_amplitude, activity_g,
            sqi, provenance, sensor_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, rows)
        conn.commit()
        conn.close()

# Singleton gateway instance
gateway = SensorGatewayManager()

if __name__ == "__main__":
    print("Testing Sensor Gateway...")
    readings = gateway.tick()
    for astro_id, packet in readings.items():
        print(f"[{astro_id}] HR: {packet['hr']} bpm, SpO2: {packet['spo2']}%, ECG: {packet['ecg_amplitude']} mV, Prov: {packet['provenance']}")
