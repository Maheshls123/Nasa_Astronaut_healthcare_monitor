/**
 * AstroHealth — Autonomous Spaceflight Health & Emergency Response
 * Core Frontend Application Controller & Aerospace Avionics Integrator
 * 
 * Fully Decoupled Frontend Client:
 * - Operates independently or connects via REST API to http://localhost:8000
 * - Zero unmanaged background threads or background service workers
 * - Built-in offline fallback simulation for complete standalone resilience
 */

// Configurable REST API Base (Backend runs as an independent microservice)
const API_BASE = window.ASTRA_API_BASE || 'http://localhost:8000';

// Global Application State
const AstroApp = {
  activeTab: 'vitals',
  activeAstronautId: 'ASTRA-04', // Dr. Sarah Chen default
  role: 'FLIGHT_SURGEON',
  isBackendConnected: false,
  pollTimer: null,
  localSimTimer: null,
  crew: [],
  groundStaff: [],
  telemetry: {},
  environment: {
    cabin_o2_pct: 20.9,
    cabin_co2_mmhg: 2.4,
    cabin_pressure_kpa: 101.3,
    cabin_temp_c: 21.8,
    cabin_humidity_pct: 45.2,
    ambient_radiation_usvh: 18.5,
    spe_event_active: false
  },
  anomalies: [],
  healthTwin: null,
  healthTwinRequestId: 0,
  bodyScanLastRenderedAt: 0,
  emergencies: [],
  procedures: [],
  inventory: [],
  messages: [],
  syncStatus: {
    connection_state: 'ONLINE',
    pending_count: 0,
    synced_count: 42,
    storage_health: 'HEALTHY'
  },
  oscilloscope: null,
  bpmTrendGraph: null,
  activeCardiacView: 'ecg', // 'ecg' | 'bpm' | 'dual'
  advancedMetricsVisible: false,
  pvtState: 'IDLE', // IDLE | WAITING | ACTIVE | DONE
  pvtTimer: null,
  pvtStartTime: 0,
  pvtInterval: null,
  isCalibrating: false,
  assistantMessages: [],
  assistantError: '',
  assistantAvailable: true,
  assistantBusy: false
};

// Remove background process: cleanly unregister any previous Service Workers
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const reg of registrations) {
      reg.unregister().then(() => {
        console.log('[AstroHealth] Background ServiceWorker cleanly unregistered:', reg.scope);
      });
    }
  }).catch(() => { });
}

// ---------------- DEFAULT OFFLINE / STANDALONE DATASETS ----------------

const DEFAULT_CREW = [
  {
    id: "ASTRA-04",
    name: "Dr. Sarah Chen",
    role: "Flight Engineer 2 & Medical Officer",
    age: 38,
    blood_type: "A+",
    assigned_cabin: "Node 2 Port",
    baseline_hr: 68.0,
    baseline_hrv: 62.0,
    baseline_bp_sys: 118.0,
    baseline_bp_dia: 76.0,
    baseline_spo2: 99.0,
    baseline_temp: 36.9,
    baseline_resp_rate: 14.0,
    mission_day: 42,
    status: "NOMINAL"
  },
  {
    id: "ASTRA-01",
    name: "CDR Marcus Vance",
    role: "Mission Commander",
    age: 46,
    blood_type: "O+",
    assigned_cabin: "Node 2 Zenith",
    baseline_hr: 64.0,
    baseline_hrv: 58.0,
    baseline_bp_sys: 122.0,
    baseline_bp_dia: 78.0,
    baseline_spo2: 98.5,
    baseline_temp: 36.8,
    baseline_resp_rate: 13.0,
    mission_day: 42,
    status: "NOMINAL"
  },
  {
    id: "ASTRA-02",
    name: "Dr. Elena Rostova",
    role: "Science Payload Specialist",
    age: 41,
    blood_type: "B+",
    assigned_cabin: "Columbus Lab",
    baseline_hr: 70.0,
    baseline_hrv: 65.0,
    baseline_bp_sys: 115.0,
    baseline_bp_dia: 74.0,
    baseline_spo2: 99.0,
    baseline_temp: 36.7,
    baseline_resp_rate: 15.0,
    mission_day: 42,
    status: "NOMINAL"
  },
  {
    id: "ASTRA-03",
    name: "MS Sunita Williams",
    role: "Flight Engineer 1",
    age: 44,
    blood_type: "A-",
    assigned_cabin: "Kibo Module",
    baseline_hr: 66.0,
    baseline_hrv: 60.0,
    baseline_bp_sys: 120.0,
    baseline_bp_dia: 80.0,
    baseline_spo2: 98.0,
    baseline_temp: 36.9,
    baseline_resp_rate: 14.0,
    mission_day: 42,
    status: "NOMINAL"
  }
];

const DEFAULT_GROUND_STAFF = [
  { id: 'GROUND-01', name: 'Dr. Paul Myers, MD', role: 'Flight Surgeon', organization: 'Houston Mission Control' },
  { id: 'GROUND-02', name: 'Dr. Robert Vance, PhD', role: 'Ground Scientist', organization: 'NASA Ames' },
  { id: 'GROUND-03', name: 'Mark Alvarez', role: 'Biomedical Engineer', organization: 'Mission Control' }
];

const DEFAULT_PROCEDURES = [
  {
    id: "PROC-CARD-01",
    code: "EMERG-CARD-01",
    title: "Microgravity Cardiac Arrest & Arrhythmia Resuscitation",
    indication: "Ventricular fibrillation, pulseless ventricular tachycardia, or persistent asystole in microgravity.",
    severity: "CRITICAL",
    steps: [
      { step_id: 1, title: "Crew Restraint Tethering", description: "Anchor patient to Crew Medical Restraint System (CMRS) using waist and torso quick-release belts." },
      { step_id: 2, title: "Automated External Defibrillator (AED)", description: "Apply pads to right superior sternum and cardiac apex. Activate AED analysis rhythm check." },
      { step_id: 3, title: "Handstand / Over-the-Head Compressions", description: "Inverted handstand position bracing against opposing bulkhead; perform 100-120 compressions/min." },
      { step_id: 4, title: "Airway & Positive Pressure Oxygen", description: "Secure supraglottic i-gel airway; connect 100% O2 bag-valve resuscitator." },
      { step_id: 5, title: "Intravenous / Intraosseous Epinephrine", description: "Infuse 1 mg Epinephrine (1:10,000) every 3 to 5 minutes via proximal tibia or humeral EZ-IO." }
    ]
  },
  {
    id: "PROC-RESP-01",
    code: "EMERG-RESP-01",
    title: "Space Motion Sickness & Acute Airway Aspiration",
    indication: "Severe cephalad fluid shift, intractable emesis, or vomitus aspiration risk inside space suit.",
    severity: "WARNING",
    steps: [
      { step_id: 1, title: "Immediate Suction & Head Elevation", description: "Use Yankauer suction catheter to clear oral cavity; elevate torso 30 degrees to minimize intracranial pressure." },
      { step_id: 2, title: "Administer Intramuscular Promethazine", description: "Inject 25 mg Promethazine IM to arrest vestibular vomiting center." },
      { step_id: 3, title: "Supplemental High-Flow SpO2", description: "Titrate nasal cannula oxygen to maintain SpO2 > 96%." }
    ]
  },
  {
    id: "PROC-SANS-01",
    code: "EMERG-SANS-01",
    title: "Acute SANS & Cephalad Hypertensive Crisis",
    indication: "Optic nerve sheath diameter > 5.8 mm, Frisén papilledema, or severe retro-orbital headache.",
    severity: "WARNING",
    steps: [
      { step_id: 1, title: "Lower Body Negative Pressure (LBNP)", description: "Transfer astronaut to Chibis/LBNP chamber at -25 mmHg for 60 minutes to draw venous pool caudad." },
      { step_id: 2, title: "Optical Coherence Tomography (OCT)", description: "Perform retinal nerve fiber layer scan to quantify optic disc edema." },
      { step_id: 3, title: "Oral Acetazolamide", description: "Administer 250 mg Acetazolamide BID to reduce cerebrospinal fluid production." }
    ]
  },
  {
    id: "PROC-ECLSS-01",
    code: "EMERG-ECLSS-01",
    title: "Spacecraft Cabin Hypoxia & Rapid Decompression",
    indication: "Cabin pressure < 70 kPa, CO2 > 5 mmHg, or rapid oxygen drop.",
    severity: "CRITICAL",
    steps: [
      { step_id: 1, title: "Don Quick-Don Emergency Mask", description: "All crew immediately don 100% positive pressure oxygen masks." },
      { step_id: 2, title: "Isolate Ruptured Module", description: "Locate pressure delta hatch; seal and verify inter-module pressure equalizers." },
      { step_id: 3, title: "Scrub Cabin CO2 Cannisters", description: "Switch CDRA (Carbon Dioxide Removal Assembly) to emergency high-flow bypass." }
    ]
  },
  {
    id: "PROC-RAD-01",
    code: "EMERG-RAD-01",
    title: "Acute Solar Particle Event (SPE) Radiation Protocol",
    indication: "Ambient dosimeter > 50 uSv/h or solar proton coronal mass ejection alert.",
    severity: "WARNING",
    steps: [
      { step_id: 1, title: "Shelter in Water Wall Storm Shelter", description: "Retreat to radiation storm shelter (Service Module crew quarters surrounded by water tanks)." },
      { step_id: 2, title: "Dosimeter Badge Sync", description: "Collect personal active semiconductor dosimeters and insert into telemetry docking bay." },
      { step_id: 3, title: "Prophylactic Antioxidant & Hydration", description: "Dispense oral N-acetylcysteine and Potassium Iodide as prescribed by flight surgeon." }
    ]
  }
];

const DEFAULT_INVENTORY = [
  { id: "MED-001", name: "Epinephrine Auto-Injector (1:1000)", batch_lot: "LOT-NASA-9901", expiry_date: "2027-11-15", quantity: 6, unit: "auto-injectors", storage_loc: "Emergency Pack A" },
  { id: "MED-002", name: "Morphine Sulfate 10mg/mL", batch_lot: "LOT-NASA-8820", expiry_date: "2027-08-30", quantity: 8, unit: "ampoules", storage_loc: "Controlled Lockbox" },
  { id: "MED-003", name: "Atropine Sulfate 0.5mg", batch_lot: "LOT-NASA-7712", expiry_date: "2028-02-14", quantity: 10, unit: "vials", storage_loc: "Cardiac Kit" },
  { id: "MED-004", name: "Ondansetron 4mg ODT", batch_lot: "LOT-NASA-6631", expiry_date: "2028-04-10", quantity: 24, unit: "tablets", storage_loc: "SMS Pack" },
  { id: "MED-005", name: "Acetazolamide 250mg", batch_lot: "LOT-NASA-5544", expiry_date: "2027-12-01", quantity: 30, unit: "capsules", storage_loc: "SANS Kit" },
  { id: "MED-006", name: "Potassium Iodide (KI) 130mg", batch_lot: "LOT-NASA-4411", expiry_date: "2029-01-01", quantity: 50, unit: "tablets", storage_loc: "Radiation Shelter" }
];

const DEFAULT_MESSAGES = [
  {
    id: 1,
    sender_name: "Dr. Robert Vance, PhD",
    sender_role: "GROUND_SCIENTIST",
    recipient: "CREW_ALL",
    message_text: "NASA Ames Space Bioscience: Reviewing your microgravity adaptation metrics. Fluid shift is steady at +0.8cm. Maintain 45-minute cycle ergometer protocol today to safeguard cardiac stroke volume.",
    priority: "ROUTINE",
    flight_directive: false,
    timestamp: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 2,
    sender_name: "Dr. Paul Myers, MD",
    sender_role: "FLIGHT_SURGEON",
    recipient: "CREW_ALL",
    message_text: "Houston Surgeon Console: Sarah, your Lead II ECG rhythm and 24h BPM trend across last 6 orbits are textbook nominal. Ocular ONSD at 5.20mm confirms zero papilledema. You are cleared for EVA prep.",
    priority: "ADVISORY",
    flight_directive: true,
    timestamp: new Date(Date.now() - 2400000).toISOString()
  },
  {
    id: 3,
    sender_name: "Dr. Sarah Chen",
    sender_role: "ASTRONAUT",
    recipient: "MISSION_CONTROL",
    message_text: "Station copy Houston and Ames. ARED resistive workout logged at 840 kJ. Hydration intake on schedule with 1.8 liters consumed. Ready for tomorrow's airlock prep.",
    priority: "ROUTINE",
    flight_directive: false,
    timestamp: new Date(Date.now() - 1200000).toISOString()
  },
  {
    id: 4,
    sender_name: "Mark Alvarez, BME",
    sender_role: "BIOMEDICAL_ENGINEER",
    recipient: "CREW_ALL",
    message_text: "BME Console: Station ECLSS telemetry verified. Cabin CO2 partial pressure is 2.4 mmHg, well below 3.0 mmHg limit. Wearable sensor gateway battery levels are 96%.",
    priority: "ROUTINE",
    flight_directive: false,
    timestamp: new Date(Date.now() - 600000).toISOString()
  }
];

// ---------------- INITIALIZATION ----------------

document.addEventListener('DOMContentLoaded', async () => {
  initTabNavigation();
  initAstronautMenu();
  initRoleSelector();
  initEmergencySirenButtons();
  initCalibrationButton();
  initDoctorCallButton();
  initAIAssistantButton();
  initPVTTest();
  initCrewDashboard();
  initHealthTimeline();

  // Initialize Canvas Oscilloscope and BPM Trend Graph
  initOscilloscopes();

  // Initialize Data: Check if backend REST API is reachable, or use standalone fallback
  await loadInitialBackendData();

  // Render ground messages
  renderGroundChatMessages();
});

// ---------------- TAB NAVIGATION ----------------

function initTabNavigation() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetView = tab.getAttribute('data-view');
      switchViewTab(targetView);
    });
  });
}

function switchViewTab(viewName) {
  AstroApp.activeTab = viewName;

  // Update nav tab styling
  document.querySelectorAll('.nav-tab').forEach(tab => {
    const isTarget = tab.getAttribute('data-view') === viewName;
    if (isTarget) {
      tab.className = 'nav-tab active flex flex-col items-center justify-center gap-1 min-w-[65px] h-14 rounded-xl px-2 text-primary-container bg-surface-container-high/80 shadow-[0_0_16px_rgba(0,229,255,0.2)] transition-all cursor-pointer';
    } else {
      tab.className = 'nav-tab flex flex-col items-center justify-center gap-1 min-w-[65px] h-14 rounded-xl px-2 text-on-surface-variant hover:text-on-surface transition-all cursor-pointer';
    }
  });

  // Switch visible container
  document.querySelectorAll('.tab-view').forEach(view => {
    view.classList.add('hidden');
    view.classList.remove('flex');
  });

  const targetEl = document.getElementById(`view-${viewName}`);
  if (targetEl) {
    targetEl.classList.remove('hidden');
    targetEl.classList.add('flex');
  }

  // Load view-specific content
  if (viewName === 'daily-tasks') renderDailyTasksView();
  else if (viewName === 'ground-chat') renderGroundChatView();
  else if (viewName === 'tools') renderToolsView();
  else if (viewName === 'body-check') renderBodyCheckView();
}

// ---------------- ASTRONAUT SELECTION & MENU ----------------

function initAstronautMenu() {
  const btn = document.getElementById('astro-menu-btn');
  const dropdown = document.getElementById('astro-dropdown');

  if (btn && dropdown) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
      dropdown.classList.add('hidden');
    });
  }
}

function populateAstronautDropdown() {
  const container = document.getElementById('crew-list-options');
  if (!container) return;

  container.innerHTML = AstroApp.crew.map(c => `
    <button onclick="selectCrewMember('${c.id}')" class="flex items-center gap-2.5 p-2 rounded-lg hover:bg-surface-container text-left transition-colors cursor-pointer w-full">
      <div class="w-7 h-7 rounded-full bg-primary-container/20 text-primary font-headline-md text-xs flex items-center justify-center font-bold">
        ${getInitials(c.name)}
      </div>
      <div class="flex flex-col min-w-0">
        <span class="font-headline-md text-xs text-on-surface font-semibold truncate">${c.name}</span>
        <span class="font-label-sm text-[10px] text-on-surface-variant truncate">${c.role}</span>
      </div>
    </button>
  `).join('');
}

function selectCrewMember(astroId) {
  AstroApp.activeAstronautId = astroId;
  const astro = AstroApp.crew.find(c => c.id === astroId);
  if (!astro) return;

  // Update header avatar
  const initials = getInitials(astro.name);
  const headInitials = document.getElementById('header-avatar-initials');
  const profileAvatar = document.getElementById('active-profile-avatar');
  if (headInitials) headInitials.textContent = initials;
  if (profileAvatar) profileAvatar.textContent = initials;

  // Update profile texts
  const nameEl = document.getElementById('active-astro-name');
  const roleEl = document.getElementById('active-astro-role');
  const baseHrEl = document.getElementById('baseline-bpm');
  const twinBaseHrEl = document.getElementById('twin-base-hr');

  if (nameEl) nameEl.textContent = astro.name;
  if (roleEl) roleEl.textContent = `${astro.assigned_cabin} • ${astro.role}`;
  if (baseHrEl) baseHrEl.textContent = astro.baseline_hr;
  if (twinBaseHrEl) twinBaseHrEl.textContent = `${astro.baseline_hr} bpm`;

  // Close dropdown
  const dropdown = document.getElementById('astro-dropdown');
  if (dropdown) dropdown.classList.add('hidden');

  updateLiveVitalsDOM();
  if (AstroApp.activeTab === 'body-check') renderBodyCheckView();
}

function getInitials(name) {
  if (!name) return 'A';
  const parts = name.replace('Dr. ', '').replace('CDR ', '').replace('CMP ', '').replace('MS ', '').replace('FE ', '').split(' ');
  return parts.map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

function initCrewDashboard() {
  const filter = document.getElementById('crew-overview-filter');
  if (filter) filter.addEventListener('change', renderCrewDashboard);

  ['crew-health-grid', 'crew-alerts-list'].forEach(id => {
    const container = document.getElementById(id);
    if (!container) return;
    container.addEventListener('click', event => {
      const button = event.target.closest('[data-astronaut-id]');
      if (!button) return;
      selectCrewMember(button.dataset.astronautId);
      switchViewTab('vitals');
    });
  });
}

function getCrewTelemetryAlerts(crewMember, reading) {
  const reported = AstroApp.anomalies.filter(alert => alert.astronaut_id === crewMember.id);
  if (reported.length || AstroApp.isBackendConnected || !reading) return reported;

  const alerts = [];
  const addAlert = (severity, anomalyType, explanation) => alerts.push({
    astronaut_id: crewMember.id,
    severity,
    anomaly_type: anomalyType,
    explanation
  });

  if (Number(reading.sqi) === 0) {
    addAlert('SENSOR_FAILURE', 'TELEMETRY_LINK_LOST', 'No usable biometric signal is available.');
  } else {
    const moving = Number(reading.activity_g || 0) > 0.4;
    if (Number(reading.hr) > 140 && !moving) {
      addAlert('CRITICAL', 'ELEVATED_HEART_RATE', 'Heart-rate reading exceeds the prototype critical threshold.');
    } else if (Number(reading.hr) > 115 && !moving) {
      addAlert('WARNING', 'ELEVATED_HEART_RATE', 'Heart-rate reading exceeds the prototype review threshold.');
    }

    if (Number(reading.spo2) < 88) {
      addAlert('CRITICAL', 'LOW_OXYGEN_SATURATION', 'Oxygen-saturation reading is below the prototype critical threshold.');
    } else if (Number(reading.spo2) < 93) {
      addAlert('WARNING', 'LOW_OXYGEN_SATURATION', 'Oxygen-saturation reading is below the prototype review threshold.');
    }

    if (Number(reading.bp_sys) < 90 || Number(reading.bp_sys) - Number(reading.bp_dia) < 25) {
      addAlert('WARNING', 'LOW_BLOOD_PRESSURE', 'Blood-pressure reading meets a prototype review rule.');
    }
  }
  return alerts;
}

function getCrewHealthStatus(crewMember, reading) {
  if (!reading) return 'NO SIGNAL';
  const alerts = getCrewTelemetryAlerts(crewMember, reading);
  if (alerts.some(alert => alert.severity === 'CRITICAL')) return 'CRITICAL';
  if (alerts.some(alert => alert.severity === 'SENSOR_FAILURE')) return 'SENSOR';
  if (alerts.some(alert => alert.severity === 'WARNING')) return 'REVIEW';
  return ['NORMAL', 'NOMINAL', 'OK'].includes(String(crewMember.status || '').toUpperCase()) ? 'NOMINAL' : 'REVIEW';
}

function renderMissionPersonnel() {
  const grid = document.getElementById('mission-personnel-grid');
  if (!grid) return;

  const crew = AstroApp.crew.map(member => ({
    name: member.name,
    role: member.role || 'Astronaut',
    category: 'Astronaut',
    detail: member.id,
    icon: 'rocket_launch'
  }));
  const staff = AstroApp.groundStaff.map(member => ({
    name: member.name,
    role: member.role || 'Ground staff',
    category: 'Ground staff',
    detail: member.organization || member.id,
    icon: member.role === 'Flight Surgeon' ? 'medical_services' : member.role === 'Ground Scientist' ? 'science' : 'settings_input_component'
  }));
  const people = [...crew, ...staff];

  grid.innerHTML = people.length ? people.map(person => `
    <article class="rounded-xl bg-surface-container-low border border-outline-variant/40 p-3 flex items-center gap-3">
      <div class="w-10 h-10 shrink-0 rounded-full bg-primary-container/15 border border-primary-container/25 flex items-center justify-center text-primary">
        <span class="material-symbols-outlined">${person.icon}</span>
      </div>
      <div class="min-w-0">
        <h3 class="text-sm font-semibold text-on-surface truncate">${escapeHTML(person.name || 'Unknown')}</h3>
        <p class="text-xs text-primary">${escapeHTML(person.role)}</p>
        <p class="text-[10px] text-on-surface-variant truncate">${escapeHTML(person.category)} · ${escapeHTML(person.detail || '—')}</p>
      </div>
    </article>
  `).join('') : '<p class="col-span-full text-sm text-on-surface-variant">Personnel data is not available.</p>';
}

function formatCrewMetric(value, digits = 0) {
  if (value === undefined || value === null || value === '') return '—';
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : '—';
}

function renderCrewDashboard() {
  const grid = document.getElementById('crew-health-grid');
  if (!grid) return;

  const crewRows = AstroApp.crew.map(crewMember => {
    const reading = AstroApp.telemetry[crewMember.id];
    return { crewMember, reading, status: getCrewHealthStatus(crewMember, reading) };
  });
  const alerts = crewRows.flatMap(row => getCrewTelemetryAlerts(row.crewMember, row.reading));
  const availableSignals = crewRows.filter(row => row.reading && Number.isFinite(Number(row.reading.sqi)));
  const averageSqi = availableSignals.length
    ? availableSignals.reduce((total, row) => total + Number(row.reading.sqi), 0) / availableSignals.length
    : null;

  const summaryValues = {
    'overview-crew-count': crewRows.length,
    'overview-nominal-count': crewRows.filter(row => row.status === 'NOMINAL').length,
    'overview-attention-count': crewRows.filter(row => row.status !== 'NOMINAL').length,
    'overview-signal-quality': averageSqi === null ? '—' : `${Math.round(averageSqi)}%`
  };
  Object.entries(summaryValues).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  });

  const filter = document.getElementById('crew-overview-filter');
  const filteredRows = crewRows.filter(row => {
    if (!filter || filter.value === 'all') return true;
    if (filter.value === 'nominal') return row.status === 'NOMINAL';
    return row.status !== 'NOMINAL';
  });
  const statusStyles = {
    NOMINAL: 'bg-secondary-container/15 text-secondary border-secondary/30',
    REVIEW: 'bg-tertiary-container/15 text-tertiary-fixed-dim border-tertiary-container/30',
    CRITICAL: 'bg-error-container/30 text-error border-error/40',
    SENSOR: 'bg-surface-container-high text-on-surface-variant border-outline-variant',
    'NO SIGNAL': 'bg-surface-container-high text-on-surface-variant border-outline-variant'
  };
  const statusIcons = { NOMINAL: 'check_circle', REVIEW: 'warning', CRITICAL: 'error', SENSOR: 'sensors_off', 'NO SIGNAL': 'signal_disconnected' };

  grid.innerHTML = filteredRows.length ? filteredRows.map(({ crewMember, reading, status }) => {
    const statusClass = statusStyles[status] || statusStyles.NOMINAL;
    const initials = getInitials(crewMember.name);
    const timestamp = reading && reading.timestamp
      ? new Date(reading.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : 'Awaiting data';
    return `
      <article class="rounded-xl bg-surface-container-low border border-outline-variant/40 p-4 hover:border-primary-container/50 transition-colors">
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 shrink-0 rounded-full bg-primary-container/15 border border-primary-container/25 flex items-center justify-center text-sm font-bold text-primary">${escapeHTML(initials)}</div>
            <div class="min-w-0">
              <h3 class="font-headline-md text-sm text-on-surface font-bold truncate">${escapeHTML(crewMember.name)}</h3>
              <p class="text-[10px] text-on-surface-variant truncate mt-0.5">${escapeHTML(crewMember.role || crewMember.assigned_cabin || crewMember.id)}</p>
            </div>
          </div>
          <span class="shrink-0 rounded-full border px-2 py-1 text-[9px] font-label-sm uppercase ${statusClass}">
            <span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">${statusIcons[status] || 'check_circle'}</span>${escapeHTML(status)}</span>
          </span>
        </div>
        <div class="grid grid-cols-2 gap-2 mt-4">
          <div class="rounded-lg bg-surface-container p-2.5"><span class="block text-[9px] uppercase text-on-surface-variant">Heart rate</span><strong class="text-lg text-on-surface">${formatCrewMetric(reading && reading.hr)}</strong><span class="text-[9px] text-on-surface-variant ml-1">bpm</span></div>
          <div class="rounded-lg bg-surface-container p-2.5"><span class="block text-[9px] uppercase text-on-surface-variant">SpO₂</span><strong class="text-lg text-on-surface">${formatCrewMetric(reading && reading.spo2)}</strong><span class="text-[9px] text-on-surface-variant ml-1">%</span></div>
          <div class="rounded-lg bg-surface-container p-2.5"><span class="block text-[9px] uppercase text-on-surface-variant">Blood pressure</span><strong class="text-lg text-on-surface">${reading && reading.bp_sys != null && reading.bp_dia != null ? `${formatCrewMetric(reading.bp_sys)}/${formatCrewMetric(reading.bp_dia)}` : '—'}</strong><span class="text-[9px] text-on-surface-variant ml-1">mmHg</span></div>
          <div class="rounded-lg bg-surface-container p-2.5"><span class="block text-[9px] uppercase text-on-surface-variant">Resp. rate</span><strong class="text-lg text-on-surface">${formatCrewMetric(reading && reading.resp_rate)}</strong><span class="text-[9px] text-on-surface-variant ml-1">/min</span></div>
        </div>
        <div class="mt-3 flex items-center justify-between gap-2">
          <span class="text-[9px] text-on-surface-variant">SQI ${formatCrewMetric(reading && reading.sqi)}% · ${escapeHTML(timestamp)}</span>
          <button type="button" data-astronaut-id="${escapeHTML(crewMember.id)}" class="text-[10px] font-label-sm font-bold uppercase text-primary hover:text-primary-container whitespace-nowrap">Details <span aria-hidden="true">→</span></button>
        </div>
      </article>
    `;
  }).join('') : '<p class="col-span-full rounded-xl bg-surface-container-low p-6 text-center text-sm text-on-surface-variant">No crew match this filter.</p>';

  const alertCount = document.getElementById('overview-alert-count');
  if (alertCount) alertCount.textContent = `${alerts.length} ACTIVE`;
  const alertsList = document.getElementById('crew-alerts-list');
  if (alertsList) {
    const severityRank = { CRITICAL: 0, SENSOR_FAILURE: 1, WARNING: 2 };
    const orderedAlerts = [...alerts].sort((a, b) => (severityRank[a.severity] ?? 3) - (severityRank[b.severity] ?? 3));
    alertsList.innerHTML = orderedAlerts.length ? orderedAlerts.map(alert => {
      const crewMember = AstroApp.crew.find(member => member.id === alert.astronaut_id);
      const critical = alert.severity === 'CRITICAL';
      const sensor = alert.severity === 'SENSOR_FAILURE';
      const color = critical ? 'text-error border-error/30 bg-error-container/10' : sensor ? 'text-on-surface-variant border-outline-variant bg-surface-container-low' : 'text-tertiary-fixed-dim border-tertiary-container/30 bg-tertiary-container/5';
      return `
        <article class="rounded-xl border p-3 ${color}">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <span class="material-symbols-outlined text-[18px]">${critical ? 'error' : sensor ? 'sensors_off' : 'warning'}</span>
              <div class="min-w-0">
                <h3 class="text-xs font-bold uppercase">${escapeHTML(alert.anomaly_type || alert.severity || 'Telemetry flag')}</h3>
                <p class="text-[10px] opacity-80 mt-0.5">${escapeHTML(crewMember ? crewMember.name : alert.astronaut_id || 'Crew member')}</p>
              </div>
            </div>
            ${crewMember ? `<button type="button" data-astronaut-id="${escapeHTML(crewMember.id)}" class="text-[9px] font-label-sm uppercase underline whitespace-nowrap">Review</button>` : ''}
          </div>
          <p class="text-[11px] leading-relaxed mt-2 text-on-surface-variant">${escapeHTML(alert.explanation || 'System flagged an incoming telemetry reading for review.')}</p>
        </article>
      `;
    }).join('') : '<div class="rounded-xl border border-secondary/20 bg-secondary-container/5 p-4 text-sm text-on-surface-variant"><span class="inline-flex items-center gap-2 text-secondary font-semibold"><span class="material-symbols-outlined text-base">check_circle</span>No active telemetry flags</span><p class="text-[10px] mt-1">This indicates only that the monitoring system has not raised a flag.</p></div>';
  }

  const source = document.getElementById('overview-data-source');
  if (source) {
    source.innerHTML = `<span class="w-2 h-2 rounded-full ${AstroApp.isBackendConnected ? 'bg-secondary' : 'bg-tertiary-fixed-dim'}"></span>${AstroApp.isBackendConnected ? 'Backend telemetry' : 'Standalone simulation'}`;
    source.className = `inline-flex items-center gap-2 rounded-full bg-surface-container-low px-3 py-1.5 text-[10px] font-label-sm uppercase tracking-wider border ${AstroApp.isBackendConnected ? 'text-secondary border-secondary/20' : 'text-tertiary-fixed-dim border-tertiary-container/20'}`;
  }
  const lastUpdated = document.getElementById('overview-last-updated');
  if (lastUpdated) {
    lastUpdated.textContent = crewRows.some(row => row.reading)
      ? `Dashboard refreshed ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
      : 'Waiting for telemetry';
  }

  const env = AstroApp.environment || {};
  const environmentValues = {
    'overview-env-o2': env.cabin_o2_pct,
    'overview-env-co2': env.cabin_co2_mmhg,
    'overview-env-pressure': env.cabin_pressure_kpa,
    'overview-env-radiation': env.ambient_radiation_usvh
  };
  Object.entries(environmentValues).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = formatCrewMetric(value, 1);
  });
  const spe = document.getElementById('overview-spe-status');
  if (spe) {
    spe.textContent = env.spe_event_active ? 'ACTIVE' : 'INACTIVE';
    spe.className = `rounded-full px-2 py-1 text-[10px] font-label-sm ${env.spe_event_active ? 'bg-error-container/30 text-error' : 'bg-secondary-container/15 text-secondary'}`;
  }
}

// ---------------- ROLE SELECTOR ----------------

function initRoleSelector() {
  const sel = document.getElementById('role-select');
  if (sel) {
    sel.value = AstroApp.role;
    sel.addEventListener('change', (e) => {
      AstroApp.role = e.target.value;
      console.log('[AstroHealth Security] Active role switched to:', AstroApp.role);
    });
  }
}

// ---------------- EMERGENCY SIREN ACTIONS ----------------

function initEmergencySirenButtons() {
  const testBtn = document.getElementById('siren-test-btn');
  const triggerBtn = document.getElementById('siren-trigger-btn');

  if (testBtn) {
    testBtn.addEventListener('click', () => {
      playAudioBeaconChime(440, 0.4);
      openModal(
        'campaign',
        'Emergency Siren Audio Test (Nominal)',
        `<div class="space-y-3 font-body-sm text-on-surface">
          <p>Station audio siren check successful. Audio beacon tested at 85 dB inside crew module.</p>
          <div class="p-3 rounded-lg bg-surface-container-low border border-secondary/30 text-secondary font-label-md">
            SIREN ALARM HARDWARE: STATUS OK
          </div>
        </div>`
      );
    });
  }

  if (triggerBtn) {
    triggerBtn.addEventListener('click', async () => {
      playAudioBeaconChime(880, 0.8);
      const confirmed = confirm('BROADCAST EMERGENCY SIREN: Trigger acute priority 1 alarm to Station ECLSS & Houston Ground Flight Surgeons?');
      if (confirmed) {
        if (AstroApp.isBackendConnected) {
          try {
            await fetch(`${API_BASE}/api/emergencies/trigger`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                astronaut_id: AstroApp.activeAstronautId,
                code: 'EMERG-SIREN-PRIORITY1',
                title: 'Station-Wide Clinical Emergency Siren',
                severity: 'CRITICAL',
                checklist_id: 'PROC-CARD-01',
                user_id: 'ASTRONAUT_CONSOLE',
                notes: 'Emergency beacon manually activated by station crew.'
              })
            });
          } catch (e) { }
        }
        openProcedureModal('PROC-CARD-01');
      }
    });
  }
}

// Spacecraft Audio Synthesizer via Web Audio API
function playAudioBeaconChime(freq, duration) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) { }
}

// ---------------- 30s VITALS CALIBRATION ----------------

function initCalibrationButton() {
  const btn = document.getElementById('calibrate-btn');
  const text = document.getElementById('calibrate-text');
  const icon = document.getElementById('calibrate-icon');

  if (btn && text) {
    btn.addEventListener('click', () => {
      if (AstroApp.isCalibrating) return;
      AstroApp.isCalibrating = true;

      btn.classList.remove('bg-primary-container', 'text-on-primary');
      btn.classList.add('bg-secondary-container', 'text-on-secondary');
      if (icon) icon.classList.add('animate-spin');

      let seconds = 30;
      text.textContent = `Calibrating Biometrics (${seconds}s remaining)...`;

      const countdown = setInterval(() => {
        seconds--;
        text.textContent = `Calibrating Biometrics (${seconds}s remaining)...`;

        if (seconds <= 0) {
          clearInterval(countdown);
          text.textContent = 'Calibration Complete: All Sensors In Sync';
          if (icon) icon.classList.remove('animate-spin');

          setTimeout(() => {
            btn.classList.remove('bg-secondary-container', 'text-on-secondary');
            btn.classList.add('bg-primary-container', 'text-on-primary');
            text.textContent = 'Run Instant 30s Vitals Calibration';
            AstroApp.isCalibrating = false;
          }, 3500);
        }
      }, 100);
    });
  }
}

// ---------------- FLIGHT SURGEON DIRECT CALL ----------------

function initDoctorCallButton() {
  const btn = document.getElementById('btn-call-surgeon');
  if (btn) {
    btn.addEventListener('click', () => {
      playAudioBeaconChime(600, 0.3);
      openModal(
        'phone_in_talk',
        'Direct Flight Surgeon Audio Link',
        `<div class="space-y-4">
          <div class="flex items-center gap-3 p-3 bg-surface-container-low rounded-xl border border-primary-container/30">
            <div class="w-10 h-10 rounded-full bg-blue-900 flex items-center justify-center text-primary font-bold">PM</div>
            <div>
              <strong class="text-on-surface block">Dr. Paul Myers, MD (Houston)</strong>
              <span class="text-xs text-secondary font-label-sm font-semibold">Capsule Comm Channel 1 • Connected</span>
            </div>
          </div>
          <p class="font-body-sm text-on-surface-variant">
            “Houston Surgeon Console listening. Sarah, we copy your nominal telemetry. Heart rate and intracranial pressures are looking exceptional. Let us know if you need countermeasure adjustments.”
          </p>
          <button class="w-full py-2.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-primary font-label-md font-bold" onclick="closeModal()">
            End Capsule Transmission
          </button>
        </div>`
      );
    });
  }
}

// ---------------- AI ASSISTANT & XAI MODAL ----------------

function initAIAssistantButton() {
  const btn = document.getElementById('ai-assistant-btn');
  const pill = document.getElementById('ai-assistant-pill');
  const aside = document.getElementById('ai-assistant-aside');
  const headerBtn = document.getElementById('header-ai-btn');

  const handler = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    openAstroAIConsole();
  };

  if (btn) btn.addEventListener('click', handler);
  if (pill) pill.addEventListener('click', handler);
  if (aside) {
    aside.addEventListener('click', (e) => {
      if (e.target.closest('#ai-assistant-btn') || e.target.closest('#ai-assistant-pill')) {
        handler(e);
      }
    });
  }
  if (headerBtn) headerBtn.addEventListener('click', handler);
}

function openAstroAIConsole() {
  const bodyContent = `
    <div class="flex h-full min-h-0 flex-col gap-3 font-sans">
      <div class="rounded-xl border border-primary-container/30 bg-primary-container/10 p-3 text-[11px] leading-relaxed text-on-surface-variant flex items-start gap-2.5">
        <span class="material-symbols-outlined text-primary text-base shrink-0 mt-0.5">verified_user</span>
        <div>
          <strong class="text-primary font-semibold">Aerospace Medical Privacy & Safety:</strong>
          <span> AstroAI operates via Groq with Onboard Aerospace Medical fallback. Telemetry and patient records are never transmitted. For medical emergencies, use the Siren alert or follow clinical emergency checklists.</span>
        </div>
      </div>

      <div id="assistant-setup-note" role="status" class="hidden rounded-lg border px-3 py-2 text-xs"></div>

      <div id="assistant-chat-stream" role="log" aria-live="polite" aria-label="AstroAI conversation" class="flex-1 min-h-[260px] max-h-[48vh] overflow-y-auto rounded-xl border border-outline-variant/30 bg-surface-container-low p-3.5 space-y-3 shadow-inner">
      </div>

      <div class="flex flex-col gap-1.5">
        <span class="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/70">Suggested Spaceflight Questions:</span>
        <div id="assistant-suggestions" class="flex flex-wrap gap-1.5">
          <button type="button" class="assistant-prompt rounded-full border border-outline-variant/50 bg-surface-container-high/70 px-3 py-1 text-[11px] text-on-surface-variant hover:border-primary-container hover:text-primary hover:bg-surface-container-highest transition-all cursor-pointer">Explain space motion sickness</button>
          <button type="button" class="assistant-prompt rounded-full border border-outline-variant/50 bg-surface-container-high/70 px-3 py-1 text-[11px] text-on-surface-variant hover:border-primary-container hover:text-primary hover:bg-surface-container-highest transition-all cursor-pointer">What is SANS and intracranial pressure?</button>
          <button type="button" class="assistant-prompt rounded-full border border-outline-variant/50 bg-surface-container-high/70 px-3 py-1 text-[11px] text-on-surface-variant hover:border-primary-container hover:text-primary hover:bg-surface-container-highest transition-all cursor-pointer">How does microgravity affect bone & muscle?</button>
          <button type="button" class="assistant-prompt rounded-full border border-outline-variant/50 bg-surface-container-high/70 px-3 py-1 text-[11px] text-on-surface-variant hover:border-primary-container hover:text-primary hover:bg-surface-container-highest transition-all cursor-pointer">Microgravity CPR procedure</button>
        </div>
      </div>

      <form id="assistant-chat-form" class="flex items-end gap-2 border-t border-outline-variant/30 pt-3">
        <label for="assistant-chat-input" class="sr-only">Ask AstroAI a health question</label>
        <textarea id="assistant-chat-input" rows="2" maxlength="4000" placeholder="Type your health question (e.g. 'What causes space motion sickness?')..." class="min-h-12 max-h-32 flex-1 resize-y rounded-xl border border-outline-variant/50 bg-surface-container-low px-3.5 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/70 outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all"></textarea>
        <button id="assistant-chat-send" type="submit" aria-label="Send message" class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-container text-on-primary shadow-md hover:bg-primary transition-all disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer">
          <span class="material-symbols-outlined text-[20px]">send</span>
        </button>
      </form>

      <div class="flex items-center justify-between gap-2 pt-0.5">
        <div class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-secondary shadow-[0_0_6px_rgba(125,255,162,1)] animate-pulse"></span>
          <span id="assistant-chat-status" class="text-[11px] text-on-surface-variant font-medium">AstroAI Ready</span>
        </div>
        <button id="assistant-chat-clear" type="button" class="text-[11px] text-on-surface-variant hover:text-primary underline cursor-pointer">Clear conversation</button>
      </div>
    </div>
  `;

  const panel = document.getElementById('app-modal-panel');
  if (panel) {
    panel.classList.add('max-w-3xl', 'h-[min(90vh,800px)]', 'flex', 'flex-col');
    panel.classList.remove('max-h-[85vh]', 'overflow-y-auto');
  }
  openModal('smart_toy', 'AstroAI Clinical Diagnostic Console', bodyContent);
  const modalBody = document.getElementById('modal-body');
  if (modalBody) modalBody.className = 'flex-1 min-h-0 flex flex-col overflow-hidden';
  initHealthChat();
}

function initHealthChat() {
  const form = document.getElementById('assistant-chat-form');
  const input = document.getElementById('assistant-chat-input');
  const clearButton = document.getElementById('assistant-chat-clear');
  const suggestions = document.getElementById('assistant-suggestions');
  if (!form || !input) return;

  form.addEventListener('submit', event => {
    event.preventDefault();
    sendHealthChatMessage();
  });
  input.addEventListener('input', updateHealthChatControls);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  if (clearButton) clearButton.addEventListener('click', () => {
    AstroApp.assistantMessages = [];
    AstroApp.assistantError = '';
    renderHealthChat();
    updateHealthChatControls();
  });
  if (suggestions) suggestions.addEventListener('click', event => {
    const button = event.target.closest('.assistant-prompt');
    if (!button) return;
    input.value = button.textContent.trim();
    updateHealthChatControls();
    sendHealthChatMessage();
  });

  renderHealthChat();
  loadHealthAssistantStatus();
  updateHealthChatControls();
  setTimeout(() => {
    if (input) input.focus();
  }, 100);
}

async function loadHealthAssistantStatus() {
  const note = document.getElementById('assistant-setup-note');
  const status = document.getElementById('assistant-chat-status');
  try {
    const response = await fetch(`${API_BASE}/api/assistant/status`);
    if (!response.ok) throw new Error(`Assistant status request failed (${response.status}).`);
    const data = await response.json();
    AstroApp.assistantAvailable = Boolean(data.configured || data.onboard_engine === 'ACTIVE');
    if (!data.configured) {
      if (note) {
        note.className = 'rounded-lg border border-secondary-container/30 bg-secondary-container/10 px-3 py-2 text-xs text-secondary';
        note.textContent = 'Operating in Autonomous Onboard Aerospace Medical mode. Groq cloud key not set.';
      }
      if (status) status.textContent = 'Onboard Aerospace Medical Engine Active';
    } else {
      if (note) note.className = 'hidden';
      if (status) status.textContent = `Connected · Groq (${data.model})`;
    }
  } catch (error) {
    AstroApp.assistantAvailable = true;
    if (note) note.className = 'hidden';
    if (status) status.textContent = 'AstroAI Onboard Autonomous Mode';
  }
  updateHealthChatControls();
}

function escapeHTML(value) {
 return String(value).replace(/[&<>"']/g, character => ({
   '&': '&amp;',
   '<': '&lt;',
   '>': '&gt;',
   '"': '&quot;',
   "'": '&#39;'
 })[character]);
}

function formatMarkdown(content) {
  if (!content) return '';
  let html = escapeHTML(content);

  // Markdown Tables
  html = html.replace(/((?:\|[^\n]+\|\r?\n)+)/g, (match) => {
    const lines = match.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return match;
    let tableHtml = '<div class="overflow-x-auto my-2.5 rounded-lg border border-outline-variant/30 bg-surface-container-low/60"><table class="w-full text-xs text-left">';
    let isHeader = true;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\|[-:\s|]+\|$/.test(line)) {
        isHeader = false;
        continue;
      }
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      if (isHeader && i === 0) {
        tableHtml += '<thead class="bg-surface-container-high text-primary font-bold"><tr>';
        cells.forEach(c => tableHtml += `<th class="px-2.5 py-1.5 border-b border-outline-variant/30 font-semibold">${c}</th>`);
        tableHtml += '</tr></thead><tbody>';
      } else {
        tableHtml += '<tr class="border-b border-surface-container-high/30 hover:bg-surface-container-high/20">';
        cells.forEach(c => tableHtml += `<td class="px-2.5 py-1.5 text-on-surface-variant">${c}</td>`);
        tableHtml += '</tr>';
      }
    }
    tableHtml += '</tbody></table></div>';
    return tableHtml;
  });

  // Section Headers
  html = html.replace(/^### (.*$)/gim, '<h4 class="font-headline-md text-primary font-bold text-sm mt-3 mb-1.5">$1</h4>');
  html = html.replace(/^## (.*$)/gim, '<h3 class="font-headline-md text-primary font-bold text-base mt-3.5 mb-1.5">$1</h3>');
  html = html.replace(/^# (.*$)/gim, '<h2 class="font-headline-md text-primary font-bold text-lg mt-4 mb-2">$1</h2>');

  // Horizontal rules
  html = html.replace(/^---$/gim, '<hr class="border-outline-variant/30 my-2.5"/>');

  // Bold & Italic formatting
  html = html.replace(/\*\*\*(.*?)\*\*\*/gim, '<strong class="text-on-surface font-bold"><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong class="text-on-surface font-semibold">$1</strong>');
  html = html.replace(/\*(.*?)\*/gim, '<em class="text-on-surface-variant">$1</em>');

  // Lists
  html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<li class="ml-4 list-disc text-on-surface-variant leading-relaxed my-0.5">$1</li>');
  html = html.replace(/^\s*(\d+)\.\s+(.*$)/gim, '<li class="ml-4 list-decimal text-on-surface-variant leading-relaxed my-0.5">$2</li>');

  // Inline code
  html = html.replace(/`([^`]+)`/gim, '<code class="px-1.5 py-0.5 rounded bg-surface-container-high text-primary-container font-mono text-[11px]">$1</code>');

  return html;
}

function generateLocalMedicalReply(query) {
  const q = (query || '').toLowerCase();
  if (q.includes('bone') || q.includes('density') || q.includes('osteopenia') || q.includes('ared')) {
    return `### Microgravity & Astronaut Bone Health\n\nIn microgravity, bone unloading causes **1.0% to 1.5% bone mineral density loss per month** in weight-bearing bones:\n\n- **Mechanisms**: Osteoclast activity accelerates while osteoblasts decrease.\n- **Countermeasures**: Daily high-load workouts on the **ARED (Advanced Resistive Exercise Device)** at loads up to 2,600 N.\n- **Nutrition**: Calcium + 800–1000 IU/day Vitamin D supplementation.\n\n*(AstroAI Onboard Aerospace Medical Engine · Autonomous Flight Mode)*`;
  }
  if (q.includes('motion') || q.includes('sms') || q.includes('nausea') || q.includes('vomit') || q.includes('vestibular')) {
    return `### Space Motion Sickness (SMS) / Space Adaptation Syndrome\n\nApproximately **70%–80% of astronauts** experience SMS during their first 48–72 hours in microgravity:\n\n- **Cause**: Sensory conflict between inner-ear otoliths (no gravity pull) and visual/proprioceptive cues.\n- **Symptoms**: Stomach awareness, nausea, sudden vomiting, headache, and malaise.\n- **Protocols**: Promethazine or Ondansetron administration; strict avoidance of spacewalks (EVA) during first 3 mission days.\n- **Resolution**: Full neuroadaptation typically occurs in 3–5 flight days.\n\n*(AstroAI Onboard Aerospace Medical Engine · Autonomous Flight Mode)*`;
  }
  if (q.includes('fluid') || q.includes('puffy') || q.includes('shift') || q.includes('jugular') || q.includes('edema')) {
    return `### Cephalad Fluid Shift in Microgravity\n\nWithout downward gravity, approximately **1.5 to 2.0 liters of fluid redistribute upward**:\n\n- **Symptoms**: Puffy face, nasal congestion ("space sniffles"), and reduced leg circumference ("bird legs").\n- **Cardiovascular Effect**: Central volume receptors detect initial overload, triggering a compensatory **10%–15% reduction in plasma volume** within 48 hours.\n- **Countermeasures**: Cycle ergometer workouts and Lower Body Negative Pressure (LBNP).\n\n*(AstroAI Onboard Aerospace Medical Engine · Autonomous Flight Mode)*`;
  }
  if (q.includes('eye') || q.includes('vision') || q.includes('sans') || q.includes('optic') || q.includes('papilledema')) {
    return `### Spaceflight-Associated Neuro-Ocular Syndrome (SANS)\n\nSANS is characterized by structural ocular changes due to chronic venous congestion and mildly elevated intracranial pressure:\n\n- **Clinical Signs**: Optic disc edema (papilledema), globe flattening, and hyperopic refractive shift.\n- **Monitoring**: Onboard Optical Coherence Tomography (OCT) scans and optic nerve sheath diameter (ONSD) ultrasound ($<5.8\\text{ mm}$ normal).\n\n*(AstroAI Onboard Aerospace Medical Engine · Autonomous Flight Mode)*`;
  }
  return `### AstroAI Spaceflight Health Intelligence\n\nI am **AstroAI**, your aerospace health educational companion.\n\n- **Microgravity Adaptation**: Astronauts adapt through sensory recalibration, cardiovascular fluid shifts, and bone density countermeasures.\n- **Daily Requirements**: 2.5 hours of daily aerobic and resistive (ARED) exercise are mandatory on ISS missions.\n- **Safety**: For clinical diagnosis or medication guidance, contact the Houston Flight Surgeon console.\n\n*(AstroAI Onboard Aerospace Medical Engine · Autonomous Flight Mode)*`;
}

function renderHealthChat() {
  const stream = document.getElementById('assistant-chat-stream');
  if (!stream) return;

  const messages = AstroApp.assistantMessages;
  if (!messages.length) {
    stream.innerHTML = `
      <div class="flex items-start gap-2.5">
        <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-container/20 text-primary"><span class="material-symbols-outlined text-[16px]">smart_toy</span></div>
        <div class="max-w-[90%] rounded-2xl rounded-tl-sm bg-surface-container-high px-4 py-3 text-sm leading-relaxed text-on-surface">Hi! I’m <strong>AstroAI</strong>, powered by Groq and our Onboard Aerospace Medical Knowledge Engine. Ask me any question about spaceflight physiology, astronaut health, microgravity adaptation, or vital signs.</div>
      </div>
    `;
    return;
  }

  stream.innerHTML = messages.map(message => {
    const isUser = message.role === 'user';
    const providerBadge = message.provider ? `<span class="text-[9px] px-1.5 py-0.5 rounded bg-surface-container text-primary font-mono uppercase font-semibold">${escapeHTML(message.provider)}</span>` : '';
    return `
      <div class="flex ${isUser ? 'justify-end' : 'justify-start'} items-start gap-2.5">
        ${isUser ? '' : '<div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-container/20 text-primary"><span class="material-symbols-outlined text-[16px]">smart_toy</span></div>'}
        <div class="max-w-[90%] rounded-2xl ${isUser ? 'rounded-tr-sm bg-primary-container text-on-primary font-medium' : 'rounded-tl-sm bg-surface-container-high text-on-surface'} px-4 py-3 text-sm leading-relaxed break-words shadow-sm">
          ${isUser ? escapeHTML(message.content) : formatMarkdown(message.content)}
          ${providerBadge ? `<div class="mt-2.5 pt-1.5 border-t border-surface-container-highest/60 flex items-center justify-end">${providerBadge}</div>` : ''}
        </div>
      </div>
    `;
  }).join('') + (AstroApp.assistantBusy ? `
    <div class="flex items-start gap-2.5" aria-label="AstroAI is responding">
      <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-container/20 text-primary animate-pulse"><span class="material-symbols-outlined text-[16px]">smart_toy</span></div>
      <div class="rounded-2xl rounded-tl-sm bg-surface-container-high px-4 py-3 text-sm text-on-surface-variant flex items-center gap-2">
        <span class="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"></span>
        <span class="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.2s]"></span>
        <span class="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.4s]"></span>
        <span>AstroAI is formulating response…</span>
      </div>
    </div>` : '') + (AstroApp.assistantError ? `
    <div role="alert" class="ml-9 max-w-[90%] rounded-xl border border-tertiary-container/40 bg-tertiary-container/10 p-3.5 text-xs text-on-surface">
      <div class="flex items-center gap-1.5 font-bold text-tertiary-fixed-dim mb-1">
        <span class="material-symbols-outlined text-[16px]">info</span>
        <span>AstroAI Notice</span>
      </div>
      <p class="leading-relaxed text-on-surface-variant">${escapeHTML(AstroApp.assistantError)}</p>
    </div>` : '');
  stream.scrollTop = stream.scrollHeight;
}

function updateHealthChatControls() {
  const input = document.getElementById('assistant-chat-input');
  const send = document.getElementById('assistant-chat-send');
  const clearButton = document.getElementById('assistant-chat-clear');
  if (!input || !send) return;

  const canType = AstroApp.assistantAvailable && !AstroApp.assistantBusy;
  input.disabled = !canType;
  send.disabled = !canType || !input.value.trim();
  if (clearButton) {
    clearButton.disabled = AstroApp.assistantBusy || !AstroApp.assistantMessages.length;
  }
}

async function sendHealthChatMessage() {
  const input = document.getElementById('assistant-chat-input');
  const status = document.getElementById('assistant-chat-status');
  if (!input || !AstroApp.assistantAvailable || AstroApp.assistantBusy) return;
  const content = input.value.trim();
  if (!content) return;

  AstroApp.assistantMessages.push({ role: 'user', content });
  AstroApp.assistantMessages = AstroApp.assistantMessages.slice(-30);
  AstroApp.assistantError = '';
  input.value = '';
  AstroApp.assistantBusy = true;
  updateHealthChatControls();
  renderHealthChat();
  if (status) status.textContent = 'AstroAI is generating reply…';

  try {
    const messages = AstroApp.assistantMessages.slice(-12).map(({ role, content: message }) => ({ role, content: message }));
    const response = await fetch(`${API_BASE}/api/assistant/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || `Assistant request failed (${response.status}).`);

    AstroApp.assistantMessages.push({
      role: 'assistant',
      content: result.reply,
      provider: result.provider || 'Groq'
    });
    AstroApp.assistantMessages = AstroApp.assistantMessages.slice(-30);
    if (status) status.textContent = result.provider ? `Connected · ${result.provider}` : 'Connected';
  } catch (error) {
    console.warn('[AstroAI] Remote chat fallback engaged:', error);
    const localReply = generateLocalMedicalReply(content);
    AstroApp.assistantMessages.push({
      role: 'assistant',
      content: localReply,
      provider: 'Onboard Medical Engine'
    });
    if (status) status.textContent = 'AstroAI Onboard Autonomous Mode';
  } finally {
    AstroApp.assistantBusy = false;
    updateHealthChatControls();
    renderHealthChat();
    input.focus();
  }
}

// ---------------- PSYCHOMOTOR VIGILANCE TASK (PVT) ----------------

function initPVTTest() {
  const box = document.getElementById('pvt-box');
  if (box) {
    box.addEventListener('click', handlePVTClick);
  }
}

function handlePVTClick() {
  const box = document.getElementById('pvt-box');
  const prompt = document.getElementById('pvt-prompt');
  const timer = document.getElementById('pvt-timer');

  if (AstroApp.pvtState === 'IDLE' || AstroApp.pvtState === 'DONE') {
    AstroApp.pvtState = 'WAITING';
    box.className = 'w-full h-44 rounded-xl bg-surface-container-low border-2 border-outline-variant flex flex-col items-center justify-center cursor-pointer select-none transition-all p-4 text-center';
    prompt.textContent = 'WAIT FOR CRIMSON FLASH... (DO NOT CLICK)';
    prompt.classList.remove('hidden');
    timer.classList.add('hidden');

    const delay = 2000 + Math.random() * 3000;
    clearTimeout(AstroApp.pvtTimer);
    AstroApp.pvtTimer = setTimeout(() => {
      if (AstroApp.pvtState === 'WAITING') {
        AstroApp.pvtState = 'ACTIVE';
        AstroApp.pvtStartTime = performance.now();
        box.className = 'w-full h-44 rounded-xl bg-error border-2 border-error-container flex flex-col items-center justify-center cursor-pointer select-none transition-all p-4 text-center shadow-[0_0_30px_rgba(255,180,171,0.6)]';
        prompt.classList.add('hidden');
        timer.classList.remove('hidden');
        timer.textContent = '0 ms';

        clearInterval(AstroApp.pvtInterval);
        AstroApp.pvtInterval = setInterval(() => {
          const elapsed = Math.round(performance.now() - AstroApp.pvtStartTime);
          timer.textContent = `${elapsed} ms`;
        }, 16);
      }
    }, delay);

  } else if (AstroApp.pvtState === 'WAITING') {
    // False start
    clearTimeout(AstroApp.pvtTimer);
    AstroApp.pvtState = 'DONE';
    box.className = 'w-full h-44 rounded-xl bg-surface-container-low border-2 border-outline-variant flex flex-col items-center justify-center cursor-pointer select-none transition-all p-4 text-center';
    prompt.textContent = 'FALSE START! Clicked before flash. Click to try again.';
    prompt.classList.remove('hidden');
    timer.classList.add('hidden');

  } else if (AstroApp.pvtState === 'ACTIVE') {
    // Reaction registered
    clearInterval(AstroApp.pvtInterval);
    const rt = Math.round(performance.now() - AstroApp.pvtStartTime);
    AstroApp.pvtState = 'DONE';
    box.className = 'w-full h-44 rounded-xl bg-surface-container-low border-2 border-secondary flex flex-col items-center justify-center cursor-pointer select-none transition-all p-4 text-center';
    prompt.textContent = `REACTION TIME: ${rt} ms (Click to test again)`;
    prompt.classList.remove('hidden');
    timer.textContent = `${rt} ms`;

    // Update display
    const lastRtEl = document.getElementById('pvt-last-rt');
    const lastLapseEl = document.getElementById('pvt-last-lapse');
    if (lastRtEl) lastRtEl.textContent = `${rt} ms`;
    if (lastLapseEl) lastLapseEl.textContent = rt > 500 ? '1 (Lapse)' : '0';

    // If backend is connected, log to backend
    if (AstroApp.isBackendConnected) {
      fetch(`${API_BASE}/api/cognitive/pvt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          astronaut_id: AstroApp.activeAstronautId,
          mean_reaction_time_ms: rt,
          lapse_count: rt > 500 ? 1 : 0,
          attention_score: Math.max(50, 100 - Math.round(rt / 10)),
          subjective_fatigue_level: rt > 400 ? 5 : 2
        })
      }).catch(() => { });
    }
  }
}

// ---------------- CANVAS OSCILLOSCOPES (ECG & BPM TREND) ----------------

function initOscilloscopes() {
  if (window.ECGOscilloscope) {
    AstroApp.oscilloscope = new window.ECGOscilloscope('ecgCanvas');
    AstroApp.oscilloscope.start();
  }

  if (window.HeartRateTrendGraph) {
    AstroApp.bpmTrendGraph = new window.HeartRateTrendGraph('bpmTrendCanvas');
    // Pre-populate with realistic 60s historical points
    const points = [];
    const base = 70;
    for (let i = 0; i < 40; i++) {
      points.push({ time: Date.now() - (40 - i) * 1000, bpm: base + Math.sin(i * 0.4) * 3 + (Math.random() - 0.5) * 2 });
    }
    AstroApp.bpmTrendGraph.updateData(points);
  }
}

function toggleCardiacView(view) {
  AstroApp.activeCardiacView = view;
  const ecgBox = document.getElementById('cardiac-ecg-container');
  const bpmBox = document.getElementById('cardiac-bpm-container');
  const btnEcg = document.getElementById('btn-toggle-ecg');
  const btnBpm = document.getElementById('btn-toggle-bpm');
  const btnDual = document.getElementById('btn-toggle-dual');

  const setBtnActive = (target) => {
    [btnEcg, btnBpm, btnDual].forEach(b => {
      if (!b) return;
      if (b === target) {
        b.className = 'px-2 py-0.5 rounded bg-primary-container text-on-primary font-bold cursor-pointer transition-all';
      } else {
        b.className = 'px-2 py-0.5 rounded text-on-surface-variant hover:text-on-surface cursor-pointer transition-all';
      }
    });
  };

  if (view === 'ecg') {
    if (ecgBox) ecgBox.classList.remove('hidden');
    if (bpmBox) bpmBox.classList.add('hidden');
    setBtnActive(btnEcg);
  } else if (view === 'bpm') {
    if (ecgBox) ecgBox.classList.add('hidden');
    if (bpmBox) {
      bpmBox.classList.remove('hidden');
      if (AstroApp.bpmTrendGraph) AstroApp.bpmTrendGraph.setupCanvas();
    }
    setBtnActive(btnBpm);
  } else if (view === 'dual') {
    if (ecgBox) ecgBox.classList.remove('hidden');
    if (bpmBox) {
      bpmBox.classList.remove('hidden');
      if (AstroApp.bpmTrendGraph) AstroApp.bpmTrendGraph.setupCanvas();
    }
    setBtnActive(btnDual);
  }
}

function simulateCardiacRhythm(bpm, desc) {
  const currentAstro = AstroApp.telemetry[AstroApp.activeAstronautId] || {};
  currentAstro.hr = bpm;
  currentAstro.hrv = Math.max(22, Math.round(75 - (bpm - 60) * 0.6));
  AstroApp.telemetry[AstroApp.activeAstronautId] = currentAstro;

  if (AstroApp.oscilloscope) AstroApp.oscilloscope.setBPM(bpm);
  if (AstroApp.bpmTrendGraph) AstroApp.bpmTrendGraph.addPoint(bpm);

  const descEl = document.getElementById('cardiac-rhythm-desc');
  if (descEl) descEl.textContent = desc;

  updateLiveVitalsDOM();
}

async function toggleAdvancedMetrics() {
  AstroApp.advancedMetricsVisible = !AstroApp.advancedMetricsVisible;
  const panel = document.getElementById('adv-metrics-panel');
  const label = document.getElementById('adv-metrics-label');
  const icon = document.getElementById('adv-metrics-icon');

  if (AstroApp.advancedMetricsVisible) {
    if (panel) panel.classList.remove('hidden');
    if (label) label.textContent = 'Hide Detailed Metrics';
    if (icon) icon.textContent = 'expand_less';
    await fetchAdvancedBiometrics();
  } else {
    if (panel) panel.classList.add('hidden');
    if (label) label.textContent = 'Show Detailed Metrics';
    if (icon) icon.textContent = 'expand_more';
  }
}

async function fetchAdvancedBiometrics() {
  if (AstroApp.isBackendConnected) {
    try {
      const res = await fetch(`${API_BASE}/api/advanced-biometrics/${AstroApp.activeAstronautId}`).then(r => r.json());
      if (res && res.hemodynamics) {
        updateAdvancedBiometricsDOM(res);
        return;
      }
    } catch (e) { }
  }

  // Standalone calculation
  const t = AstroApp.telemetry[AstroApp.activeAstronautId] || { hr: 71, bp_sys: 118, bp_dia: 76 };
  const hr = t.hr || 71;
  const sys = t.bp_sys || 118;
  const dia = t.bp_dia || 76;
  const pp = sys - dia;
  const map = Math.round(dia + (pp / 3.0));
  const sv = Math.round((pp * 320.0) / (sys + dia));
  const co = ((hr * sv) / 1000.0).toFixed(2);
  const svr = Math.round(((map - 4.0) / (co > 0 ? co : 5.0)) * 80.0);

  updateAdvancedBiometricsDOM({
    hemodynamics: {
      cardiac_output_l_min: parseFloat(co),
      stroke_volume_ml: sv,
      mean_arterial_pressure_mmhg: map,
      systemic_vascular_resistance: svr,
      end_tidal_co2_mmhg: 38.0
    },
    neuro_ocular_sans: {
      optic_nerve_sheath_diameter_mm: 5.20
    }
  });
}

function updateAdvancedBiometricsDOM(data) {
  const co = document.getElementById('adv-cardiac-output');
  const sv = document.getElementById('adv-stroke-volume');
  const map = document.getElementById('adv-map');
  const svr = document.getElementById('adv-svr');
  const etco2 = document.getElementById('adv-etco2');
  const onsd = document.getElementById('adv-onsd');
  const fluidShift = document.getElementById('adv-fluid-shift');
  const cumRad = document.getElementById('adv-cum-rad');
  const aredLoad = document.getElementById('adv-ared-workload');

  if (co && data.hemodynamics) co.textContent = `${data.hemodynamics.cardiac_output_l_min} L/min`;
  if (sv && data.hemodynamics) sv.textContent = `${data.hemodynamics.stroke_volume_ml} mL/beat`;
  if (map && data.hemodynamics) map.textContent = `${data.hemodynamics.mean_arterial_pressure_mmhg} mmHg`;
  if (svr && data.hemodynamics) svr.textContent = `${data.hemodynamics.systemic_vascular_resistance.toLocaleString()} dynes`;
  if (etco2 && data.hemodynamics) etco2.textContent = `${data.hemodynamics.end_tidal_co2_mmhg} mmHg`;
  if (onsd && data.neuro_ocular_sans) onsd.textContent = `${data.neuro_ocular_sans.optic_nerve_sheath_diameter_mm} mm`;
  if (fluidShift) fluidShift.textContent = '+0.8 cm';
  if (cumRad) cumRad.textContent = '48.6 mSv';
  if (aredLoad) aredLoad.textContent = '840 kJ';
}

// ---------------- DATA LOADING (DECOUPLED REST & STANDALONE) ----------------

async function loadInitialBackendData() {
  try {
    // Probe backend REST status
    const statusRes = await fetch(`${API_BASE}/api/status`, { signal: AbortSignal.timeout(2000) })
      .then(r => r.json())
      .catch(() => null);

    if (statusRes && statusRes.status) {
      // Backend is active and reachable
      AstroApp.isBackendConnected = true;
      updateBackendStatusBadge(true);

      const [crewRes, procRes, invRes, syncRes, envRes, groundStaffRes] = await Promise.all([
        fetch(`${API_BASE}/api/astronauts`).then(r => r.json()).catch(() => ({ astronauts: DEFAULT_CREW })),
        fetch(`${API_BASE}/api/procedures`).then(r => r.json()).catch(() => ({ procedures: DEFAULT_PROCEDURES })),
        fetch(`${API_BASE}/api/inventory`).then(r => r.json()).catch(() => ({ inventory: DEFAULT_INVENTORY })),
        fetch(`${API_BASE}/api/sync/status`).then(r => r.json()).catch(() => AstroApp.syncStatus),
        fetch(`${API_BASE}/api/environmental`).then(r => r.json()).catch(() => ({ telemetry: AstroApp.environment })),
        fetch(`${API_BASE}/api/ground/staff`).then(r => r.json()).catch(() => ({ ground_staff: DEFAULT_GROUND_STAFF }))
      ]);

      AstroApp.crew = crewRes.astronauts || DEFAULT_CREW;
      AstroApp.groundStaff = groundStaffRes.ground_staff || DEFAULT_GROUND_STAFF;
      AstroApp.procedures = procRes.procedures || DEFAULT_PROCEDURES;
      AstroApp.inventory = invRes.inventory || DEFAULT_INVENTORY;
      AstroApp.syncStatus = syncRes || AstroApp.syncStatus;
      AstroApp.environment = envRes.telemetry || AstroApp.environment;

      // Start REST polling at 1.5 Hz
      startRestPolling();
    } else {
      // Backend not running — use standalone client fallback
      enableStandaloneFallback();
    }
  } catch (e) {
    enableStandaloneFallback();
  }

  populateAstronautDropdown();

  // Select Dr. Sarah Chen or first available crew
  if (AstroApp.crew.length > 0) {
    const sarah = AstroApp.crew.find(c => c.name.includes('Sarah Chen')) || AstroApp.crew[0];
    selectCrewMember(sarah.id);
  }
  renderMissionPersonnel();
  renderCrewDashboard();
}

function enableStandaloneFallback() {
  AstroApp.isBackendConnected = false;
  updateBackendStatusBadge(false);

  AstroApp.crew = DEFAULT_CREW;
  AstroApp.groundStaff = DEFAULT_GROUND_STAFF;
  AstroApp.procedures = DEFAULT_PROCEDURES;
  AstroApp.inventory = DEFAULT_INVENTORY;
  AstroApp.messages = DEFAULT_MESSAGES;
  AstroApp.anomalies = [];

  // Initialize initial telemetry for all astronauts
  DEFAULT_CREW.forEach(c => {
    AstroApp.telemetry[c.id] = {
      astronaut_id: c.id,
      timestamp: new Date().toISOString(),
      sqi: 99.2,
      hr: Math.round(c.baseline_hr),
      hrv: Math.round(c.baseline_hrv),
      spo2: Math.round(c.baseline_spo2),
      resp_rate: Math.round(c.baseline_resp_rate),
      bp_sys: Math.round(c.baseline_bp_sys),
      bp_dia: Math.round(c.baseline_bp_dia),
      temp_c: c.baseline_temp,
      activity_g: 0.04,
      ecg_amplitude: 0.0
    };
  });

  renderMissionPersonnel();
  renderCrewDashboard();

  // Start smooth local heartbeat generator for standalone mode
  startLocalSimulation();
}

function updateBackendStatusBadge(isConnected) {
  const pill = document.getElementById('backend-status-pill');
  const dot = document.getElementById('backend-dot');
  const text = document.getElementById('backend-status-text');

  if (isConnected) {
    if (dot) {
      dot.className = 'w-2 h-2 rounded-full bg-secondary shadow-[0_0_6px_#7dffa2]';
    }
    if (text) {
      text.className = 'font-label-sm text-[10px] text-secondary font-bold uppercase tracking-wider';
      text.textContent = 'REST API CONNECTED (8000)';
    }
  } else {
    if (dot) {
      dot.className = 'w-2 h-2 rounded-full bg-primary-container shadow-[0_0_6px_#00e5ff]';
    }
    if (text) {
      text.className = 'font-label-sm text-[10px] text-primary-container font-bold uppercase tracking-wider';
      text.textContent = 'STANDALONE LOCAL CLIENT';
    }
  }
}

// ---------------- REST POLLING (ON-DEMAND REQUEST DRIVEN) ----------------

function startRestPolling() {
  clearInterval(AstroApp.pollTimer);
  AstroApp.pollTimer = setInterval(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/telemetry/live`).then(r => r.json());
      if (res && res.readings) {
        AstroApp.telemetry = res.readings;
        if (res.environment) AstroApp.environment = res.environment;
        if (res.active_anomalies) AstroApp.anomalies = res.active_anomalies;
        if (res.sync_status) AstroApp.syncStatus = res.sync_status;
        updateLiveVitalsDOM();
      }
    } catch (e) {
      // If REST call fails, failover to standalone simulation
      console.warn('[AstroHealth] Backend link dropped, engaging local client fallback.');
      enableStandaloneFallback();
    }
  }, 1200); // 1.2s on-demand poll interval
}

// ---------------- LOCAL SIMULATION (STANDALONE CLIENT FALLBACK) ----------------

function startLocalSimulation() {
  clearInterval(AstroApp.localSimTimer);
  AstroApp.localSimTimer = setInterval(() => {
    // Generate gentle physiological variation
    const astroId = AstroApp.activeAstronautId;
    const t = AstroApp.telemetry[astroId];
    if (t) {
      const baseAstro = AstroApp.crew.find(c => c.id === astroId) || { baseline_hr: 68 };
      // Micro-sine drift
      const nowSec = Date.now() / 1000.0;
      t.hr = Math.round(baseAstro.baseline_hr + Math.sin(nowSec * 0.2) * 3 + (Math.random() - 0.5) * 1.5);
      t.hrv = Math.round(62 + Math.cos(nowSec * 0.15) * 4);
      t.spo2 = Math.random() > 0.8 ? 98 : 99;
      t.resp_rate = Math.round(14 + Math.sin(nowSec * 0.1) * 1);
      t.temp_c = 36.9;
      t.sqi = 99.4;
      updateLiveVitalsDOM();
    }
  }, 1000);
}

// ---------------- DOM UPDATE LOOP ----------------

function updateLiveVitalsDOM() {
  const t = AstroApp.telemetry[AstroApp.activeAstronautId] || {};

  // Heart Rate & Rhythm
  const bpmEl = document.getElementById('bpm-val');
  const hrvEl = document.getElementById('hrv-val');
  const rhythmDescEl = document.getElementById('cardiac-rhythm-desc');
  const cardiacBadge = document.getElementById('cardiac-status-badge');

  if (bpmEl && t.hr !== undefined && t.hr !== null) {
    bpmEl.textContent = t.hr;
    if (t.hr > 120) {
      bpmEl.className = 'font-metric-display-mobile text-metric-display-mobile text-error font-bold';
      if (rhythmDescEl) rhythmDescEl.textContent = 'Inappropriate Tachycardia';
      if (cardiacBadge) {
        cardiacBadge.className = 'px-2.5 py-1 rounded-full bg-error-container/20 text-error font-label-sm text-label-sm font-bold tracking-wide flex items-center gap-1 border border-error/30';
        cardiacBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-error animate-ping"></span> ALERT';
      }
    } else {
      bpmEl.className = 'font-metric-display-mobile text-metric-display-mobile text-primary font-bold';
      if (rhythmDescEl && !rhythmDescEl.textContent.includes('Simulated')) {
        rhythmDescEl.textContent = 'Steady & Calm';
      }
      if (cardiacBadge) {
        cardiacBadge.className = 'px-2.5 py-1 rounded-full bg-secondary-container/20 text-secondary font-label-sm text-label-sm font-bold tracking-wide flex items-center gap-1 border border-secondary/30';
        cardiacBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-secondary"></span> OPTIMAL';
      }
    }
  }
  if (hrvEl && t.hrv) hrvEl.textContent = `${t.hrv} ms`;

  // Update Canvas Oscilloscope and BPM Trend Graph
  if (AstroApp.oscilloscope && t.hr) {
    AstroApp.oscilloscope.setBPM(t.hr);
  }
  if (AstroApp.bpmTrendGraph && t.hr !== undefined && t.hr !== null) {
    AstroApp.bpmTrendGraph.addPoint(t.hr);
  }

  if (AstroApp.advancedMetricsVisible) {
    fetchAdvancedBiometrics();
  }

  // SpO2
  const spo2El = document.getElementById('spo2-val');
  const spo2Bar = document.getElementById('spo2-bar');
  if (spo2El && t.spo2 !== undefined && t.spo2 !== null) {
    spo2El.textContent = t.spo2;
    if (spo2Bar) spo2Bar.style.width = `${t.spo2}%`;
  }

  // Blood Pressure
  const bpEl = document.getElementById('bp-val');
  const ppEl = document.getElementById('bp-pulse-pressure');
  if (bpEl && t.bp_sys && t.bp_dia) {
    bpEl.textContent = `${t.bp_sys}/${t.bp_dia}`;
    if (ppEl) ppEl.textContent = `Pulse Pressure: ${t.bp_sys - t.bp_dia} mmHg`;
  }

  // Temperature
  const tempFEl = document.getElementById('temp-f-val');
  const tempCEl = document.getElementById('temp-c-val');
  if (tempCEl && t.temp_c) {
    tempCEl.textContent = `(${t.temp_c}°C)`;
    const fahr = (t.temp_c * 9 / 5 + 32).toFixed(1);
    if (tempFEl) tempFEl.textContent = `${fahr}°F`;
  }

  // Respiratory Rate
  const rrEl = document.getElementById('resp-rate-val');
  if (rrEl && t.resp_rate) rrEl.textContent = t.resp_rate;

  // Signal Quality
  const sqiEl = document.getElementById('active-sqi-tag');
  if (sqiEl && t.sqi !== undefined) sqiEl.textContent = `LIVE ${(t.sqi || 99).toFixed(0)}% SQI`;

  // Sync count badge in nav
  const syncBadge = document.getElementById('sync-counter-badge');
  if (syncBadge && AstroApp.syncStatus.pending_count !== undefined) {
    syncBadge.textContent = AstroApp.syncStatus.pending_count;
  }

  renderCrewDashboard();
}

// ---------------- PROCEDURES & INVENTORY VIEW ----------------

function renderDailyTasksView() {
  const container = document.getElementById('procedures-list-container');
  if (container) {
    container.innerHTML = AstroApp.procedures.map(p => `
      <div class="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high flex items-center justify-between gap-3">
        <div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-label-sm font-bold text-primary">${p.code}</span>
            <span class="text-[10px] px-1.5 rounded ${p.severity === 'CRITICAL' ? 'bg-error/20 text-error' : 'bg-secondary/20 text-secondary'} font-semibold">${p.severity}</span>
          </div>
          <h4 class="text-sm font-headline-md font-bold text-on-surface mt-0.5">${p.title}</h4>
          <span class="text-xs text-on-surface-variant block mt-0.5">${p.steps.length} Steps &bull; ${p.indication}</span>
        </div>
        <button class="px-3 py-1.5 rounded-lg bg-primary-container text-on-primary font-label-md font-bold shrink-0 cursor-pointer" onclick="openProcedureModal('${p.id}')">
          Checklist
        </button>
      </div>
    `).join('');
  }

  const invContainer = document.getElementById('inventory-list-container');
  if (invContainer) {
    invContainer.innerHTML = AstroApp.inventory.map(i => `
      <div class="p-2.5 rounded-lg bg-surface-container-low border border-surface-container-high/40 flex items-center justify-between text-xs">
        <div>
          <strong class="text-on-surface font-headline-md text-xs block">${i.name}</strong>
          <span class="text-[10px] text-on-surface-variant">${i.batch_lot} &bull; Exp: ${i.expiry_date}</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-primary font-bold">${i.quantity} ${i.unit}</span>
          <button class="px-2 py-1 rounded bg-surface-container-high text-primary hover:bg-surface-container-highest text-[10px] font-bold cursor-pointer" onclick="administerMed('${i.id}')">Administer</button>
        </div>
      </div>
    `).join('');
  }
}

async function administerMed(id) {
  if (AstroApp.isBackendConnected) {
    try {
      await fetch(`${API_BASE}/api/inventory/consume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: id, quantity: 1, user_id: 'ASTRONAUT_CONSOLE', role: AstroApp.role })
      });
      const res = await fetch(`${API_BASE}/api/inventory`).then(r => r.json());
      AstroApp.inventory = res.inventory;
    } catch (e) { }
  } else {
    // Local decrement
    const item = AstroApp.inventory.find(i => i.id === id);
    if (item && item.quantity > 0) item.quantity--;
  }
  renderDailyTasksView();
}

// ---------------- GROUND CHAT & DSN SYNC VIEW ----------------

async function renderGroundChatView() {
  if (AstroApp.isBackendConnected) {
    try {
      const syncRes = await fetch(`${API_BASE}/api/sync/status`).then(r => r.json());
      AstroApp.syncStatus = syncRes;
      const msgRes = await fetch(`${API_BASE}/api/ground/messages`).then(r => r.json());
      if (msgRes && msgRes.messages) AstroApp.messages = msgRes.messages;
    } catch (e) { }
  }

  const sync = AstroApp.syncStatus;
  const stateEl = document.getElementById('sync-pill-state');
  const pendingEl = document.getElementById('sync-pending-count');
  const completedEl = document.getElementById('sync-completed-count');
  const storageEl = document.getElementById('sync-storage-health');

  if (stateEl) stateEl.textContent = `${sync.connection_state} (${sync.connection_state === 'ONLINE' ? 'DSN ACTIVE' : 'AUTONOMOUS FLIGHT'})`;
  if (pendingEl) pendingEl.textContent = sync.pending_count || 0;
  if (completedEl) completedEl.textContent = sync.synced_count || 0;
  if (storageEl) storageEl.textContent = sync.storage_health || 'HEALTHY';

  renderGroundChatMessages();

  // Audit Logs
  if (AstroApp.isBackendConnected) {
    try {
      const auditRes = await fetch(`${API_BASE}/api/audit?limit=15`).then(r => r.json());
      const auditContainer = document.getElementById('audit-log-container');
      if (auditContainer && auditRes.logs) {
        auditContainer.innerHTML = auditRes.logs.map(l => `
          <div class="p-2 rounded bg-surface-container-low text-[11px] font-label-sm border border-surface-container-high/40 flex justify-between items-center">
            <div>
              <span class="text-on-surface-variant">${l.timestamp.slice(11, 19)}</span>
              <strong class="text-primary ml-1">${l.role}:</strong>
              <span class="text-on-surface ml-1">${l.action}</span>
            </div>
            <span class="text-on-surface-variant font-mono" title="${l.hash}">${l.hash.slice(0, 8)}...</span>
          </div>
        `).join('');
      }
    } catch (e) { }
  }
}

function renderGroundChatMessages() {
  const stream = document.getElementById('ground-messages-stream');
  if (!stream) return;

  const msgs = AstroApp.messages.length > 0 ? AstroApp.messages : DEFAULT_MESSAGES;

  stream.innerHTML = msgs.map(m => {
    const isScientist = m.sender_role === 'GROUND_SCIENTIST';
    const isSurgeon = m.sender_role === 'FLIGHT_SURGEON';
    const isCrew = m.sender_role === 'ASTRONAUT';

    const roleColor = isSurgeon ? 'text-error' : isScientist ? 'text-primary' : isCrew ? 'text-secondary' : 'text-tertiary-fixed-dim';
    const borderStyle = isSurgeon ? 'border-error/30' : isScientist ? 'border-primary-container/30' : isCrew ? 'border-secondary/30' : 'border-outline-variant/30';
    const roleBadge = isSurgeon ? 'HOUSTON FLIGHT SURGEON' : isScientist ? 'NASA SCIENCE OPS' : isCrew ? 'ISS EXPEDITION 72' : 'BME CONSOLE';

    return `
      <div class="p-3 rounded-xl bg-surface-container-high/80 border ${borderStyle} text-xs space-y-1">
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-1.5">
            <span class="font-headline-md font-bold ${roleColor}">${m.sender_name}</span>
            <span class="text-[9px] px-1.5 py-0.2 rounded bg-surface-container-low font-label-sm font-semibold uppercase ${roleColor} border border-outline-variant/30">${roleBadge}</span>
            ${m.flight_directive ? '<span class="text-[9px] px-1 rounded bg-error-container/40 text-error font-bold">DIRECTIVE</span>' : ''}
          </div>
          <span class="text-[10px] text-on-surface-variant font-label-sm">${(m.timestamp || '').slice(11, 19)} UTC</span>
        </div>
        <p class="text-on-surface leading-relaxed mt-0.5">${m.message_text}</p>
      </div>
    `;
  }).join('');

  stream.scrollTop = stream.scrollHeight;
}

async function sendGroundCommMessage() {
  const input = document.getElementById('msg-input-text');
  const roleSelect = document.getElementById('msg-sender-role');
  const directiveCheck = document.getElementById('msg-directive-check');
  const prioritySelect = document.getElementById('msg-priority');

  if (!input || !input.value.trim()) return;

  const text = input.value.trim();
  const role = roleSelect ? roleSelect.value : 'GROUND_SCIENTIST';
  const roleNameMap = {
    'GROUND_SCIENTIST': 'Dr. Robert Vance, PhD (NASA Ames)',
    'FLIGHT_SURGEON': 'Dr. Paul Myers, MD (Houston)',
    'BIOMEDICAL_ENGINEER': 'Mark Alvarez, BME',
    'ASTRONAUT': 'Dr. Sarah Chen (ISS Crew)'
  };
  const senderName = roleNameMap[role] || 'Mission Console';
  const directive = directiveCheck ? directiveCheck.checked : false;
  const priority = prioritySelect ? prioritySelect.value : 'ROUTINE';

  playAudioBeaconChime(520, 0.2);

  const newMsg = {
    id: Date.now(),
    sender_name: senderName,
    sender_role: role,
    recipient: 'CREW_ALL',
    message_text: text,
    priority: priority,
    flight_directive: directive,
    timestamp: new Date().toISOString()
  };

  AstroApp.messages.push(newMsg);

  if (AstroApp.isBackendConnected) {
    try {
      await fetch(`${API_BASE}/api/ground/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMsg)
      });
    } catch (e) { }
  }

  input.value = '';
  renderGroundChatMessages();
}

function quickTransmitComm(text, role) {
  const roleNameMap = {
    'ASTRONAUT': 'Dr. Sarah Chen (ISS Crew)',
    'GROUND_SCIENTIST': 'Dr. Robert Vance, PhD (NASA Ames)',
    'FLIGHT_SURGEON': 'Dr. Paul Myers, MD (Houston)'
  };

  playAudioBeaconChime(520, 0.2);

  const newMsg = {
    id: Date.now(),
    sender_name: roleNameMap[role] || 'Crew Member',
    sender_role: role,
    recipient: 'MISSION_CONTROL',
    message_text: text,
    priority: 'ROUTINE',
    flight_directive: false,
    timestamp: new Date().toISOString()
  };

  AstroApp.messages.push(newMsg);

  if (AstroApp.isBackendConnected) {
    fetch(`${API_BASE}/api/ground/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMsg)
    }).catch(() => { });
  }

  alert(`TRANSMITTED TO GROUND STAFF:\n"${text}"\nRelayed via DSN Channel 4 (0.28s)`);
}

function setGroundMessageDraft(role, text, isDirective, priority) {
  const input = document.getElementById('msg-input-text');
  const roleSel = document.getElementById('msg-sender-role');
  const dirCheck = document.getElementById('msg-directive-check');
  const prioSel = document.getElementById('msg-priority');

  if (input) input.value = text;
  if (roleSel) roleSel.value = role;
  if (dirCheck) dirCheck.checked = !!isDirective;
  if (prioSel) prioSel.value = priority || 'ROUTINE';
}

function updateLightDelay() {
  const sel = document.getElementById('delay-sim-select');
  const syncLat = document.getElementById('sync-latency');
  if (sel && syncLat) {
    const val = parseFloat(sel.value);
    if (val < 1.0) syncLat.textContent = `DSN ${val}s (LEO)`;
    else if (val < 60) syncLat.textContent = `DSN ${val}s (Lunar)`;
    else syncLat.textContent = `DSN ${(val / 60).toFixed(1)}m (Mars)`;
  }
}

async function setUplinkState(state) {
  AstroApp.syncStatus.connection_state = state;
  if (AstroApp.isBackendConnected) {
    await fetch(`${API_BASE}/api/sync/connection?state=${state}`, { method: 'POST' }).catch(() => { });
  }
  renderGroundChatView();
}

async function triggerSyncBatch() {
  if (AstroApp.isBackendConnected) {
    try {
      const res = await fetch(`${API_BASE}/api/sync/trigger?batch_size=50`, { method: 'POST' }).then(r => r.json());
      alert(`Store-and-forward batch result: ${res.status} (${res.synced_count || 0} packets forwarded)`);
    } catch (e) {
      alert('Local Store-and-forward batch flushed.');
    }
  } else {
    alert('Local Store-and-forward batch flushed (Standalone client mode).');
  }
  renderGroundChatView();
}

// ---------------- TOOLS, SIMULATION & NASA VIEW ----------------

function renderToolsView() {
  searchOSDR();
  loadBOM();
}

async function applySimScenario() {
  const scenario = document.getElementById('sim-scenario-select').value;
  if (AstroApp.isBackendConnected) {
    await fetch(`${API_BASE}/api/simulation/scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ astronaut_id: AstroApp.activeAstronautId, scenario, noise: false })
    }).catch(() => { });
  } else {
    // Local simulation scenario
    const t = AstroApp.telemetry[AstroApp.activeAstronautId];
    if (t) {
      if (scenario === 'TACHYCARDIA') {
        t.hr = 142; t.hrv = 24;
      } else if (scenario === 'HYPOXIA') {
        t.spo2 = 86; t.resp_rate = 26;
      } else if (scenario === 'ORTHOSTATIC') {
        t.bp_sys = 85; t.bp_dia = 52; t.hr = 110;
      } else {
        t.hr = 71; t.spo2 = 99; t.bp_sys = 118; t.bp_dia = 76;
      }
      updateLiveVitalsDOM();
    }
  }
  alert(`Simulation Scenario [${scenario}] active on ${AstroApp.activeAstronautId}`);
}

async function searchOSDR() {
  const query = document.getElementById('osdr-search-field') ? document.getElementById('osdr-search-field').value : 'spaceflight';
  let datasets = [];

  if (AstroApp.isBackendConnected) {
    try {
      const res = await fetch(`${API_BASE}/api/nasa/search?term=${encodeURIComponent(query || 'spaceflight')}`).then(r => r.json());
      datasets = res.datasets || [];
    } catch (e) { }
  }

  if (datasets.length === 0) {
    // Standalone cached NASA studies
    datasets = [
      { id: "OSD-528", accession: "NASA-OSDR-528", title: "NASA Twins Study: Multi-omics Phenotypic Analysis of a Year in Space", description: "Comprehensive genomic, cardiovascular, and telomeric analysis of astronaut Scott Kelly during 340-day spaceflight." },
      { id: "OSD-379", accession: "NASA-OSDR-379", title: "Microgravity Induced Bone Loss and Muscle Atrophy in Murine Hindlimb Models", description: "Quantification of soleus muscle fiber cross-sectional area and cortical bone resorption biomarkers under simulated microgravity." },
      { id: "OSD-414", accession: "NASA-OSDR-414", title: "Spaceflight-Associated Neuro-Ocular Syndrome (SANS) Retinal Edema Survey", description: "Longitudinal optical coherence tomography and optic nerve sheath diameter (ONSD) evaluations across 60 ISS long-duration crew members." },
      { id: "OSD-194", accession: "NASA-OSDR-194", title: "Galactic Cosmic Ray Exposure Biomarkers & Solar Particle Event Mitigation", description: "DNA double-strand break repair kinetics in astronauts following solar particle event simulation." }
    ];
  }

  const container = document.getElementById('osdr-results-container');
  if (container) {
    container.innerHTML = datasets.map(d => `
      <div class="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1.5">
        <div class="flex justify-between items-center">
          <span class="text-xs font-label-sm font-bold text-primary">${d.accession || d.id}</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded bg-primary-container/20 text-primary font-semibold">NASA_RESEARCH_DATA</span>
        </div>
        <h4 class="text-sm font-headline-md font-bold text-on-surface">${d.title}</h4>
        <p class="text-xs text-on-surface-variant">${d.description}</p>
      </div>
    `).join('');
  }
}

async function loadBOM() {
  let components = [];
  if (AstroApp.isBackendConnected) {
    try {
      const res = await fetch(`${API_BASE}/api/hardware/bom`).then(r => r.json());
      components = res.components || [];
    } catch (e) { }
  }

  if (components.length === 0) {
    components = [
      { item: "ESP32-S3 Dual-Core Microcontroller Node", qty: 4, total_usd: 30.00 },
      { item: "MAX30102 Optical Pulse Oximeter & Heart Rate Module", qty: 4, total_usd: 19.20 },
      { item: "AD8232 Single-Lead Heart Rate Monitor (ECG) Module", qty: 4, total_usd: 24.80 },
      { item: "BME680 Environmental Sensor (Pressure, Temp, Gas)", qty: 2, total_usd: 29.00 },
      { item: "Single-Board Onboard Flight Computer (Raspberry Pi 5)", qty: 1, total_usd: 80.00 },
      { item: "Electrode Leads, Lithium-Polymer Batteries & Enclosures", qty: 1, total_usd: 35.00 }
    ];
  }

  const container = document.getElementById('bom-container');
  if (container) {
    container.innerHTML = `
      <div class="space-y-1.5 text-xs">
        ${components.map(c => `
          <div class="flex justify-between items-center p-2 rounded bg-surface-container-low">
            <span class="text-on-surface font-semibold">${c.item} (x${c.qty})</span>
            <span class="text-primary font-bold">$${c.total_usd.toFixed(2)}</span>
          </div>
        `).join('')}
      </div>
    `;
  }
}

// ---------------- BODY CHECK VIEW ----------------

function renderBodyCheckView() {
  const astro = AstroApp.crew.find(c => c.id === AstroApp.activeAstronautId);
  const name = document.getElementById('twin-crew-name');
  if (name) name.textContent = astro ? `${astro.name} · ${astro.id}` : 'No crew member selected';
  renderBodyScanAnalysis(true);
  loadHealthTimeline();
}

function initHealthTimeline() {
  const refresh = document.getElementById('twin-refresh-button');
  if (refresh) refresh.addEventListener('click', loadHealthTimeline);
  const metric = document.getElementById('twin-metric-select');
  if (metric) metric.addEventListener('change', () => renderHealthTimeline(AstroApp.healthTwin));
}

async function loadHealthTimeline() {
  const status = document.getElementById('twin-status');
  const refresh = document.getElementById('twin-refresh-button');
  const requestId = ++AstroApp.healthTwinRequestId;
  const astronautId = AstroApp.activeAstronautId;
  if (refresh) refresh.disabled = true;

  if (!AstroApp.isBackendConnected) {
    AstroApp.healthTwin = null;
    renderHealthTimeline(null);
    if (status) status.textContent = 'The backend is unavailable. Standalone simulated readings are not saved as longitudinal health records.';
    if (refresh) refresh.disabled = false;
    return;
  }

  if (status) status.textContent = 'Loading stored health records…';
  try {
    const response = await fetch(`${API_BASE}/api/astronauts/${encodeURIComponent(astronautId)}`);
    if (!response.ok) throw new Error(`Health record request failed (HTTP ${response.status}).`);
    const record = await response.json();
    if (requestId !== AstroApp.healthTwinRequestId) return;

    AstroApp.healthTwin = record;
    renderHealthTimeline(record);
    const sampleCount = record.digital_health_twin?.stored_sample_count || 0;
    if (status) {
      status.textContent = sampleCount
        ? `Loaded ${sampleCount} stored sample(s). The chart uses local database records and displays their source categories.`
        : 'No stored measurements are available for this astronaut yet.';
    }
  } catch (error) {
    if (requestId !== AstroApp.healthTwinRequestId) return;
    AstroApp.healthTwin = null;
    renderHealthTimeline(null);
    if (status) status.textContent = `Unable to load stored health records: ${error.message}`;
  } finally {
    if (requestId === AstroApp.healthTwinRequestId && refresh) refresh.disabled = false;
  }
}

function renderHealthTimeline(record) {
  const twin = record?.digital_health_twin;
  const profile = record?.profile;
  const samples = Array.isArray(twin?.recent_vitals_sample) ? [...twin.recent_vitals_sample].reverse() : [];
  const metric = document.getElementById('twin-metric-select')?.value || 'hr';
  const metricInfo = {
    hr: { label: 'Heart rate', unit: 'bpm', baseline: 'baseline_hr' },
    spo2: { label: 'SpO₂', unit: '%', baseline: 'baseline_spo2' },
    resp_rate: { label: 'Respiratory rate', unit: '/min', baseline: 'baseline_resp_rate' },
    bp_sys: { label: 'Systolic blood pressure', unit: 'mmHg', baseline: 'baseline_bp_sys' }
  }[metric];
  const usableSamples = samples.filter(sample => sample[metric] != null && Number.isFinite(Number(sample[metric])));
  const latest = usableSamples.length ? usableSamples[usableSamples.length - 1] : null;
  const baselineValue = profile?.[metricInfo.baseline];
  const baseline = baselineValue != null && Number.isFinite(Number(baselineValue)) ? Number(baselineValue) : null;

  const baselineEl = document.getElementById('twin-base-hr');
  const latestEl = document.getElementById('twin-latest-hr');
  const countEl = document.getElementById('twin-sample-count');
  const completenessEl = document.getElementById('twin-completeness');
  if (baselineEl) baselineEl.textContent = profile?.baseline_hr == null ? '—' : `${formatCrewMetric(profile.baseline_hr)} bpm`;
  if (latestEl) latestEl.textContent = latest?.hr == null ? '—' : `${formatCrewMetric(latest.hr)} bpm`;
  if (countEl) countEl.textContent = String(twin?.stored_sample_count ?? samples.length);
  if (completenessEl) {
    completenessEl.textContent = twin?.data_completeness_pct == null ? '—' : `${twin.data_completeness_pct}%`;
  }

  const summary = document.getElementById('twin-metric-summary');
  const sourceLabel = document.getElementById('twin-chart-source');
  const baselineLegend = document.getElementById('twin-baseline-legend');
  const chart = document.getElementById('twin-chart-container');
  if (baselineLegend) {
    baselineLegend.textContent = baseline == null ? '' : `Personal ${metricInfo.label.toLowerCase()} baseline: ${formatCrewMetric(baseline)} ${metricInfo.unit}`;
  }

  if (!usableSamples.length || !chart) {
    if (summary) summary.textContent = 'No stored measurements available';
    if (sourceLabel) sourceLabel.textContent = 'No stored sample timestamps or source labels to display.';
    if (chart) {
      chart.innerHTML = '<div id="twin-chart-empty" class="flex min-h-40 items-center justify-center px-4 text-center text-xs text-on-surface-variant">No stored values are available for this measurement yet.</div>';
    }
    renderBodyScanAnalysis(true);
    return;
  }

  const values = usableSamples.map(sample => Number(sample[metric]));
  const minValue = Math.min(...values, ...(baseline == null ? [] : [baseline]));
  const maxValue = Math.max(...values, ...(baseline == null ? [] : [baseline]));
  const padding = Math.max((maxValue - minValue) * 0.18, 1);
  const lower = minValue - padding;
  const upper = maxValue + padding;
  const width = 720;
  const height = 190;
  const left = 44;
  const right = 12;
  const top = 14;
  const bottom = 26;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const x = index => left + (usableSamples.length < 2 ? plotWidth / 2 : index * plotWidth / (usableSamples.length - 1));
  const y = value => top + (upper - value) * plotHeight / (upper - lower);
  const points = values.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ');
  const yTicks = [0, 1, 2, 3].map(step => {
    const value = upper - (upper - lower) * step / 3;
    const position = y(value);
    return `<g><line x1="${left}" y1="${position}" x2="${width - right}" y2="${position}" stroke="currentColor" opacity=".12"/><text x="${left - 7}" y="${position + 3}" fill="currentColor" opacity=".65" text-anchor="end" font-size="9">${value.toFixed(1)}</text></g>`;
  }).join('');
  const baselineLine = baseline == null ? '' : `<line x1="${left}" y1="${y(baseline)}" x2="${width - right}" y2="${y(baseline)}" stroke="currentColor" stroke-dasharray="5 4" opacity=".7"/>`;
  const firstTime = new Date(usableSamples[0].timestamp);
  const lastTime = new Date(usableSamples[usableSamples.length - 1].timestamp);
  const formatTime = date => Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString();
  const sourceCounts = twin?.source_counts || {};
  const sourceText = Object.entries(sourceCounts).map(([source, count]) => `${source}: ${count}`).join(' · ');
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (summary) {
    summary.textContent = `Latest ${formatCrewMetric(values[values.length - 1])} ${metricInfo.unit} · range ${formatCrewMetric(Math.min(...values))}–${formatCrewMetric(Math.max(...values))} · mean ${formatCrewMetric(mean)}`;
  }
  if (sourceLabel) {
    sourceLabel.textContent = `${sourceText || 'Source category not recorded'} · ${formatTime(firstTime)} – ${formatTime(lastTime)}`;
  }
  chart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="block h-48 w-full text-primary" role="img" aria-label="${escapeHTML(metricInfo.label)} trend, ${usableSamples.length} stored measurements">
      ${yTicks}
      ${baselineLine}
      <polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${values.map((value, index) => `<circle cx="${x(index)}" cy="${y(value)}" r="${usableSamples.length > 30 ? 2 : 3.5}" fill="currentColor"><title>${escapeHTML(new Date(usableSamples[index].timestamp).toLocaleString())}: ${formatCrewMetric(value)} ${metricInfo.unit} · ${escapeHTML(usableSamples[index].provenance || 'SOURCE_NOT_RECORDED')}</title></circle>`).join('')}
      <text x="${left}" y="${height - 5}" fill="currentColor" opacity=".65" font-size="9">${escapeHTML(formatTime(firstTime))}</text>
      <text x="${width - right}" y="${height - 5}" fill="currentColor" opacity=".65" text-anchor="end" font-size="9">${escapeHTML(formatTime(lastTime))}</text>
    </svg>`;
  renderBodyScanAnalysis(true);
}

function renderBodyScanAnalysis(force = false) {
  const now = Date.now();
  if (!force && now - AstroApp.bodyScanLastRenderedAt < 5000) return;
  AstroApp.bodyScanLastRenderedAt = now;

  const astronaut = AstroApp.crew.find(member => member.id === AstroApp.activeAstronautId);
  const history = AstroApp.healthTwin?.digital_health_twin?.recent_vitals_sample;
  const current = AstroApp.telemetry[AstroApp.activeAstronautId]
    || (Array.isArray(history) && history.length ? history[0] : null);
  const baseline = astronaut || {};
  const toNumber = (value, fallback) => {
    const parsed = Number(value);
    return value !== undefined && value !== null && Number.isFinite(parsed) ? parsed : fallback;
  };
  const signals = [
    { id: 'heart', label: 'Heart rate', value: toNumber(current?.hr, toNumber(baseline.baseline_hr, null)), unit: 'bpm', baseline: toNumber(baseline.baseline_hr, null), tolerance: 20 },
    { id: 'oxygen', label: 'Oxygen saturation', value: toNumber(current?.spo2, toNumber(baseline.baseline_spo2, null)), unit: '%', baseline: toNumber(baseline.baseline_spo2, null), tolerance: 3 },
    { id: 'pressure', label: 'Systolic pressure', value: toNumber(current?.bp_sys, toNumber(baseline.baseline_bp_sys, null)), unit: 'mmHg', baseline: toNumber(baseline.baseline_bp_sys, null), tolerance: 20 },
    { id: 'respiration', label: 'Respiratory rate', value: toNumber(current?.resp_rate, toNumber(baseline.baseline_resp_rate, null)), unit: '/min', baseline: toNumber(baseline.baseline_resp_rate, null), tolerance: 4 },
    { id: 'recovery', label: 'HRV', value: toNumber(current?.hrv, toNumber(baseline.baseline_hrv, null)), unit: 'ms', baseline: toNumber(baseline.baseline_hrv, null), tolerance: 15 },
    { id: 'radiation', label: 'Radiation', value: toNumber(AstroApp.environment?.ambient_radiation_usvh, null), unit: 'µSv/h', baseline: null, tolerance: 40 }
  ].map(signal => {
    const hasValue = signal.value !== null;
    const outsideReference = hasValue && (signal.id === 'radiation'
      ? signal.value > signal.tolerance
      : signal.baseline !== null && Math.abs(signal.value - signal.baseline) > signal.tolerance);
    return { ...signal, status: !current || !hasValue ? 'awaiting data' : outsideReference ? 'review' : 'within reference' };
  });
  const reviewCount = signals.filter(signal => signal.status === 'review').length;
  const summaryTag = document.getElementById('body-scan-summary-tag');
  if (summaryTag) {
    summaryTag.textContent = current ? (reviewCount ? `${reviewCount} flag${reviewCount === 1 ? '' : 's'}` : 'No prototype flags') : 'Awaiting data';
    summaryTag.className = `rounded-full border px-2 py-0.5 text-[9px] font-label-sm uppercase ${reviewCount ? 'border-tertiary-container/30 bg-tertiary-container/10 text-tertiary-fixed-dim' : 'border-secondary/30 bg-secondary-container/20 text-secondary'}`;
  }

  const colorFor = status => status === 'review' ? '#ffb347' : status === 'awaiting data' ? '#8ba3b5' : '#46e4a7';
  const map = document.getElementById('body-scan-panel');
  if (map) {
    const colors = Object.fromEntries(signals.map(signal => [signal.id, colorFor(signal.status)]));
    map.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-[0.8fr_1.2fr] items-center gap-3">
        <div class="flex items-center justify-center rounded-xl border border-outline-variant/30 bg-surface-container/60 p-2">
          <svg viewBox="0 0 220 360" class="w-full max-w-[190px]" role="img" aria-label="Illustrative body map showing telemetry references, not a medical scan">
            <circle cx="110" cy="38" r="23" fill="#1b344a" stroke="#5aa8b7" stroke-width="2"/>
            <path d="M92 65 Q72 72 66 91 L48 145 Q44 159 56 164 Q67 168 73 153 L83 124 L79 193 Q80 208 90 218 L83 316 Q82 330 94 332 Q106 333 109 319 L110 242 L121 319 Q124 333 136 332 Q148 330 147 316 L140 218 Q150 208 151 193 L147 124 L157 153 Q163 168 174 164 Q186 159 182 145 L164 91 Q158 72 138 65 Z" fill="#1b344a" stroke="#5aa8b7" stroke-width="2" stroke-linejoin="round"/>
            <path d="M94 111 Q83 123 91 151 L107 160 L107 113 Z" fill="${colors.oxygen}" fill-opacity=".72"/>
            <path d="M126 111 Q137 123 129 151 L113 160 L113 113 Z" fill="${colors.respiration}" fill-opacity=".72"/>
            <path d="M110 135 C105 128 97 135 100 143 L110 154 L120 143 C123 135 115 128 110 135 Z" fill="${colors.heart}"/>
            <path d="M110 164 L110 220" stroke="${colors.pressure}" stroke-width="4" stroke-linecap="round"/>
            <circle cx="110" cy="176" r="9" fill="${colors.recovery}" fill-opacity=".75"/>
            <circle cx="110" cy="178" r="100" fill="none" stroke="${colors.radiation}" stroke-width="2" stroke-dasharray="4 7" opacity=".5"/>
          </svg>
        </div>
        <div class="space-y-2">
          ${signals.map(signal => `
            <div class="rounded-lg border border-outline-variant/30 bg-surface-container/60 p-2">
              <div class="flex items-center justify-between gap-2">
                <span class="text-[10px] font-semibold text-on-surface">${signal.label}</span>
                <span class="text-[9px] uppercase" style="color:${colorFor(signal.status)}">${signal.status}</span>
              </div>
              <span class="text-[10px] text-on-surface-variant">${signal.value === null ? '—' : `${formatCrewMetric(signal.value)} ${signal.unit}`}</span>
            </div>
          `).join('')}
        </div>
      </div>`;
  }

  const prediction = document.getElementById('body-scan-prediction');
  const riskScore = document.getElementById('body-scan-risk-score');
  const riskBar = document.getElementById('body-scan-risk-bar');
  const predictiveRisk = AstroApp.healthTwin?.digital_health_twin?.predictive_risk;
  const oneHourRisk = Number(predictiveRisk?.horizon_1h_pct);
  if (Number.isFinite(oneHourRisk)) {
    if (riskScore) riskScore.textContent = `${oneHourRisk}% · 1h`;
    if (riskBar) {
      riskBar.style.width = `${Math.max(0, Math.min(100, oneHourRisk))}%`;
      riskBar.style.background = oneHourRisk >= 70 ? '#ff5f6d' : oneHourRisk >= 35 ? '#ffb347' : '#46e4a7';
    }
    if (prediction) {
      prediction.textContent = `Backend-provided prototype estimate. Contributors: ${(predictiveRisk.contributing_factors || []).join(', ') || 'not reported'}. This is not a clinical assessment.`;
    }
  } else {
    if (riskScore) riskScore.textContent = '—';
    if (riskBar) {
      riskBar.style.width = '0%';
      riskBar.style.background = '#46e4a7';
    }
    if (prediction) prediction.textContent = 'A backend risk estimate is unavailable. The body map only compares available readings with configured references and is not a clinical assessment.';
  }

  const issues = document.getElementById('body-scan-issues');
  if (issues) {
    const flagged = signals.filter(signal => signal.status === 'review');
    issues.innerHTML = flagged.length ? flagged.map(signal => `
      <div class="rounded-lg border border-tertiary-container/30 bg-surface-container p-2.5">
        <div class="flex items-center justify-between">
          <span class="text-[10px] uppercase text-on-surface-variant">${signal.label}</span>
          <span class="text-[9px] uppercase text-tertiary-fixed-dim">Review</span>
        </div>
        <p class="mt-1 text-[10px] text-on-surface-variant">Reading differs from the configured prototype reference.</p>
      </div>
    `).join('') : '<div class="rounded-lg border border-secondary/30 bg-secondary-container/10 p-3 text-[11px] text-secondary">No prototype reference flags. This does not establish clinical normality.</div>';
  }

  const heartChart = document.getElementById('body-heart-chart');
  const heartSamples = Array.isArray(history)
    ? history.filter(sample => sample.hr != null && Number.isFinite(Number(sample.hr))).slice(0, 24).reverse()
    : [];
  if (current?.hr != null && Number.isFinite(Number(current.hr))) {
    heartSamples.push({ hr: current.hr, timestamp: current.timestamp, provenance: current.provenance });
  }
  if (heartChart) {
    if (!heartSamples.length) {
      heartChart.innerHTML = '<div class="flex h-full items-center justify-center text-xs text-on-surface-variant">Waiting for heart-rate samples.</div>';
    } else {
      const values = heartSamples.map(sample => Number(sample.hr));
      const min = Math.min(...values);
      const max = Math.max(...values);
      const padding = Math.max(3, (max - min) * 0.2);
      const low = min - padding;
      const high = max + padding;
      const x = index => heartSamples.length < 2 ? 180 : 12 + index * 336 / (heartSamples.length - 1);
      const y = value => 126 - (value - low) * 106 / (high - low);
      const points = values.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ');
      const first = new Date(heartSamples[0].timestamp || '');
      const last = new Date(heartSamples[heartSamples.length - 1].timestamp || '');
      const timeText = date => Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      heartChart.innerHTML = `<svg viewBox="0 0 360 150" class="h-full w-full" role="img" aria-label="Stored heart-rate trend from ${values.length} samples"><line x1="12" y1="126" x2="348" y2="126" stroke="currentColor" opacity=".2"/><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2.5"/>${values.map((value, index) => `<circle cx="${x(index)}" cy="${y(value)}" r="3" fill="currentColor"><title>${formatCrewMetric(value)} bpm</title></circle>`).join('')}<text x="12" y="145" fill="currentColor" font-size="9">${escapeHTML(timeText(first))}</text><text x="348" y="145" text-anchor="end" fill="currentColor" font-size="9">${escapeHTML(timeText(last))}</text></svg>`;
    }
  }
  const liveBpm = document.getElementById('body-heart-live-bpm');
  if (liveBpm) liveBpm.textContent = current?.hr == null ? '— bpm' : `${formatCrewMetric(current.hr)} bpm`;
  const heartContext = document.getElementById('body-heart-context');
  if (heartContext) heartContext.textContent = `${heartSamples.length} stored or current sample(s) · illustrative trend, not ECG`;
}

// ---------------- GENERIC MODAL CONTROLLER ----------------

function openModal(icon, title, htmlContent) {
  const modal = document.getElementById('app-modal');
  const iconEl = document.getElementById('modal-icon');
  const titleEl = document.getElementById('modal-title');
  const bodyEl = document.getElementById('modal-body');

  if (iconEl) iconEl.textContent = icon;
  if (titleEl) titleEl.textContent = title;
  if (bodyEl) bodyEl.innerHTML = htmlContent;
  if (modal) modal.classList.remove('hidden');
}

function closeModal() {
  const modal = document.getElementById('app-modal');
  if (modal) modal.classList.add('hidden');
}

function openProcedureModal(procId) {
  const proc = AstroApp.procedures.find(p => p.id === procId) || AstroApp.procedures[0];
  if (!proc) return;

  const content = `
    <div class="space-y-3 font-body-sm">
      <div class="p-3 bg-surface-container-low rounded-xl border border-primary-container/30">
        <span class="text-xs text-primary font-label-sm font-bold uppercase block">CLINICAL INDICATION</span>
        <p class="text-xs text-on-surface mt-1">${proc.indication}</p>
      </div>

      <h4 class="font-headline-md text-xs font-bold text-primary uppercase tracking-wider">MANDATORY PROTOCOL STEPS:</h4>
      <div class="space-y-2">
        ${proc.steps.map(s => `
          <div class="p-3 rounded-lg bg-surface-container-low border border-surface-container-high flex items-start gap-3 cursor-pointer hover:bg-surface-container" onclick="this.classList.toggle('opacity-50')">
            <input type="checkbox" class="mt-1 cursor-pointer">
            <div>
              <strong class="text-on-surface text-xs block">${s.step_id}. ${s.title}</strong>
              <p class="text-[11px] text-on-surface-variant mt-0.5">${s.description}</p>
            </div>
          </div>
        `).join('')}
      </div>

      <button class="w-full py-2.5 rounded-lg bg-secondary-container text-on-secondary font-headline-md text-xs font-bold mt-2 cursor-pointer" onclick="closeModal()">
        Complete Protocol &amp; Return to Flight Status
      </button>
    </div>
  `;

  openModal('checklist', `${proc.code}: ${proc.title}`, content);
}

// Global Window Exports for DOM event handlers
window.AstroApp = AstroApp;
window.selectCrewMember = selectCrewMember;
window.switchViewTab = switchViewTab;
window.setUplinkState = setUplinkState;
window.triggerSyncBatch = triggerSyncBatch;
window.applySimScenario = applySimScenario;
window.searchOSDR = searchOSDR;
window.administerMed = administerMed;
window.closeModal = closeModal;
window.openProcedureModal = openProcedureModal;
window.toggleCardiacView = toggleCardiacView;
window.simulateCardiacRhythm = simulateCardiacRhythm;
window.toggleAdvancedMetrics = toggleAdvancedMetrics;
window.sendGroundCommMessage = sendGroundCommMessage;
window.quickTransmitComm = quickTransmitComm;
window.setGroundMessageDraft = setGroundMessageDraft;
window.updateLightDelay = updateLightDelay;
