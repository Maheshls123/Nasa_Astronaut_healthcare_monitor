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
const API_BASE = window.ASTRA_API_BASE || 'http://127.0.0.1:8000';

const OFFLINE_OSDR_DATASETS = [
  {
    id: 'OSD-379',
    accession: 'OSD-379',
    title: 'Transcriptional profiling of livers from mice flown on Rodent Research Reference Mission-1 (RRRM-1)',
    category: 'ANIMAL_MUSCULOSKELETAL_AND_PHYSIOLOGY',
    mission: 'Rodent Research Reference Mission-1 (RRRM-1), ISS',
    organism: 'Mus musculus (female BALB/cAnNTac mice)',
    subject_type: 'Animal research; flight and ground-control mouse cohorts',
    study_design: 'Spaceflight and ground-control cohorts with multiple mission time points',
    measurement_type: 'Transcription profiling of liver tissue',
    description: 'NASA OSDR metadata describes forty female BALB/cAnNTac mice flown on the ISS. This is animal research, not a human astronaut twin study.',
    source_url: 'https://osdr.nasa.gov/osdr/data/osd/meta/379',
    source_category: 'REAL_NASA_RESEARCH',
    data_kind: 'HISTORICAL_RESEARCH',
    version: 6,
    limitations: ['Mouse tissue transcription data are not human astronaut physiological measurements.']
  },
  {
    id: 'OSD-542',
    accession: 'OSD-542',
    title: 'Effects of 14 days of confinement on blood gene expression profiles in men',
    category: 'HUMAN_BEHAVIOURAL_AND_CONFINEMENT_RESEARCH',
    mission: 'Japan Aerospace Exploration Agency isolation and confinement facility; not a spaceflight mission',
    organism: 'Homo sapiens (male subjects)',
    subject_type: 'Human analog research; confined healthy male subjects',
    study_design: 'Two 14-day confinement experiments with blood sampling',
    measurement_type: 'Transcription profiling from whole blood RNA',
    description: 'NASA OSDR metadata describes short-term ground-based confinement research in male subjects. It is not astronaut flight telemetry.',
    source_url: 'https://osdr.nasa.gov/osdr/data/osd/meta/542',
    source_category: 'REAL_NASA_RESEARCH',
    data_kind: 'HISTORICAL_RESEARCH',
    version: 4,
    limitations: ['Ground-based short-duration confinement is not equivalent to microgravity or long-duration spaceflight.', 'Human subjects are not necessarily astronauts.']
  },
  {
    id: 'OSD-137',
    accession: 'OSD-137',
    title: 'Rodent Research-3-CASIS: Mouse liver transcriptomic, proteomic, epigenomic and histology data',
    category: 'ANIMAL_BONE_AND_MUSCLE_COUNTERMEASURE_RESEARCH',
    mission: 'Rodent Research-3 (RR-3), ISS',
    organism: 'Mus musculus (female BALB/c mice)',
    subject_type: 'Animal research; flight and ground-control mouse cohorts',
    study_design: 'Spaceflight mouse study with ground controls and countermeasure treatment',
    measurement_type: 'Protein expression, DNA methylation, transcription profiling, and molecular cellular imaging',
    description: 'NASA OSDR metadata describes mouse research on potential countermeasures for loss of muscle and bone mass during spaceflight.',
    source_url: 'https://osdr.nasa.gov/osdr/data/osd/meta/137',
    source_category: 'REAL_NASA_RESEARCH',
    data_kind: 'HISTORICAL_RESEARCH',
    version: 10,
    limitations: ['Mouse molecular and tissue data are not human astronaut measurements.']
  },
  {
    id: 'OSD-254',
    accession: 'OSD-254',
    title: 'Transcriptional analysis of dorsal skin from mice flown on the RR-7 mission',
    category: 'ANIMAL_IMMUNE_AND_MICROBIOME_RESEARCH',
    mission: 'Rodent Research-7 (RR-7), ISS',
    organism: 'Mus musculus (female C57BL/6J and C3H/HeJ mice)',
    subject_type: 'Animal research; two mouse strains in spaceflight and control cohorts',
    study_design: 'ISS rodent study with two mouse strains and microbiome/immune-system objectives',
    measurement_type: 'Transcription profiling of dorsal skin',
    description: 'NASA OSDR metadata describes RR-7 mouse research investigating the space environment, gut microbiota, and associated immune, metabolic, and circadian effects.',
    source_url: 'https://osdr.nasa.gov/osdr/data/osd/meta/254',
    source_category: 'REAL_NASA_RESEARCH',
    data_kind: 'HISTORICAL_RESEARCH',
    version: 7,
    limitations: ['This is mouse research and the measurement described is dorsal-skin transcription.']
  }
];

// Global Application State
const AstroApp = {
  activeTab: 'crew-overview',
  activeAstronautId: 'ASTRA-04', // Dr. Sarah Chen default
  activeProfileId: 'GROUND-02',
  role: 'GROUND_SCIENTIST',
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
  assistantAvailable: false,
  assistantBusy: false,
  nasaDatasets: [],
  nasaSource: 'UNQUERIED',
  nasaOffset: 0,
  nasaTotal: 0,
  nasaFilePage: 1,
  nasaActiveDataset: null,
  healthTwinRequestId: 0,
  healthTwin: null,
  bodyScanLastRenderedAt: 0,
  radiation: {
    dose_rate_msv_day: 0.42,
    status: { label: 'SAFE' },
    astronauts: []
  }
};

// Remove background process: cleanly unregister any previous Service Workers
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const reg of registrations) {
      reg.unregister().then(() => {
        console.log('[AstroHealth] Background ServiceWorker cleanly unregistered:', reg.scope);
      });
    }
  }).catch(() => {});
}

// ---------------- DEFAULT OFFLINE / STANDALONE DATASETS ----------------

const DEFAULT_CREW = [
  {
    id: "ASTRA-01",
    name: "CDR Alex Mercer",
    role: "Astronaut",
    age: 42,
    blood_type: "O+",
    assigned_cabin: "Cabin Alpha",
    baseline_hr: 68.0,
    baseline_hrv: 62.0,
    baseline_bp_sys: 118.0,
    baseline_bp_dia: 78.0,
    baseline_spo2: 98.5,
    baseline_temp: 36.7,
    baseline_resp_rate: 13.0,
    mission_day: 142,
    status: "NORMAL"
  },
  {
    id: "ASTRA-04",
    name: "Dr. Sarah Chen",
    role: "Astronaut",
    age: 37,
    blood_type: "O+",
    assigned_cabin: "Cupola / Module 4",
    baseline_hr: 68.0,
    baseline_hrv: 68.0,
    baseline_bp_sys: 118.0,
    baseline_bp_dia: 76.0,
    baseline_spo2: 99.0,
    baseline_temp: 36.9,
    baseline_resp_rate: 14.0,
    mission_day: 142,
    status: "NORMAL"
  }
];

const DEFAULT_GROUND_STAFF = [
  { id: "GROUND-01", name: "Dr. Paul Myers, MD", role: "Flight Surgeon", organization: "Houston Mission Control" },
  { id: "GROUND-02", name: "Dr. Robert Vance, PhD", role: "Ground Scientist", organization: "NASA Ames" },
  { id: "GROUND-03", name: "Mark Alvarez", role: "Biomedical Engineer", organization: "Mission Control" }
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
  initOSDRWorkbench();
  initHealthTimeline();
  initEmergencyConsole();

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
      tab.className = 'nav-tab active flex flex-1 min-w-0 flex-col items-center justify-center gap-1 h-14 rounded-xl px-1 text-primary-container bg-surface-container-high/80 shadow-[0_0_16px_rgba(0,229,255,0.2)] transition-all cursor-pointer';
    } else {
      tab.className = 'nav-tab flex flex-1 min-w-0 flex-col items-center justify-center gap-1 h-14 rounded-xl px-1 text-on-surface-variant hover:text-on-surface transition-all cursor-pointer';
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
  else if (viewName === 'crew-overview') renderCrewDashboard();
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

  const people = getMissionPersonnel();
  container.innerHTML = people.map(person => `
    <button type="button" onclick="selectMissionProfile('${escapeHTML(person.id)}')" class="flex items-center gap-2.5 p-2 rounded-lg hover:bg-surface-container text-left transition-colors cursor-pointer w-full">
      <div class="w-7 h-7 rounded-full bg-primary-container/20 text-primary font-headline-md text-xs flex items-center justify-center font-bold">
        ${escapeHTML(getInitials(person.name))}
      </div>
      <div class="flex flex-col min-w-0">
        <span class="font-headline-md text-xs text-on-surface font-semibold truncate">${escapeHTML(person.name)}</span>
        <span class="font-label-sm text-[10px] text-on-surface-variant truncate">${escapeHTML(person.profileRoleLabel)}</span>
      </div>
    </button>
  `).join('');

  const activeProfile = people.find(person => person.id === AstroApp.activeProfileId);
  if (activeProfile) updateHeaderProfile(activeProfile);
}

function getMissionPersonnel() {
  const crewProfiles = AstroApp.crew.map(person => ({
    ...person,
    profileRole: 'ASTRONAUT',
    profileRoleLabel: 'Astronaut'
  }));
  const staffRoleKeys = {
    'Flight Surgeon': 'FLIGHT_SURGEON',
    'Ground Scientist': 'GROUND_SCIENTIST',
    'Biomedical Engineer': 'BIOMEDICAL_ENGINEER'
  };
  const staffProfiles = AstroApp.groundStaff.map(person => ({
    ...person,
    profileRole: staffRoleKeys[person.role] || 'MISSION_CONTROL',
    profileRoleLabel: person.role
  }));
  return [...crewProfiles, ...staffProfiles];
}

function updateHeaderProfile(person) {
  AstroApp.activeProfileId = person.id;
  AstroApp.role = person.profileRole;

  const initials = document.getElementById('header-avatar-initials');
  if (initials) initials.textContent = getInitials(person.name);

  const profileButton = document.getElementById('astro-menu-btn');
  if (profileButton) profileButton.setAttribute('aria-label', `Switch profile, ${person.name}, ${person.profileRoleLabel}`);

  const roleSelect = document.getElementById('role-select');
  if (roleSelect && [...roleSelect.options].some(option => option.value === person.profileRole)) {
    roleSelect.value = person.profileRole;
  }
}

function selectMissionProfile(personId) {
  const person = getMissionPersonnel().find(candidate => candidate.id === personId);
  if (!person) return;

  updateHeaderProfile(person);
  const dropdown = document.getElementById('astro-dropdown');
  if (dropdown) dropdown.classList.add('hidden');

  if (AstroApp.crew.some(member => member.id === person.id)) {
    selectCrewMember(person.id);
  }
}

function selectCrewMember(astroId) {
  AstroApp.activeAstronautId = astroId;
  const astro = AstroApp.crew.find(c => c.id === astroId);
  if (!astro) return;

  const profileAvatar = document.getElementById('active-profile-avatar');
  if (profileAvatar) profileAvatar.textContent = getInitials(astro.name);

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
  renderCrewDashboard();
  if (AstroApp.activeTab === 'body-check') renderBodyCheckView();
}

function getInitials(name) {
  if (!name) return 'A';
  const parts = name.replace('Dr. ', '').replace('CDR ', '').replace('CMP ', '').replace('MS ', '').replace('FE ', '').split(' ');
  return parts.map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

// ---------------- ROLE SELECTOR ----------------

function initRoleSelector() {
  const sel = document.getElementById('role-select');
  if (sel) {
    sel.value = AstroApp.role;
    sel.addEventListener('change', (e) => {
      const selectedRole = e.target.value;
      const matchingPeople = getMissionPersonnel().filter(person => person.profileRole === selectedRole);
      const preferredPerson = matchingPeople.find(person => person.id === AstroApp.activeProfileId)
        || matchingPeople.find(person => person.id === AstroApp.activeAstronautId)
        || matchingPeople[0];
      if (preferredPerson) updateHeaderProfile(preferredPerson);
      else AstroApp.role = selectedRole;
      console.log('[AstroHealth Security] Active role switched to:', AstroApp.role);
      if (AstroApp.role === 'GROUND_SCIENTIST') {
        switchViewTab('crew-overview');
      } else if (AstroApp.activeTab === 'crew-overview') {
        switchViewTab('vitals');
      }
    });
  }
}

// ---------------- EMERGENCY SIREN ACTIONS ----------------

function initEmergencySirenButtons() {
  const testBtn = document.getElementById('siren-test-btn');
  const triggerBtn = document.getElementById('siren-trigger-btn');

  if (testBtn) {
    testBtn.addEventListener('click', () => {
      playAmbulanceSiren(0.6);
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
      playAmbulanceSiren(1.2);
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
          } catch (e) {}
        }
        openProcedureModal('PROC-CARD-01');
      }
    });
  }
}

function playAmbulanceSiren(totalDuration = 1.2) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const start = audioCtx.currentTime;
    const pattern = [650, 1300, 700, 1500];

    pattern.forEach((freq, index) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const localStart = start + (index * 0.18);
      const localEnd = localStart + 0.16;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, localStart);
      gain.gain.setValueAtTime(0.0001, localStart);
      gain.gain.exponentialRampToValueAtTime(0.22, localStart + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, localEnd);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(localStart);
      osc.stop(localEnd);
    });

    if (totalDuration > 0) {
      const finalGain = audioCtx.createGain();
      finalGain.gain.setValueAtTime(0.0001, start);
      finalGain.gain.exponentialRampToValueAtTime(0.0001, start + totalDuration);
    }
  } catch (e) { }
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
  if (btn) {
    btn.addEventListener('click', () => {
      openAstroAIConsole();
    });
  }
}

function openAstroAIConsole() {
  const bodyContent = `
    <div class="flex h-full min-h-0 flex-col gap-3">
      <div class="rounded-xl border border-tertiary-container/30 bg-tertiary-container/10 p-3 text-[11px] leading-relaxed text-on-surface-variant">
        <strong class="text-tertiary-fixed-dim">Privacy:</strong> Your chat messages are sent to Groq to generate replies. Do not include names, identifying details, or private/patient-level health information. Crew telemetry and records are not included.
        <p class="mt-1">AstroAI provides general education, not diagnosis or treatment. For medical concerns, contact a qualified clinician; follow mission emergency procedures for urgent situations.</p>
      </div>
      <div id="assistant-setup-note" role="status" class="hidden rounded-lg border px-3 py-2 text-xs"></div>
      <div id="assistant-chat-stream" role="log" aria-live="polite" aria-label="AstroAI conversation" class="flex-1 min-h-[220px] overflow-y-auto rounded-xl border border-outline-variant/30 bg-surface-container-low p-3 space-y-3">
      </div>
      <div id="assistant-suggestions" class="flex flex-wrap gap-2">
        <button type="button" class="assistant-prompt rounded-full border border-outline-variant/50 px-3 py-1.5 text-[10px] text-on-surface-variant hover:border-primary-container hover:text-primary">How does microgravity affect bone health?</button>
        <button type="button" class="assistant-prompt rounded-full border border-outline-variant/50 px-3 py-1.5 text-[10px] text-on-surface-variant hover:border-primary-container hover:text-primary">What do heart rate and HRV measure?</button>
        <button type="button" class="assistant-prompt rounded-full border border-outline-variant/50 px-3 py-1.5 text-[10px] text-on-surface-variant hover:border-primary-container hover:text-primary">Explain space motion sickness</button>
      </div>
      <form id="assistant-chat-form" class="flex items-end gap-2 border-t border-outline-variant/30 pt-3">
        <label for="assistant-chat-input" class="sr-only">Ask AstroAI a health question</label>
        <textarea id="assistant-chat-input" rows="2" maxlength="4000" placeholder="Ask a general health question…" class="min-h-12 max-h-32 flex-1 resize-y rounded-xl border border-outline-variant/50 bg-surface-container-low px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/70 outline-none focus:border-primary-container" disabled></textarea>
        <button id="assistant-chat-send" type="submit" aria-label="Send message" class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-container text-on-primary transition-opacity disabled:cursor-not-allowed disabled:opacity-40" disabled>
          <span class="material-symbols-outlined">send</span>
        </button>
      </form>
      <div class="flex items-center justify-between gap-2">
        <span id="assistant-chat-status" class="text-[10px] text-on-surface-variant">Checking assistant configuration…</span>
        <button id="assistant-chat-clear" type="button" class="text-[10px] text-on-surface-variant underline hover:text-primary">Clear chat</button>
      </div>
    </div>
  `;

  const panel = document.getElementById('app-modal-panel');
  if (panel) {
    panel.classList.add('max-w-3xl', 'h-[min(88vh,780px)]', 'flex', 'flex-col');
    panel.classList.remove('max-h-[85vh]', 'overflow-y-auto');
  }
  openModal('smart_toy', 'Chat with AstroAI', bodyContent);
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
}

async function loadHealthAssistantStatus() {
  const note = document.getElementById('assistant-setup-note');
  const status = document.getElementById('assistant-chat-status');
  try {
    const response = await fetch(`${API_BASE}/api/assistant/status`);
    if (!response.ok) throw new Error(`Assistant status request failed (${response.status}).`);
    const data = await response.json();
    AstroApp.assistantAvailable = Boolean(data.configured);
    if (!data.configured) {
      if (note) {
        note.className = 'rounded-lg border border-tertiary-container/30 bg-tertiary-container/10 px-3 py-2 text-xs text-tertiary-fixed-dim';
        note.textContent = 'Copy the project-root .env.example to .env, add your GROQ_API_KEY, then restart the backend to enable chat.';
      }
      if (status) status.textContent = 'Groq is not configured';
    } else {
      if (note) note.className = 'hidden';
      if (status) status.textContent = `Configured for Groq · ${data.model}`;
    }
  } catch (error) {
    AstroApp.assistantAvailable = false;
    if (note) {
      note.className = 'rounded-lg border border-error/30 bg-error-container/15 px-3 py-2 text-xs text-error';
      note.textContent = 'The backend assistant is unavailable. Start the backend and verify its Groq configuration.';
    }
    if (status) status.textContent = 'Assistant unavailable';
  }
  updateHealthChatControls();
}

function renderHealthChat() {
  const stream = document.getElementById('assistant-chat-stream');
  if (!stream) return;

  const messages = AstroApp.assistantMessages;
  if (!messages.length) {
    stream.innerHTML = `
      <div class="flex items-start gap-2">
        <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-container/20 text-primary"><span class="material-symbols-outlined text-[16px]">smart_toy</span></div>
        <div class="max-w-[90%] rounded-2xl rounded-tl-sm bg-surface-container-high px-3.5 py-2.5 text-sm leading-relaxed text-on-surface">Hi, I’m AstroAI. Ask me general questions about health, physiology, or spaceflight health. I can explain concepts, but I can’t diagnose or replace a clinician.</div>
      </div>
    `;
    return;
  }

  stream.innerHTML = messages.map(message => {
    const isUser = message.role === 'user';
    return `
      <div class="flex ${isUser ? 'justify-end' : 'justify-start'} items-start gap-2">
        ${isUser ? '' : '<div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-container/20 text-primary"><span class="material-symbols-outlined text-[16px]">smart_toy</span></div>'}
        <div class="max-w-[90%] rounded-2xl ${isUser ? 'rounded-tr-sm bg-primary-container text-on-primary' : 'rounded-tl-sm bg-surface-container-high text-on-surface'} px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words">${escapeHTML(message.content)}</div>
      </div>
    `;
  }).join('') + (AstroApp.assistantBusy ? `
    <div class="flex items-start gap-2" aria-label="AstroAI is responding">
      <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-container/20 text-primary"><span class="material-symbols-outlined text-[16px]">smart_toy</span></div>
      <div class="rounded-2xl rounded-tl-sm bg-surface-container-high px-3.5 py-2.5 text-sm text-on-surface-variant">Thinking…</div>
    </div>` : '') + (AstroApp.assistantError ? `
    <div role="alert" class="ml-9 max-w-[90%] rounded-lg border border-error/30 bg-error-container/15 px-3.5 py-2.5 text-sm text-error">
      <strong>AstroAI couldn't respond.</strong> ${escapeHTML(AstroApp.assistantError)}
    </div>` : '');
  stream.scrollTop = stream.scrollHeight;
}

function updateHealthChatControls() {
  const input = document.getElementById('assistant-chat-input');
  const send = document.getElementById('assistant-chat-send');
  if (!input || !send) return;
  input.disabled = !AstroApp.assistantAvailable || AstroApp.assistantBusy;
  send.disabled = !AstroApp.assistantAvailable || AstroApp.assistantBusy || !input.value.trim();
  const clearButton = document.getElementById('assistant-chat-clear');
  if (clearButton) clearButton.disabled = AstroApp.assistantBusy;
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
  if (status) status.textContent = 'Sending your message to Groq…';

  try {
    const messages = AstroApp.assistantMessages.slice(-12).map(({ role, content: message }) => ({ role, content: message }));
    const response = await fetch(`${API_BASE}/api/assistant/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || `Assistant request failed (${response.status}).`);
    AstroApp.assistantMessages.push({ role: 'assistant', content: result.reply });
    AstroApp.assistantMessages = AstroApp.assistantMessages.slice(-30);
    if (status) status.textContent = 'Connected to Groq';
  } catch (error) {
    AstroApp.assistantError = error instanceof Error ? error.message : 'Could not get a reply. Please try again.';
    if (status) status.textContent = 'AstroAI could not respond. See the chat for details.';
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
      }).catch(() => {});
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
    } catch (e) {}
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
      .then(r => r.ok ? r.json() : null)
      .catch(() => null);

    if (statusRes?.mode && Number.isFinite(statusRes.astronauts_monitored)) {
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
  renderMissionPersonnel();

  // Select Dr. Sarah Chen or first available crew
  if (AstroApp.crew.length > 0) {
    const sarah = AstroApp.crew.find(c => c.name.includes('Sarah Chen')) || AstroApp.crew[0];
    selectCrewMember(sarah.id);
  }
}

function enableStandaloneFallback() {
  AstroApp.isBackendConnected = false;
  updateBackendStatusBadge(false);

  AstroApp.crew = DEFAULT_CREW;
  AstroApp.procedures = DEFAULT_PROCEDURES;
  AstroApp.inventory = DEFAULT_INVENTORY;
  AstroApp.messages = DEFAULT_MESSAGES;
  AstroApp.groundStaff = DEFAULT_GROUND_STAFF;

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
      const [telemetryRes, radiationRes] = await Promise.all([
        fetch(`${API_BASE}/api/telemetry/live`).then(r => r.json()),
        fetch(`${API_BASE}/api/radiation`).then(r => r.json()).catch(() => null)
      ]);

      if (telemetryRes && telemetryRes.readings) {
        AstroApp.telemetry = telemetryRes.readings;
        if (telemetryRes.environment) AstroApp.environment = telemetryRes.environment;
        if (telemetryRes.active_anomalies) AstroApp.anomalies = telemetryRes.active_anomalies;
        if (telemetryRes.sync_status) AstroApp.syncStatus = telemetryRes.sync_status;
      }
      if (radiationRes) AstroApp.radiation = radiationRes;
      updateLiveVitalsDOM();
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
    AstroApp.crew.forEach(baseAstro => {
      const t = AstroApp.telemetry[baseAstro.id];
      if (!t) return;
      // Micro-sine drift
      const nowSec = Date.now() / 1000.0;
      t.hr = Math.round(baseAstro.baseline_hr + Math.sin(nowSec * 0.2) * 3 + (Math.random() - 0.5) * 1.5);
      t.hrv = Math.round(baseAstro.baseline_hrv + Math.cos(nowSec * 0.15) * 4);
      t.spo2 = Math.random() > 0.8 ? 98 : 99;
      t.resp_rate = Math.round(baseAstro.baseline_resp_rate + Math.sin(nowSec * 0.1) * 1);
      t.temp_c = baseAstro.baseline_temp;
      t.sqi = 99.4;
    });
    updateLiveVitalsDOM();
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

  updateRadiationExposure();

  // Sync count badge in nav
  const syncBadge = document.getElementById('sync-counter-badge');
  if (syncBadge && AstroApp.syncStatus.pending_count !== undefined) {
    syncBadge.textContent = AstroApp.syncStatus.pending_count;
  }

  if (AstroApp.activeTab === 'body-check') renderBodyScanAnalysis();
  renderCrewDashboard();
}

function updateRadiationExposure() {
  const env = AstroApp.environment || {};
  const ambientDoseUsvH = Number(env.ambient_radiation_usvh ?? 18.5);
  const doseRateMsvDay = Number((ambientDoseUsvH * 24 / 1000).toFixed(3));
  const activeAstro = AstroApp.radiation?.astronauts?.find(a => a.id === AstroApp.activeAstronautId) || {
    cumulative_mission_msv: 48.6,
    dose_rate_usvh: ambientDoseUsvH
  };
  const cumulativeMissionMsv = Number(activeAstro.cumulative_mission_msv ?? (doseRateMsvDay * 30));

  const overviewEl = document.getElementById('overview-env-radiation');
  if (overviewEl) overviewEl.textContent = `${ambientDoseUsvH.toFixed(1)}`;

  const rateEl = document.getElementById('radiation-rate-val');
  const statusEl = document.getElementById('radiation-status-text');
  const barEl = document.getElementById('radiation-progress-bar');
  const speEl = document.getElementById('overview-spe-status');

  let label = 'Safe Green Zone';
  let width = Math.min(100, Math.max(10, doseRateMsvDay / 1.5 * 100));
  let barColour = 'bg-secondary';
  if (doseRateMsvDay >= 1.5) {
    label = 'Storm Shelter Required';
    width = 100;
    barColour = 'bg-error';
  } else if (doseRateMsvDay >= 0.7) {
    label = 'Elevated Exposure';
    width = Math.min(90, Math.max(35, doseRateMsvDay / 1.5 * 100));
    barColour = 'bg-tertiary-fixed-dim';
  }

  if (rateEl) rateEl.textContent = `${doseRateMsvDay.toFixed(2)}`;
  if (statusEl) {
    statusEl.textContent = label;
    statusEl.className = `font-label-sm text-label-sm font-semibold block ${doseRateMsvDay >= 1.5 ? 'text-error' : doseRateMsvDay >= 0.7 ? 'text-tertiary-fixed-dim' : 'text-secondary'}`;
  }
  if (barEl) {
    barEl.style.width = `${width}%`;
    barEl.className = `h-full rounded-full ${barColour}`;
  }
  if (speEl) {
    const showActive = Boolean(env.spe_event_active);
    speEl.textContent = showActive ? 'ACTIVE' : 'INACTIVE';
    speEl.className = `rounded-full px-2 py-1 text-[10px] font-label-sm ${showActive ? 'bg-error-container/30 text-error' : 'bg-secondary-container/15 text-secondary'}`;
  }

  const cumRadEl = document.getElementById('adv-cum-rad');
  if (cumRadEl) cumRadEl.textContent = `${cumulativeMissionMsv.toFixed(1)} mSv`;
}

// ---------------- GROUND STAFF CREW OVERVIEW ----------------

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

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function getCrewTelemetryAlerts(crewMember, reading) {
  const reported = AstroApp.anomalies.filter(alert => alert.astronaut_id === crewMember.id);
  if (reported.length || AstroApp.isBackendConnected || !reading) return reported;

  const alerts = [];
  const addAlert = (severity, type, message) => alerts.push({
    astronaut_id: crewMember.id,
    severity,
    anomaly_type: type,
    explanation: message
  });

  if (reading.sqi === 0) {
    addAlert('SENSOR_FAILURE', 'TELEMETRY_LINK_LOST', 'No usable biometric signal is available.');
  } else {
    const moving = Number(reading.activity_g || 0) > 0.4;
    if (reading.hr > 140 && !moving) addAlert('CRITICAL', 'ELEVATED_HEART_RATE', 'Heart-rate reading exceeds the prototype critical threshold.');
    else if (reading.hr > 115 && !moving) addAlert('WARNING', 'ELEVATED_HEART_RATE', 'Heart-rate reading exceeds the prototype review threshold.');

    if (reading.spo2 < 88) addAlert('CRITICAL', 'LOW_OXYGEN_SATURATION', 'Oxygen-saturation reading is below the prototype critical threshold.');
    else if (reading.spo2 < 93) addAlert('WARNING', 'LOW_OXYGEN_SATURATION', 'Oxygen-saturation reading is below the prototype review threshold.');

    if (reading.bp_sys < 90 || reading.bp_sys - reading.bp_dia < 25) {
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
  return crewMember.status === 'NORMAL' ? 'NOMINAL' : (crewMember.status || 'NOMINAL');
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
  const staff = (AstroApp.groundStaff.length ? AstroApp.groundStaff : DEFAULT_GROUND_STAFF).map(member => ({
    name: member.name,
    role: member.role,
    category: 'Ground staff',
    detail: member.organization,
    icon: member.role === 'Flight Surgeon' ? 'medical_services' : member.role === 'Ground Scientist' ? 'science' : 'settings_input_component'
  }));

  grid.innerHTML = [...crew, ...staff].map(member => `
    <article class="rounded-xl bg-surface-container-low border border-outline-variant/40 p-3 flex items-center gap-3">
      <div class="w-10 h-10 shrink-0 rounded-full bg-primary-container/15 border border-primary-container/25 flex items-center justify-center text-primary">
        <span class="material-symbols-outlined">${member.icon}</span>
      </div>
      <div class="min-w-0">
        <h3 class="text-sm font-semibold text-on-surface truncate">${escapeHTML(member.name)}</h3>
        <p class="text-xs text-primary">${escapeHTML(member.role)}</p>
        <p class="text-[10px] text-on-surface-variant truncate">${escapeHTML(member.category)} · ${escapeHTML(member.detail)}</p>
      </div>
    </article>
  `).join('');
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
  const activeFlags = alerts.length;
  const availableSignals = crewRows.filter(row => row.reading && row.reading.sqi !== undefined);
  const averageSqi = availableSignals.length
    ? availableSignals.reduce((total, row) => total + Number(row.reading.sqi || 0), 0) / availableSignals.length
    : null;

  const count = document.getElementById('overview-crew-count');
  const nominal = document.getElementById('overview-nominal-count');
  const attention = document.getElementById('overview-attention-count');
  const quality = document.getElementById('overview-signal-quality');
  if (count) count.textContent = crewRows.length;
  if (nominal) nominal.textContent = crewRows.filter(row => row.status === 'NOMINAL').length;
  if (attention) attention.textContent = crewRows.filter(row => row.status !== 'NOMINAL').length;
  if (quality) quality.textContent = averageSqi === null ? '—' : `${Math.round(averageSqi)}%`;

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
    const timestamp = reading && reading.timestamp ? new Date(reading.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Awaiting data';
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
  if (alertCount) alertCount.textContent = `${activeFlags} ACTIVE`;
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
  if (lastUpdated) lastUpdated.textContent = crewRows.some(row => row.reading) ? `Dashboard refreshed ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Waiting for telemetry';

  const env = AstroApp.environment || {};
  const environmentValues = {
    'overview-env-o2': [env.cabin_o2_pct, 1],
    'overview-env-co2': [env.cabin_co2_mmhg, 1],
    'overview-env-pressure': [env.cabin_pressure_kpa, 1],
    'overview-env-radiation': [env.ambient_radiation_usvh, 1]
  };
  Object.entries(environmentValues).forEach(([id, [value, digits]]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = formatCrewMetric(value, digits);
  });
  const spe = document.getElementById('overview-spe-status');
  if (spe) {
    spe.textContent = env.spe_event_active ? 'ACTIVE' : 'INACTIVE';
    spe.className = `rounded-full px-2 py-1 text-[10px] font-label-sm ${env.spe_event_active ? 'bg-error-container/30 text-error' : 'bg-secondary-container/15 text-secondary'}`;
  }
}

// ---------------- PROCEDURES & INVENTORY VIEW ----------------

function renderDailyTasksView() {
  loadEmergencyConsole();
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

function initEmergencyConsole() {
  document.getElementById('incident-refresh-button')?.addEventListener('click', loadEmergencyConsole);
  document.getElementById('incident-list-container')?.addEventListener('click', handleIncidentAction);
}

async function loadEmergencyConsole() {
  const status = document.getElementById('incident-console-status');
  const container = document.getElementById('incident-list-container');
  const refresh = document.getElementById('incident-refresh-button');
  if (!container) return;
  if (!AstroApp.isBackendConnected) {
    AstroApp.emergencies = [];
    container.innerHTML = '<p class="rounded-lg border border-outline-variant/30 p-4 text-xs text-on-surface-variant">Incident records require the local backend. Standalone mode does not store or manage incident workflows.</p>';
    if (status) status.textContent = 'Backend disconnected · incident actions unavailable.';
    return;
  }
  if (refresh) refresh.disabled = true;
  if (status) status.textContent = 'Loading active incident records…';
  try {
    const response = await fetch(`${API_BASE}/api/emergencies`);
    if (!response.ok) throw new Error(`Incident request failed (HTTP ${response.status}).`);
    const result = await response.json();
    AstroApp.emergencies = Array.isArray(result.active_emergencies) ? result.active_emergencies : [];
    renderEmergencyConsole();
    if (status) status.textContent = AstroApp.emergencies.length
      ? `${AstroApp.emergencies.length} unresolved incident(s) · refreshed ${new Date().toLocaleTimeString()}`
      : 'No unresolved incidents in the backend record.';
  } catch (error) {
    if (status) status.textContent = `Incident records unavailable: ${error.message}`;
    container.innerHTML = '<p class="rounded-lg border border-error/30 bg-error-container/10 p-4 text-xs text-error">Could not load incident records. Refresh to retry; no incident action was performed.</p>';
  } finally {
    if (refresh) refresh.disabled = false;
  }
}

function renderEmergencyConsole() {
  const container = document.getElementById('incident-list-container');
  if (!container) return;
  if (!AstroApp.emergencies.length) {
    container.innerHTML = '<div class="rounded-lg border border-secondary/20 bg-secondary-container/5 p-4 text-xs text-on-surface-variant"><strong class="text-secondary">No unresolved incidents.</strong><p class="mt-1">This is an incident database status only, not a medical assessment of crew health.</p></div>';
    return;
  }
  const severityClass = severity => severity === 'CRITICAL'
    ? 'border-error/30 bg-error-container/10 text-error'
    : 'border-tertiary-container/30 bg-tertiary-container/5 text-tertiary-fixed-dim';
  container.innerHTML = AstroApp.emergencies.map(incident => {
    const procedure = AstroApp.procedures.find(item => item.id === incident.checklist_id);
    const steps = procedure?.steps || [];
    const completed = new Set(incident.completed_steps || []);
    const acknowledged = incident.status === 'ACKNOWLEDGED';
    const stepRows = steps.length ? steps.map(step => {
      const done = completed.has(step.step_id);
      return `<li class="flex items-start gap-2 border-t border-outline-variant/20 py-2">
        <span class="material-symbols-outlined mt-0.5 text-sm ${done ? 'text-secondary' : 'text-on-surface-variant'}">${done ? 'task_alt' : 'radio_button_unchecked'}</span>
        <div class="min-w-0 flex-1"><strong class="text-[11px] ${done ? 'text-secondary' : 'text-on-surface'}">${escapeHTML(step.title)}</strong><p class="mt-0.5 text-[10px] leading-relaxed text-on-surface-variant">${escapeHTML(step.description)}</p></div>
        ${acknowledged && !done ? `<button type="button" data-incident-action="step" data-incident-id="${escapeHTML(incident.id)}" data-step-id="${Number(step.step_id)}" class="shrink-0 rounded border border-outline-variant/40 px-2 py-1 text-[9px] font-bold text-primary hover:border-primary-container">Mark done</button>` : ''}
      </li>`;
    }).join('') : '<li class="border-t border-outline-variant/20 py-2 text-[10px] text-tertiary-fixed-dim">No checklist definition found for this incident. Escalate through approved procedures.</li>';
    const started = incident.started_at ? new Date(incident.started_at).toLocaleString() : 'Time not recorded';
    return `<article class="rounded-xl border p-3 ${severityClass(incident.severity)}">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2"><span class="text-[9px] font-bold uppercase">${escapeHTML(incident.severity || 'UNSPECIFIED')}</span><span class="text-[9px] text-on-surface-variant">${escapeHTML(incident.code || incident.id)}</span><span class="rounded-full border border-current/20 px-2 py-0.5 text-[9px] uppercase">${escapeHTML(incident.status)}</span></div>
          <h3 class="mt-1 text-sm font-bold text-on-surface">${escapeHTML(incident.title)}</h3>
          <p class="mt-1 text-[10px] text-on-surface-variant">${escapeHTML(incident.astronaut_name || incident.astronaut_id)} · ${escapeHTML(incident.astronaut_id)} · Started ${escapeHTML(started)}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          ${!acknowledged ? `<button type="button" data-incident-action="acknowledge" data-incident-id="${escapeHTML(incident.id)}" class="rounded-lg bg-primary-container px-3 py-2 text-[10px] font-bold text-on-primary">Acknowledge</button>` : '<span class="rounded-lg border border-secondary/30 px-3 py-2 text-[10px] font-bold text-secondary">Acknowledged</span>'}
          ${acknowledged ? `<button type="button" data-incident-action="resolve" data-incident-id="${escapeHTML(incident.id)}" class="rounded-lg border border-outline-variant/50 px-3 py-2 text-[10px] font-bold text-on-surface">Review &amp; close</button>` : ''}
        </div>
      </div>
      ${incident.notes ? `<p class="mt-2 text-[10px] leading-relaxed text-on-surface-variant"><strong>Incident notes:</strong> ${escapeHTML(incident.notes)}</p>` : ''}
      <details class="mt-3 rounded-lg border border-outline-variant/30 bg-surface-container-low p-3">
        <summary class="cursor-pointer text-[11px] font-bold text-on-surface">${escapeHTML(procedure?.title || incident.checklist_id || 'Incident checklist')} · ${completed.size}/${steps.length} steps recorded</summary>
        <p class="my-2 text-[9px] text-tertiary-fixed-dim">Checklist content is a prototype reference; use only procedures approved by the responsible medical authority.</p>
        <ol class="space-y-1">${stepRows}</ol>
      </details>
    </article>`;
  }).join('');
}

async function handleIncidentAction(event) {
  const button = event.target.closest('[data-incident-action]');
  if (!button) return;
  const { incidentAction, incidentId, stepId } = button.dataset;
  const payload = { user_id: 'LOCAL_DEMO_OPERATOR', role: AstroApp.role };
  let endpoint = `${API_BASE}/api/emergencies/${encodeURIComponent(incidentId)}`;
  let body = payload;
  if (incidentAction === 'acknowledge') {
    endpoint += '/acknowledge';
  } else if (incidentAction === 'step') {
    endpoint += '/step';
    body = { ...payload, step_id: Number(stepId) };
  } else if (incidentAction === 'resolve') {
    const notes = window.prompt('Enter a review/closure note. Do not include treatment instructions unless directed by the qualified medical authority.');
    if (!notes || !notes.trim()) return;
    if (!window.confirm('Close this incident record? Confirm only if closure has been authorized by the responsible medical authority.')) return;
    endpoint += '/resolve';
    body = { ...payload, notes: notes.trim() };
  } else {
    return;
  }
  button.disabled = true;
  const status = document.getElementById('incident-console-status');
  if (status) status.textContent = 'Submitting incident action…';
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || result.error || `Action failed (HTTP ${response.status}).`);
    await loadEmergencyConsole();
    renderCrewDashboard();
  } catch (error) {
    if (status) status.textContent = `Incident action failed: ${error.message}. Record was not refreshed as successful.`;
    button.disabled = false;
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
    } catch (e) {}
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
    } catch (e) {}
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
    } catch (e) {}
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
    } catch (e) {}
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
    }).catch(() => {});
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
    await fetch(`${API_BASE}/api/sync/connection?state=${state}`, { method: 'POST' }).catch(() => {});
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
    }).catch(() => {});
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
  return runOSDRSearch(true);
}

function initOSDRWorkbench() {
  const form = document.getElementById('osdr-search-form');
  const results = document.getElementById('osdr-results-container');
  const loadMore = document.getElementById('osdr-load-more');
  if (!form || !results) return;

  form.addEventListener('submit', event => {
    event.preventDefault();
    runOSDRSearch(true);
  });
  loadMore?.addEventListener('click', () => runOSDRSearch(false));
  results.addEventListener('click', async event => {
    const button = event.target.closest('[data-osdr-action]');
    if (!button) return;
    const { osdrAction, accession } = button.dataset;
    if (osdrAction === 'details') await openOSDRDataset(accession);
  });
  document.getElementById('osdr-dataset-details')?.addEventListener('click', async event => {
    const button = event.target.closest('[data-osdr-action]');
    if (!button) return;
    const { osdrAction, accession, fileName, page } = button.dataset;
    if (osdrAction === 'files') await loadOSDRFilePage(accession, Number(page));
    if (osdrAction === 'download') await downloadOSDRFile(accession, fileName, Number(page));
  });
}

async function runOSDRSearch(reset) {
  const field = document.getElementById('osdr-search-field');
  const categoryField = document.getElementById('osdr-category-filter');
  const query = (field?.value || '').trim();
  const category = categoryField?.value || '';
  const status = document.getElementById('osdr-search-status');
  const button = document.getElementById('osdr-search-button');
  const moreButton = document.getElementById('osdr-load-more');
  if (reset) {
    AstroApp.nasaOffset = 0;
    AstroApp.nasaDatasets = [];
  }
  if (status) status.textContent = 'Searching NASA OSDR…';
  if (button) button.disabled = true;
  if (moreButton) moreButton.disabled = true;

  let result;
  let onlineError = null;
  if (AstroApp.isBackendConnected) {
    try {
      const params = new URLSearchParams({ term: query || 'spaceflight', from: String(AstroApp.nasaOffset), size: '10' });
      if (category) params.set('category', category);
      const response = await fetch(`${API_BASE}/api/nasa/search?${params}`);
      if (!response.ok) throw new Error(`NASA search failed (HTTP ${response.status}).`);
      result = await response.json();
    } catch (error) {
      onlineError = error;
    }
  } else {
    onlineError = new Error('Backend is not connected.');
  }

  if (result) {
    AstroApp.nasaSource = result.source || 'NASA_OSDR_API';
    const datasets = Array.isArray(result.datasets) ? result.datasets : [];
    AstroApp.nasaDatasets = reset ? datasets : AstroApp.nasaDatasets.concat(datasets);
    AstroApp.nasaOffset += datasets.length;
    AstroApp.nasaTotal = Number(result.total) || 0;
    renderOSDRResults();
    if (status) status.textContent = `${AstroApp.nasaTotal} matching records · ${AstroApp.nasaSource.replaceAll('_', ' ')} · Historical research, not live crew telemetry.`;
    if (moreButton) moreButton.classList.toggle('hidden', AstroApp.nasaOffset >= AstroApp.nasaTotal || datasets.length === 0);
  } else {
    const normalizedQuery = (category && (!query || query.toLowerCase() === 'spaceflight') ? category : query).toLowerCase();
    const matches = OFFLINE_OSDR_DATASETS.filter(dataset => {
      const text = [dataset.title, dataset.description, dataset.organism, dataset.subject_type, dataset.mission, dataset.measurement_type, dataset.category].join(' ').toLowerCase();
      return (!normalizedQuery || text.includes(normalizedQuery) || normalizedQuery.split(/\s+/).every(word => text.includes(word)));
    });
    const page = matches.slice(AstroApp.nasaOffset, AstroApp.nasaOffset + 10);
    AstroApp.nasaDatasets = reset ? page : AstroApp.nasaDatasets.concat(page);
    AstroApp.nasaOffset += page.length;
    AstroApp.nasaTotal = matches.length;
    AstroApp.nasaSource = 'CURATED_OFFLINE_CACHE';
    renderOSDRResults();
    if (status) status.textContent = `${matches.length} verified offline catalogue record(s)${onlineError ? ` · ${onlineError.message}` : ''}. Catalogue may not contain the full NASA collection.`;
    if (moreButton) moreButton.classList.toggle('hidden', AstroApp.nasaOffset >= matches.length || page.length === 0);
  }
  if (button) button.disabled = false;
  if (moreButton) moreButton.disabled = false;
}

function renderOSDRResults() {
  const container = document.getElementById('osdr-results-container');
  if (!container) return;
  if (!AstroApp.nasaDatasets.length) {
    container.innerHTML = '<p class="col-span-full rounded-lg border border-outline-variant/30 p-4 text-xs text-on-surface-variant">No matching records. Try another term or category.</p>';
    return;
  }
  container.innerHTML = AstroApp.nasaDatasets.map(dataset => {
    const accession = dataset.accession || dataset.id || 'Unknown accession';
    const metadataAvailable = dataset.metadata_available !== false;
    return `
      <article class="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high space-y-2">
        <div class="flex flex-wrap justify-between items-center gap-2">
          <span class="text-xs font-label-sm font-bold text-primary">${escapeHTML(accession)}</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded bg-primary-container/20 text-primary font-semibold">${escapeHTML(dataset.source_category || 'REAL_NASA_RESEARCH')}</span>
        </div>
        <h3 class="text-sm font-headline-md font-bold text-on-surface">${escapeHTML(dataset.title || 'Title not available')}</h3>
        <p class="text-xs text-on-surface-variant">${escapeHTML(dataset.description || 'Description not available in search metadata.')}</p>
        <dl class="grid grid-cols-1 gap-1 text-[10px] text-on-surface-variant">
          <div><dt class="inline font-bold">Population:</dt> <dd class="inline">${escapeHTML(dataset.organism || 'Not specified in search record')} · ${escapeHTML(dataset.subject_type || 'subject type not specified')}</dd></div>
          <div><dt class="inline font-bold">Measurement:</dt> <dd class="inline">${escapeHTML(dataset.measurement_type || 'Not specified in search record')}</dd></div>
          <div><dt class="inline font-bold">Mission/study:</dt> <dd class="inline">${escapeHTML(dataset.mission || 'Not specified in search record')}</dd></div>
        </dl>
        ${metadataAvailable ? `<button type="button" data-osdr-action="details" data-accession="${escapeHTML(accession)}" class="rounded-md border border-outline-variant/40 px-2.5 py-1.5 text-[10px] font-bold text-primary hover:border-primary-container">Review metadata &amp; files</button>` : '<span class="text-[10px] text-on-surface-variant">OSD accession detail endpoint not available for this search identifier.</span>'}
      </article>`;
  }).join('');
}

async function openOSDRDataset(accession) {
  const panel = document.getElementById('osdr-dataset-details');
  const status = document.getElementById('osdr-search-status');
  if (!panel) return;
  panel.classList.remove('hidden');
  panel.innerHTML = '<p class="text-xs text-on-surface-variant">Loading dataset metadata and file access information…</p>';
  AstroApp.nasaActiveDataset = accession;
  AstroApp.nasaFilePage = 1;
  try {
    let detail;
    if (AstroApp.isBackendConnected) {
      const response = await fetch(`${API_BASE}/api/nasa/dataset/${encodeURIComponent(accession)}`);
      if (!response.ok) throw new Error(`Metadata unavailable (HTTP ${response.status}).`);
      detail = await response.json();
    } else {
      const dataset = OFFLINE_OSDR_DATASETS.find(item => item.accession === accession);
      if (!dataset) throw new Error('This dataset is not included in the verified offline catalogue.');
      detail = { dataset, source: 'CURATED_OFFLINE_CACHE', validation: { status: 'RESEARCH_REVIEW_REQUIRED', checks: [], limitations: dataset.limitations }, study_summary: {}, files: [], file_count: 0 };
    }
    renderOSDRDetails(detail);
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    panel.innerHTML = `<p role="alert" class="text-xs text-error">${escapeHTML(error.message)}</p>`;
    if (status) status.textContent = `Unable to open dataset detail: ${error.message}`;
  }
}

function renderOSDRDetails(detail, filePage = null) {
  const panel = document.getElementById('osdr-dataset-details');
  const dataset = detail.dataset || {};
  const validation = detail.validation || {};
  const checks = validation.checks || [];
  const limitations = validation.limitations || dataset.limitations || [];
  const files = filePage?.files || detail.files || [];
  const page = filePage?.page || 1;
  const pages = filePage?.page_total || detail.file_page_total || 1;
  const fileButtons = files.length ? files.map(file => `
    <li class="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/20 py-2 text-[10px]">
      <span class="min-w-0 break-all">${escapeHTML(file.name)} <span class="text-on-surface-variant">(${file.size_bytes == null ? 'size not reported' : `${(file.size_bytes / 1048576).toFixed(2)} MiB`}) · ${escapeHTML(file.category || 'category not specified')}</span></span>
      ${file.download_available ? `<button type="button" data-osdr-action="download" data-accession="${escapeHTML(dataset.accession)}" data-file-name="${escapeHTML(file.name)}" data-page="${page}" class="shrink-0 rounded border border-outline-variant/40 px-2 py-1 text-primary">Download &amp; checksum</button>` : '<span class="text-on-surface-variant">Not publicly downloadable</span>'}
    </li>`).join('') : '<li class="py-2 text-[10px] text-on-surface-variant">No public files are listed in this cached response. Connect to NASA OSDR to discover files.</li>';
  panel.innerHTML = `
    <div class="flex items-start justify-between gap-3">
      <div><p class="text-[10px] font-bold uppercase text-primary">${escapeHTML(dataset.accession || dataset.id || '')} · ${escapeHTML(detail.source || 'NASA_OSDR_API')}</p><h3 class="mt-1 text-base font-bold text-on-surface">${escapeHTML(dataset.title || 'Title not available')}</h3></div>
      <button type="button" data-osdr-action="close" class="text-xs text-on-surface-variant" aria-label="Close dataset details">Close</button>
    </div>
    <p class="mt-2 text-xs leading-relaxed text-on-surface-variant">${escapeHTML(dataset.description || 'Description unavailable.')}</p>
    <div class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px]">
      <p><strong>Organism:</strong> ${escapeHTML(dataset.organism || 'Not specified')}</p><p><strong>Subject type:</strong> ${escapeHTML(dataset.subject_type || 'Not specified')}</p>
      <p><strong>Mission:</strong> ${escapeHTML(dataset.mission || 'Not specified')}</p><p><strong>Study design:</strong> ${escapeHTML(dataset.study_design || 'Not specified')}</p>
      <p><strong>Measurement type:</strong> ${escapeHTML(dataset.measurement_type || 'Not specified')}</p><p><strong>Version:</strong> ${escapeHTML(dataset.version ?? 'Not specified')}</p>
      <p class="break-all md:col-span-2"><strong>Source:</strong> <a class="underline text-primary" href="${escapeHTML(dataset.source_url || '')}" target="_blank" rel="noopener noreferrer">${escapeHTML(dataset.source_url || 'NASA OSDR')}</a></p>
    </div>
    <div class="mt-3 rounded-lg border border-tertiary-container/30 bg-tertiary-container/10 p-2 text-[10px]"><strong>${escapeHTML(validation.status || 'RESEARCH_REVIEW_REQUIRED')}:</strong> Metadata checks are not scientific or clinical validation. Not current astronaut telemetry and never auto-imported into crew records.</div>
    ${checks.length ? `<h4 class="mt-3 text-xs font-bold">Import/relevance checks</h4><ul class="mt-1 grid grid-cols-1 md:grid-cols-2 gap-1">${checks.map(check => `<li class="text-[10px]"><strong>${escapeHTML(check.field)}:</strong> ${escapeHTML(check.status)} · ${escapeHTML(check.value)}</li>`).join('')}</ul>` : ''}
    ${limitations.length ? `<h4 class="mt-3 text-xs font-bold">Limitations</h4><ul class="mt-1 list-disc pl-4 text-[10px] text-on-surface-variant">${limitations.map(item => `<li>${escapeHTML(item)}</li>`).join('')}</ul>` : ''}
    <div class="mt-4"><div class="flex flex-wrap items-center justify-between gap-2"><h4 class="text-xs font-bold">Dataset files (${escapeHTML(detail.file_count ?? files.length)})</h4>${pages > 1 ? `<div class="flex gap-2"><button type="button" data-osdr-action="files" data-accession="${escapeHTML(dataset.accession)}" data-page="${Math.max(1, page - 1)}" ${page <= 1 ? 'disabled' : ''} class="rounded border px-2 py-1 text-[10px] disabled:opacity-40">Previous</button><span class="text-[10px]">Page ${page} of ${pages}</span><button type="button" data-osdr-action="files" data-accession="${escapeHTML(dataset.accession)}" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''} class="rounded border px-2 py-1 text-[10px] disabled:opacity-40">Next</button></div>` : ''}</div><ul class="mt-1">${fileButtons}</ul></div>
    <p id="osdr-download-status" role="status" class="mt-2 break-all text-[10px] text-on-surface-variant"></p>`;
  panel.querySelector('[data-osdr-action="close"]')?.addEventListener('click', () => panel.classList.add('hidden'));
}

async function loadOSDRFilePage(accession, page) {
  if (!AstroApp.isBackendConnected || page < 1) return;
  const panel = document.getElementById('osdr-dataset-details');
  try {
    const response = await fetch(`${API_BASE}/api/nasa/dataset/${encodeURIComponent(accession)}/files?page=${page}&page_size=25`);
    if (!response.ok) throw new Error(`File listing failed (HTTP ${response.status}).`);
    const files = await response.json();
    AstroApp.nasaFilePage = page;
    const detailResponse = await fetch(`${API_BASE}/api/nasa/dataset/${encodeURIComponent(accession)}`);
    if (!detailResponse.ok) throw new Error(`Dataset metadata failed (HTTP ${detailResponse.status}).`);
    renderOSDRDetails(await detailResponse.json(), files);
  } catch (error) {
    const status = panel?.querySelector('#osdr-download-status');
    if (status) status.textContent = error.message;
  }
}

async function downloadOSDRFile(accession, fileName, page) {
  const status = document.getElementById('osdr-download-status');
  if (!AstroApp.isBackendConnected) {
    if (status) status.textContent = 'Downloads require the local ASTRA backend. No file was downloaded.';
    return;
  }
  if (status) status.textContent = 'Downloading the listed public file to the backend data/nasa_downloads store…';
  try {
    const response = await fetch(`${API_BASE}/api/nasa/dataset/${encodeURIComponent(accession)}/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_name: fileName, page })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || `Download failed (HTTP ${response.status}).`);
    if (status) status.textContent = `Saved unchanged at ${result.stored_file} · ${result.size_bytes} bytes · SHA-256 ${result.sha256} · version ${result.dataset_version ?? 'unknown'}`;
  } catch (error) {
    if (status) status.textContent = `Download error: ${error.message}`;
  }
}

async function loadBOM() {
  let components = [];
  if (AstroApp.isBackendConnected) {
    try {
      const res = await fetch(`${API_BASE}/api/hardware/bom`).then(r => r.json());
      components = res.components || [];
    } catch (e) {}
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

function renderBodyScanAnalysis(force = false) {
  const now = Date.now();
  if (!force && now - AstroApp.bodyScanLastRenderedAt < 5000) return;
  AstroApp.bodyScanLastRenderedAt = now;
  const astro = AstroApp.crew.find(c => c.id === AstroApp.activeAstronautId) || DEFAULT_CREW[0];
  const current = AstroApp.telemetry[astro.id] || {};
  const historySamples = [];
  const twin = AstroApp.healthTwin?.digital_health_twin;
  if (Array.isArray(twin?.recent_vitals_sample)) {
    historySamples.push(...twin.recent_vitals_sample);
  }
  if (historySamples.length === 0 && current.hr != null) {
    historySamples.push(current);
  }
  const validSamples = historySamples.filter(sample => sample && Number.isFinite(Number(sample.hr || sample.hr === 0 ? sample.hr : NaN)));
  const numericHr = validSamples.length ? validSamples.map(s => Number(s.hr)).filter(n => Number.isFinite(n)) : [Number(current.hr ?? astro.baseline_hr ?? 70)];
  const currentHr = Number(current.hr ?? numericHr[numericHr.length - 1] ?? astro.baseline_hr ?? 70);
  const currentSpo2 = Number(current.spo2 ?? astro.baseline_spo2 ?? 99);
  const currentBpSys = Number(current.bp_sys ?? astro.baseline_bp_sys ?? 120);
  const currentResp = Number(current.resp_rate ?? astro.baseline_resp_rate ?? 14);
  const currentHrv = Number(current.hrv ?? astro.baseline_hrv ?? 58);
  const recentAvgHr = numericHr.length ? numericHr.reduce((sum, v) => sum + v, 0) / numericHr.length : currentHr;
  const hrDelta = currentHr - recentAvgHr;
  const anomalySignal = Math.max(0, Math.min(100, ((Math.abs(hrDelta) * 2.2) + Math.max(0, 95 - currentSpo2) * 2 + Math.max(0, currentBpSys - 128) * 0.6 + Math.max(0, currentResp - 18) * 4)));

  const partStatuses = [
    { id: 'recovery', label: 'HRV recovery signal', value: `${Math.round(currentHrv)} ms`, status: currentHrv < 36 ? 'critical' : currentHrv < 52 ? 'warning' : 'normal', note: currentHrv < 36 ? 'Reduced HRV suggests fatigue and weaker recovery capacity.' : currentHrv < 52 ? 'HRV is below the configured reference; review the trend.' : 'Stable autonomic recovery pattern.' },
    { id: 'heart', label: 'Heart', value: `${Math.round(currentHr)} bpm`, status: currentHr > 110 || currentHr < 52 ? 'critical' : currentHr > 88 ? 'warning' : 'normal', note: currentHr > 110 ? 'Tachycardia risk rising above resting baseline.' : currentHr > 88 ? 'Elevated pacing likely from workload or stress exposure.' : 'Heart rate remains near personal baseline.' },
    { id: 'lungs', label: 'Lungs', value: `${Math.round(currentSpo2)}% SpO₂`, status: currentSpo2 < 94 ? 'critical' : currentSpo2 < 97 ? 'warning' : 'normal', note: currentSpo2 < 94 ? 'Oxygen delivery is reduced and may require intervention.' : currentSpo2 < 97 ? 'Oxygenation remains mildly reduced; continue monitoring.' : 'Oxygenation is within target range.' },
    { id: 'vascular', label: 'Vascular', value: `${Math.round(currentBpSys)} mmHg`, status: currentBpSys > 140 || currentBpSys < 95 ? 'critical' : currentBpSys > 120 ? 'warning' : 'normal', note: currentBpSys > 140 ? 'Blood pressure exceeds review threshold.' : currentBpSys > 120 ? 'Early pressure drift detected.' : 'Perfusion remains stable.' },
    { id: 'respiratory', label: 'Respiration', value: `${Math.round(currentResp)} /min`, status: currentResp > 20 || currentResp < 10 ? 'critical' : currentResp > 16 ? 'warning' : 'normal', note: currentResp > 20 ? 'Breathing rate elevated compared to baseline.' : currentResp > 16 ? 'Respiratory load slightly elevated.' : 'Respiration remains controlled.' },
    { id: 'radiation', label: 'Cabin radiation exposure', value: `${(Number(AstroApp.environment?.ambient_radiation_usvh ?? 18.5)).toFixed(1)} µSv/h`, status: Number(AstroApp.environment?.ambient_radiation_usvh ?? 18.5) > 100 ? 'critical' : Number(AstroApp.environment?.ambient_radiation_usvh ?? 18.5) > 40 ? 'warning' : 'normal', note: Number(AstroApp.environment?.ambient_radiation_usvh ?? 18.5) > 100 ? 'Dose rate is elevated and shelter/monitoring protocol should be reviewed.' : Number(AstroApp.environment?.ambient_radiation_usvh ?? 18.5) > 40 ? 'Dose accumulation is rising; continue radiation watch.' : 'Cabin dose-rate estimate is within the prototype reference range.' }
  ];

  const riskScore = Math.round(Math.min(99, Math.max(8, anomalySignal + (partStatuses.filter(p => p.status === 'critical').length * 12) + (partStatuses.filter(p => p.status === 'warning').length * 8))));
  const statusText = riskScore >= 72 ? 'High risk' : riskScore >= 44 ? 'Monitor' : 'Nominal';
  const statusColor = riskScore >= 72 ? '#ff5f6d' : riskScore >= 44 ? '#ffb347' : '#46e4a7';
  const summaryTag = document.getElementById('body-scan-summary-tag');
  if (summaryTag) {
    summaryTag.textContent = statusText;
    summaryTag.style.color = statusColor;
    summaryTag.style.borderColor = statusColor + '66';
    summaryTag.style.background = statusColor + '22';
  }

  const predictionEl = document.getElementById('body-scan-prediction');
  if (predictionEl) {
    const anomSummary = partStatuses.filter(part => part.status !== 'normal').slice(0, 2).map(part => `${part.label.toLowerCase()} ${part.status === 'critical' ? 'elevated risk' : 'watch notice'}`).join('; ');
    predictionEl.textContent = `Rule-based prototype indicator: ${statusText.toLowerCase()}. ${anomSummary || 'No monitored-system thresholds are currently flagged.'} Recent heart-rate samples show ${hrDelta > 0 ? 'an upward difference from the recent average' : 'no upward difference from the recent average'}. This is not a clinical prediction.`;
  }

  const riskScoreEl = document.getElementById('body-scan-risk-score');
  if (riskScoreEl) riskScoreEl.textContent = `${riskScore}/100`;
  const riskBar = document.getElementById('body-scan-risk-bar');
  if (riskBar) {
    riskBar.style.width = `${riskScore}%`;
    riskBar.style.background = riskScore >= 72 ? '#ff5f6d' : riskScore >= 44 ? '#ffb347' : '#46e4a7';
  }

  const partMap = {};
  partStatuses.forEach(part => {
    const statusColour = part.status === 'critical' ? '#ff5f6d' : part.status === 'warning' ? '#ffb347' : '#46e4a7';
    partMap[part.id] = statusColour;
  });
  const regionStyle = id => `fill="${partMap[id]}" fill-opacity=".26" stroke="${partMap[id]}" stroke-width="2"`;

  const bodyScanPanel = document.getElementById('body-scan-panel');
  if (bodyScanPanel) {
    bodyScanPanel.innerHTML = `
      <div class="grid grid-cols-[0.95fr_1.05fr] gap-3">
        <div class="flex items-center justify-center rounded-xl border border-outline-variant/30 bg-surface-container/60 p-2">
          <svg viewBox="0 0 260 460" class="w-full max-w-[250px] drop-shadow-[0_0_12px_rgba(0,229,255,0.2)]" role="img" aria-label="Illustrative front-view human body diagram with telemetry status regions">
            <defs>
              <linearGradient id="bodyFill" x1="0" y1="0" x2="0.9" y2="1">
                <stop offset="0%" stop-color="#29485d" />
                <stop offset="48%" stop-color="#1b344a" />
                <stop offset="100%" stop-color="#13243a" />
              </linearGradient>
            </defs>
            <ellipse cx="130" cy="240" rx="108" ry="207" fill="none" stroke="${partMap.radiation}" stroke-width="1.5" stroke-dasharray="3 8" opacity=".45" />
            <g fill="url(#bodyFill)" stroke="#5aa8b7" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">
              <circle cx="130" cy="45" r="26" />
              <path d="M121 72 C120 80 116 85 108 88 L99 91 C90 94 83 100 79 111 L61 159 C57 169 61 178 69 181 C77 184 83 179 86 171 L98 141 L95 188 C94 200 97 210 102 218 L108 230 C108 240 105 250 102 261 L96 299 L87 395 C86 406 91 413 100 413 C108 413 112 407 114 398 L130 328 L146 398 C148 407 152 413 160 413 C169 413 174 406 173 395 L164 299 L158 261 C155 250 152 240 152 230 L158 218 C163 210 166 200 165 188 L162 141 L174 171 C177 179 183 184 191 181 C199 178 203 169 199 159 L181 111 C177 100 170 94 161 91 L152 88 C144 85 140 80 139 72 Z" />
              <path d="M99 407 C95 416 87 421 77 426 C72 429 73 434 80 436 L111 436 L117 419 Z" />
              <path d="M161 407 C165 416 173 421 183 426 C188 429 187 434 180 436 L149 436 L143 419 Z" />
            </g>
            <path d="M112 125 C103 131 103 153 108 171 C111 179 119 182 126 175 L126 133 Z" ${regionStyle('lungs')} />
            <path d="M148 125 C157 131 157 153 152 171 C149 179 141 182 134 175 L134 133 Z" ${regionStyle('respiratory')} />
            <path d="M130 148 C125 142 117 146 117 153 C117 160 125 165 130 170 C135 165 143 160 143 153 C143 146 135 142 130 148 Z" ${regionStyle('heart')} />
            <circle cx="130" cy="184" r="8" fill="none" stroke="${partMap.recovery}" stroke-width="2.5" opacity=".9" />
            <path d="M130 171 C126 190 134 208 130 232 C127 249 125 262 123 278" fill="none" stroke="${partMap.vascular}" stroke-width="2.5" stroke-linecap="round" opacity=".8" />
          </svg>
        </div>

        <div class="space-y-2">
          ${partStatuses.map(part => `
            <div class="rounded-lg border border-outline-variant/30 bg-surface-container/60 p-2.5">
              <div class="flex items-center justify-between gap-2">
                <span class="text-[11px] font-headline-md text-on-surface">${part.label}</span>
                <span class="rounded-full border px-2 py-0.5 text-[9px] font-label-sm uppercase" style="border-color:${part.status === 'critical' ? '#ff5f6d66' : part.status === 'warning' ? '#ffb34766' : '#46e4a766'}; color:${part.status === 'critical' ? '#ff5f6d' : part.status === 'warning' ? '#ffb347' : '#46e4a7'}; background:${part.status === 'critical' ? '#ff5f6d22' : part.status === 'warning' ? '#ffb34722' : '#46e4a722'};">${part.status}</span>
              </div>
              <div class="mt-1 flex items-baseline justify-between gap-2">
                <span class="text-[11px] text-on-surface-variant">${part.value}</span>
                <span class="text-[9px] text-on-surface-variant">${part.note}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  const issuesList = document.getElementById('body-scan-issues');
  if (issuesList) {
    const active = partStatuses.filter(part => part.status !== 'normal').slice(0, 4);
    issuesList.innerHTML = active.length ? active.map(part => `
      <div class="rounded-lg border border-outline-variant/30 bg-surface-container p-2.5">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-label-sm uppercase text-on-surface-variant">${part.label}</span>
          <span class="text-[9px] font-label-sm uppercase ${part.status === 'critical' ? 'text-error' : 'text-tertiary-fixed-dim'}">${part.status}</span>
        </div>
        <p class="mt-1 text-[11px] text-on-surface-variant">${part.note}</p>
      </div>
    `).join('') : '<div class="rounded-lg border border-secondary/30 bg-secondary-container/10 p-3 text-[11px] text-secondary">No active body-system alerts. All monitored metrics are within the expected envelope for this astronaut.</div>';
  }

  const heartChart = document.getElementById('body-heart-chart');
  if (heartChart) {
    const heartSeries = validSamples.slice(0, 24).reverse()
      .map(sample => ({
        value: Number(sample.hr),
        timestamp: sample.timestamp,
        provenance: sample.provenance
      }))
      .filter(sample => Number.isFinite(sample.value));
    if (heartSeries.length === 0 && Number.isFinite(currentHr)) {
      heartSeries.push({
        value: currentHr,
        timestamp: current.timestamp || new Date().toISOString(),
        provenance: current.provenance
      });
    }

    const values = heartSeries.map(sample => sample.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const padding = Math.max(3, (maxValue - minValue) * 0.25);
    const yMin = Math.floor((minValue - padding) / 2) * 2;
    const yMax = Math.ceil((maxValue + padding) / 2) * 2;
    const width = 360;
    const height = 172;
    const left = 42;
    const right = 10;
    const top = 18;
    const bottom = 139;
    const chartWidth = width - left - right;
    const chartHeight = bottom - top;
    const y = value => bottom - ((value - yMin) / (yMax - yMin)) * chartHeight;
    const x = index => heartSeries.length < 2
      ? left + chartWidth / 2
      : left + (index / (heartSeries.length - 1)) * chartWidth;
    const coordinates = heartSeries.map((sample, index) => ({ x: x(index), y: y(sample.value), sample }));
    const linePath = coordinates.length > 1
      ? coordinates.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ')
      : '';
    const areaPath = coordinates.length > 1
      ? `${linePath} L ${coordinates[coordinates.length - 1].x.toFixed(1)} ${bottom} L ${coordinates[0].x.toFixed(1)} ${bottom} Z`
      : '';
    const yTicks = [yMax, Math.round((yMin + yMax) / 2), yMin];
    const formatTime = timestamp => {
      const date = new Date(timestamp || '');
      return Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    };
    const sourceCategories = [...new Set(heartSeries.map(sample => sample.provenance).filter(Boolean))];
    const context = document.getElementById('body-heart-context');
    if (context) {
      context.textContent = `${heartSeries.length} sample${heartSeries.length === 1 ? '' : 's'} · ${minValue}–${maxValue} bpm${sourceCategories.length ? ` · ${sourceCategories.join(', ')}` : ''}`;
    }
    heartChart.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" class="h-full w-full" role="img" aria-label="Heart-rate trend from ${heartSeries.length} stored sample${heartSeries.length === 1 ? '' : 's'}, ranging from ${minValue} to ${maxValue} beats per minute">
        <defs>
          <linearGradient id="heartAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#25c9ed" stop-opacity=".24" />
            <stop offset="100%" stop-color="#25c9ed" stop-opacity="0" />
          </linearGradient>
        </defs>
        ${yTicks.map(tick => `<g>
          <line x1="${left}" y1="${y(tick).toFixed(1)}" x2="${width - right}" y2="${y(tick).toFixed(1)}" stroke="#8ba3b5" stroke-opacity=".18" />
          <text x="${left - 8}" y="${(y(tick) + 3.5).toFixed(1)}" text-anchor="end" fill="#9fb4c5" font-size="10">${tick}</text>
        </g>`).join('')}
        <text x="${left}" y="10" fill="#9fb4c5" font-size="9">BPM</text>
        ${areaPath ? `<path d="${areaPath}" fill="url(#heartAreaFill)" />` : ''}
        ${linePath ? `<path d="${linePath}" fill="none" stroke="#43d5f2" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />` : ''}
        ${coordinates.map((point, index) => `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="${index === coordinates.length - 1 ? 4 : 2}" fill="${index === coordinates.length - 1 ? '#b6f2ff' : '#43d5f2'}" stroke="#122235" stroke-width="1.5" />`).join('')}
        <text x="${left}" y="${height - 7}" fill="#9fb4c5" font-size="9">${escapeHTML(formatTime(heartSeries[0]?.timestamp))}</text>
        <text x="${width - right}" y="${height - 7}" text-anchor="end" fill="#9fb4c5" font-size="9">${escapeHTML(formatTime(heartSeries[heartSeries.length - 1]?.timestamp))}</text>
      </svg>
    `;
    const liveBpm = document.getElementById('body-heart-live-bpm');
    if (liveBpm) liveBpm.textContent = `${Math.round(currentHr)} bpm`;
  }
}

function initHealthTimeline() {
  document.getElementById('twin-refresh-button')?.addEventListener('click', loadHealthTimeline);
  document.getElementById('twin-metric-select')?.addEventListener('change', () => {
    if (AstroApp.healthTwin) renderHealthTimeline(AstroApp.healthTwin);
  });
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
    if (status) status.textContent = 'Local backend unavailable. Standalone simulated readings are not saved as longitudinal health records.';
    if (refresh) refresh.disabled = false;
    return;
  }
  if (status) status.textContent = 'Loading stored health records…';
  try {
    const response = await fetch(`${API_BASE}/api/astronauts/${encodeURIComponent(astronautId)}`);
    if (!response.ok) throw new Error(`Health record request failed (HTTP ${response.status}).`);
    const twin = await response.json();
    if (requestId !== AstroApp.healthTwinRequestId) return;
    AstroApp.healthTwin = twin;
    renderHealthTimeline(twin);
    const sampleCount = twin.digital_health_twin?.stored_sample_count || 0;
    if (status) status.textContent = sampleCount
      ? `Loaded ${sampleCount} stored sample(s). The chart uses actual local database records; source categories are shown below.`
      : 'No stored measurements yet. The local backend saves simulated demonstration readings periodically; physical sensor packets are stored when received.';
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
  const samples = [...(twin?.recent_vitals_sample || [])].reverse();
  const metricSelect = document.getElementById('twin-metric-select');
  const metric = metricSelect?.value || 'hr';
  const metricInfo = {
    hr: { label: 'Heart rate', unit: 'bpm', baseline: 'baseline_hr' },
    spo2: { label: 'SpO₂', unit: '%', baseline: 'baseline_spo2' },
    resp_rate: { label: 'Respiratory rate', unit: '/min', baseline: 'baseline_resp_rate' },
    bp_sys: { label: 'Systolic blood pressure', unit: 'mmHg', baseline: 'baseline_bp_sys' }
  }[metric];
  const baselineValue = profile?.[metricInfo.baseline];
  const baseline = baselineValue != null && Number.isFinite(Number(baselineValue)) ? Number(baselineValue) : null;
  const usableSamples = samples.filter(sample => sample[metric] != null && Number.isFinite(Number(sample[metric])));
  const latest = usableSamples.length ? usableSamples[usableSamples.length - 1] : null;

  const baselineEl = document.getElementById('twin-base-hr');
  const latestEl = document.getElementById('twin-latest-hr');
  const countEl = document.getElementById('twin-sample-count');
  const completenessEl = document.getElementById('twin-completeness');
  if (baselineEl) baselineEl.textContent = profile?.baseline_hr == null ? '—' : `${formatCrewMetric(profile.baseline_hr)} bpm`;
  if (latestEl) latestEl.textContent = latest?.hr == null ? '—' : `${formatCrewMetric(latest.hr)} bpm`;
  if (countEl) countEl.textContent = String(twin?.stored_sample_count ?? samples.length);
  if (completenessEl) completenessEl.textContent = twin?.data_completeness_pct == null ? '—' : `${twin.data_completeness_pct}%`;

  const summary = document.getElementById('twin-metric-summary');
  const sourceLabel = document.getElementById('twin-chart-source');
  const baselineLegend = document.getElementById('twin-baseline-legend');
  const chart = document.getElementById('twin-chart-container');
  const baselineForMetric = baseline;
  if (baselineLegend) baselineLegend.textContent = baselineForMetric == null ? '' : `Personal ${metricInfo.label.toLowerCase()} baseline: ${formatCrewMetric(baselineForMetric)} ${metricInfo.unit}`;

  if (!usableSamples.length || !chart) {
    if (summary) summary.textContent = 'No stored measurements available';
    if (sourceLabel) sourceLabel.textContent = 'No stored sample timestamps or source labels to display.';
    if (chart) chart.innerHTML = '<div class="flex min-h-40 items-center justify-center px-4 text-center text-xs text-on-surface-variant">No stored values are available for this measurement yet.</div>';
    return;
  }

  const values = usableSamples.map(sample => Number(sample[metric]));
  const minValue = Math.min(...values, ...(baselineForMetric == null ? [] : [baselineForMetric]));
  const maxValue = Math.max(...values, ...(baselineForMetric == null ? [] : [baselineForMetric]));
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
    const py = y(value);
    return `<g><line x1="${left}" y1="${py}" x2="${width - right}" y2="${py}" stroke="currentColor" opacity=".12"/><text x="${left - 7}" y="${py + 3}" fill="currentColor" opacity=".65" text-anchor="end" font-size="9">${value.toFixed(1)}</text></g>`;
  }).join('');
  const baselineMarkup = baselineForMetric == null ? '' : `<line x1="${left}" y1="${y(baselineForMetric)}" x2="${width - right}" y2="${y(baselineForMetric)}" stroke="currentColor" stroke-dasharray="5 4" opacity=".7"/>`;
  const firstTime = new Date(usableSamples[0].timestamp);
  const lastTime = new Date(usableSamples[usableSamples.length - 1].timestamp);
  const timeRange = `${firstTime.toLocaleString()} – ${lastTime.toLocaleString()}`;
  const sourceCounts = twin?.source_counts || {};
  const sourceText = Object.entries(sourceCounts).map(([source, count]) => `${source}: ${count}`).join(' · ');
  const validValues = values.filter(Number.isFinite);
  const mean = validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
  if (summary) summary.textContent = `Latest ${formatCrewMetric(values[values.length - 1])} ${metricInfo.unit} · range ${formatCrewMetric(Math.min(...values))}–${formatCrewMetric(Math.max(...values))} · mean ${formatCrewMetric(mean)}`;
  if (sourceLabel) sourceLabel.textContent = `${sourceText || 'Source category not recorded'} · ${timeRange}`;
  chart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="block h-48 w-full text-primary" role="img" aria-label="${escapeHTML(metricInfo.label)} trend, ${usableSamples.length} stored measurements">
      ${yTicks}
      ${baselineMarkup}
      <polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${values.map((value, index) => `<circle cx="${x(index)}" cy="${y(value)}" r="${usableSamples.length > 30 ? 2 : 3.5}" fill="currentColor"><title>${escapeHTML(new Date(usableSamples[index].timestamp).toLocaleString())}: ${formatCrewMetric(value)} ${metricInfo.unit} · ${escapeHTML(usableSamples[index].provenance || 'SOURCE_NOT_RECORDED')}</title></circle>`).join('')}
      <text x="${left}" y="${height - 5}" fill="currentColor" opacity=".65" font-size="9">${escapeHTML(firstTime.toLocaleTimeString())}</text>
      <text x="${width - right}" y="${height - 5}" fill="currentColor" opacity=".65" text-anchor="end" font-size="9">${escapeHTML(lastTime.toLocaleTimeString())}</text>
    </svg>`;
  renderBodyScanAnalysis(true);
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
  const modalBody = document.getElementById('modal-body');
  if (modalBody) modalBody.className = 'space-y-4';
  const panel = document.getElementById('app-modal-panel');
  if (panel) {
    panel.classList.remove('max-w-3xl', 'h-[min(88vh,780px)]', 'flex', 'flex-col');
    panel.classList.add('max-h-[85vh]', 'overflow-y-auto');
  }
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
