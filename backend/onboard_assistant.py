"""
ASTRA - Autonomous Spaceflight Health Intelligence
Onboard Flight Medical Knowledge Engine (Offline Fallback & Spaceflight Clinical AI)
Provides neat, high-fidelity, evidence-based educational health responses
when remote cloud LLM providers (e.g., Groq) are blocked, rate-limited, or unreachable during comm blackouts.
"""

import re
from typing import List, Dict, Optional

SPACE_MEDICAL_TOPICS = {
    "bone": {
        "keywords": ["bone", "osteopenia", "osteoporosis", "density", "calcium", "skeletal", "fracture", "resorption", "ared"],
        "title": "Microgravity & Astronaut Bone Health",
        "content": (
            "### Microgravity & Astronaut Bone Mineral Density (BMD)\n\n"
            "In Earth gravity, the musculoskeletal system constantly counters gravitational loading (Wolff's Law). "
            "In microgravity, bone mineral unloading induces rapid bone resorption:\n\n"
            "- **Resorption Rate**: Astronauts lose approximately **1.0% to 1.5% of bone mineral density per month** in weight-bearing bones (lumbar spine, femoral neck, calcaneus) if uncountered.\n"
            "- **Cellular Mechanism**: Osteoclast activity (bone breakdown) accelerates while osteoblast activity (bone formation) decreases. Urinary calcium excretion spikes, elevating renal stone risk.\n"
            "- **Countermeasures**:\n"
            "  1. **ARED (Advanced Resistive Exercise Device)**: High-load squats, deadlifts, and heel raises generating up to 2,600 N (600 lbs) of simulated Earth force daily.\n"
            "  2. **Nutritional Support**: Adequate Vitamin D (800–1000 IU/day) and balanced calcium intake.\n"
            "  3. **Pharmacological Protocols**: Bisphosphonates (e.g., zoledronic acid) evaluated for multi-year missions to Mars.\n"
            "- **Mission Recovery**: Post-flight recovery typically takes 1.5 to 2.5 times the mission duration."
        )
    },
    "sms": {
        "keywords": ["motion sickness", "sms", "sas", "vomit", "nausea", "dizzy", "dizziness", "vertigo", "vestibular", "ear", "orientation"],
        "title": "Space Motion Sickness (SMS) & Vestibular Neuroadaptation",
        "content": (
            "### Space Motion Sickness (SMS) / Space Adaptation Syndrome (SAS)\n\n"
            "Space Motion Sickness affects approximately **70% to 80% of astronauts** during the initial 48 to 72 hours of microgravity exposure:\n\n"
            "- **Physiological Etiology**: Sensory conflict (neural mismatch) occurs between the inner ear vestibular otolith organs (which no longer receive gravitational vector pull) and the semicircular canals and visual cues.\n"
            "- **Classic Symptoms**: Nausea, sudden cold sweating, vomiting (without prior warning), stomach awareness, anorexia, and disorientation.\n"
            "- **Operational Clinical Protocols**:\n"
            "  1. **Pharmacological Countermeasure**: Intramuscular or oral Promethazine (25–50 mg) or sublingual Ondansetron (4–8 mg).\n"
            "  2. **Movement Limitation**: Avoid rapid head roll/pitch maneuvers and head rotations outside the visual axis.\n"
            "  3. **Airlock/EVA Safety**: Spacewalks are strictly prohibited during the first 3 mission days due to the lethal risk of emesis inside an airtight space suit helmet.\n"
            "- **Resolution**: The central nervous system re-weights sensory inputs, leading to full neuroadaptation within 3 to 5 flight days."
        )
    },
    "fluid_shift": {
        "keywords": ["fluid", "shift", "cephalad", "puffy", "swelling", "face", "edema", "intracranial", "jugular", "blood volume"],
        "title": "Cephalad Microgravity Fluid Redistribution",
        "content": (
            "### Cephalad Fluid Shift in Microgravity\n\n"
            "Without Earth's $1g$ downward gravitational gradient, approximately **1.5 to 2.0 liters of blood and interstitial fluid shift upward** toward the head, neck, and thorax:\n\n"
            "- **Acute Manifestations**:\n"
            "  - Puffy face, periorbital edema, and nasal congestion ('space sniffles').\n"
            "  - Reduction in lower-limb circumference ('bird leg syndrome').\n"
            "  - Prominent jugular vein distension and elevated central venous pressure.\n"
            "- **Baroreceptor Reflex & Compensation**:\n"
            "  - Central volume receptors in the right atrium detect transient fluid overload, triggering a suppression of the renin-angiotensin-aldosterone axis and an increase in atrial natriuretic peptide (ANP).\n"
            "  - Total circulating plasma volume decreases by **10% to 15%** within 48 hours to establish a new hypovolemic baseline.\n"
            "- **Countermeasures**: Lower Body Negative Pressure (LBNP / Chibis device), active cycle ergometer protocols, and oral fluid loading prior to atmospheric re-entry."
        )
    },
    "sans": {
        "keywords": ["sans", "eye", "vision", "optic", "retina", "blur", "papilledema", "disc", "nerve", "intracranial pressure", "icp", "hyperopic"],
        "title": "Spaceflight-Associated Neuro-Ocular Syndrome (SANS)",
        "content": (
            "### Spaceflight-Associated Neuro-Ocular Syndrome (SANS)\n\n"
            "SANS is a documented ocular and neurological condition observed in astronauts on long-duration ISS and deep-space missions:\n\n"
            "- **Key Signs & Findings**:\n"
            "  - **Optic Disc Edema (Papilledema)**: Swelling of the optic nerve head, graded via the Frisén scale (Grade 0 to Grade 5).\n"
            "  - **Globe Flattening**: Posterior flattening of the ocular globe causing a hyperopic (farsighted) shift in refractive error.\n"
            "  - **Choroidal Folds & Cotton Wool Spots**: Micro-infarctions and tissue wrinkling of the retina.\n"
            "  - **Optic Nerve Sheath Diameter (ONSD)**: Distension exceeding $5.8\\text{ mm}$ evaluated via high-resolution ultrasound.\n"
            "- **Pathophysiology**: Chronic lack of gravitational venous drainage leads to persistent mildly elevated intracranial pressure (ICP) and venous congestion in the dural sinuses.\n"
            "- **Clinical Monitoring**: Regular onboard Optical Coherence Tomography (OCT), fundoscopy, and visual acuity charts (Snellen equivalent)."
        )
    },
    "cardio": {
        "keywords": ["heart", "cardio", "cardiovascular", "hr", "hrv", "bpm", "pulse", "arrhythmia", "blood pressure", "tachycardia", "bradycardia", "stroke volume"],
        "title": "Cardiovascular Adaptation & Heart Rate Dynamics",
        "content": (
            "### Cardiovascular Deconditioning & Autonomic Regulation in Spaceflight\n\n"
            "Microgravity removes the hydrostatic pressure column that normally requires the human heart to pump against gravity:\n\n"
            "- **Cardiac Workload Reduction**: Because the heart does not work as hard to maintain cerebral perfusion, left ventricular mass decreases by roughly **8% to 10%** over a 6-month mission if unconditioned.\n"
            "- **Heart Rate & Heart Rate Variability (HRV)**:\n"
            "  - **Resting Heart Rate (HR)**: Typically remains near pre-flight baseline ($60\\text{--}75\\text{ BPM}$) or elevates slightly due to sympathetic tone.\n"
            "  - **HRV (SDNN / RMSSD)**: Measures beat-to-beat parasympathetic vs. sympathetic autonomic balance. High HRV ($>50\\text{ ms}$) indicates cardiovascular fitness and parasympathetic recovery; declining HRV signals physical fatigue, systemic illness, or stress.\n"
            "- **Orthostatic Intolerance**: Upon return to gravity, the re-established downward fluid shift combined with decreased vascular resistance frequently causes post-flight presyncope (dizziness when standing).\n"
            "- **Countermeasures**: Daily high-intensity interval cycle ergometer workouts and re-entry anti-$g$ suit compression."
        )
    },
    "radiation": {
        "keywords": ["radiation", "cosmic", "gcr", "spe", "flare", "proton", "dosimeter", "msv", "shield", "storm shelter"],
        "title": "Space Radiation: Galactic Cosmic Rays & Solar Particle Events",
        "content": (
            "### Space Radiation Environment: GCRs and Solar Flares\n\n"
            "Beyond Earth's protective magnetosphere and atmosphere, astronauts face two major radiation sources:\n\n"
            "1. **Galactic Cosmic Rays (GCR)**: High-energy, heavy charged nuclei (HZE ions such as Iron-56) originating outside the solar system. Penetrating and difficult to shield; creates continuous background dose rates of **$0.4\\text{ to }0.7\\text{ mSv/day}$**.\n"
            "2. **Solar Particle Events (SPE)**: Sporadic, high-flux coronal mass ejections composed primarily of high-energy protons. Capable of causing acute radiation syndrome (ARS) if unprotected.\n\n"
            "- **Safety Limits**: NASA guidelines limit lifetime astronaut radiation exposure to **$350\\text{--}600\\text{ mSv}$** (based on a $3\\%$ maximum lifetime risk of radiation-induced cancer death).\n"
            "- **Spacecraft Mitigation Protocols**:\n"
            "  - **Polyethylene & Water Walls**: Low-Z hydrogen-rich materials are optimal for absorbing protons and neutron secondary emissions.\n"
            "  - **Storm Shelters**: Retracting into central service modules flanked by potable and grey water tanks during active SPE alerts."
        )
    },
    "sleep": {
        "keywords": ["sleep", "circadian", "fatigue", "tired", "pvt", "reaction", "insomnia", "alertness", "debt", "wake"],
        "title": "Circadian Rhythm Disruption & Astronaut Fatigue",
        "content": (
            "### Circadian Rhythms & Psychomotor Vigilance (PVT)\n\n"
            "In Low Earth Orbit aboard the International Space Station, astronauts witness a sunrise or sunset every **90 minutes** (16 day/night cycles every 24 hours):\n\n"
            "- **Circadian Desynchrony**: Disruption of the suprachiasmatic nucleus suppresses natural melatonin surges, frequently resulting in sleep fragmentation and an average sleep duration of only **5.8 to 6.2 hours per night**.\n"
            "- **Psychomotor Vigilance Task (PVT)**:\n"
            "  - A gold-standard 3-minute or 10-minute visual reaction time test that detects cognitive microsleeps and sustained attention lapses ($>500\\text{ ms}$).\n"
            "  - Mean reaction times under $250\\text{ ms}$ indicate normal alertness; response times $>350\\text{ ms}$ or multiple lapses indicate critical fatigue.\n"
            "- **Sleep Hygiene Countermeasures**:\n"
            "  1. **Solid-State Dynamic Lighting**: Blue-enriched morning light ($480\\text{ nm}$) to promote cortisol and alertness; red-shifted light before sleep.\n"
            "  2. **Sleeping Quarters**: Soundproof individual crew quarters with active air ventilation to prevent local $CO_2$ pockets."
        )
    },
    "cpr": {
        "keywords": ["cpr", "arrest", "resuscitation", "chest compression", "defibrillator", "aed", "emergency", "airway", "resuscitate"],
        "title": "Microgravity Cardiac Resuscitation Protocols",
        "content": (
            "### Resuscitation & Cardiopulmonary Support in Microgravity\n\n"
            "Performing chest compressions in microgravity is governed by Newton's Third Law (equal and opposite reaction), requiring specialized techniques:\n\n"
            "- **The Tethering Imperative**: The patient must be immediately strapped to the **Crew Medical Restraint System (CMRS)** backboard to prevent floating away.\n"
            "- **Compression Techniques**:\n"
            "  1. **Handstand Technique**: The rescuer places their feet against the opposing spacecraft bulkhead ceiling and pushes downward onto the patient's sternum with arms locked.\n"
            "  2. **Over-the-Head (Mackaill) Method**: Straddling the patient's head with knees clamped to the patient's torso, compressing from behind.\n"
            "- **Defibrillation**: Standard biphasic AED pads applied in anterolateral position. Rescuer must ensure zero moisture bridging between electrodes.\n"
            "- **Emergency Checklist**: Immediate activation of Procedure `EMERG-CARD-01` and communication with Houston Flight Surgeon console."
        )
    }
}


def get_onboard_medical_guidance(query: str, history: Optional[List[Dict[str, str]]] = None) -> str:
    """
    Returns an educational, evidence-based, neatly structured medical response
    from the onboard spaceflight medical knowledge engine.
    """
    cleaned_query = query.lower()

    # 1. Topic Matching via Keywords
    best_topic = None
    best_score = 0
    for topic_key, data in SPACE_MEDICAL_TOPICS.items():
        score = sum(1 for kw in data["keywords"] if kw in cleaned_query)
        if score > best_score:
            best_score = score
            best_topic = data

    if best_topic and best_score > 0:
        return (
            f"{best_topic['content']}\n\n"
            "---\n"
            "*(Generated via AstroAI Onboard Flight Medical Engine · Autonomous Mission Protocol · Educational Guidance Only)*"
        )

    # 2. General Health / Spaceflight Physiology Overview Fallback
    return (
        "### AstroAI Spaceflight Health Intelligence\n\n"
        "Welcome! I am **AstroAI**, your aerospace physiology and spaceflight health companion. "
        "Here is key medical guidance regarding adaptation to the spaceflight environment:\n\n"
        "- **Cardiovascular & Hemodynamics**: Microgravity induces cephalad fluid shift (~2L upward). Resting heart rate typically stabilizes around personal baseline ($60\\text{--}75\\text{ BPM}$), while stroke volume and autonomic HRV reflect adaptation.\n"
        "- **Neuro-Vestibular**: Space Motion Sickness affects up to 80% of crew during the first 72 hours. Avoid rapid head movements; full central neuroadaptation occurs within 3 to 5 days.\n"
        "- **Musculoskeletal Protection**: Without 1g gravity loading, bone density decreases ~1% per month in weight-bearing bones. Crew adhere to mandatory 2.5 hours of daily resistive (ARED) and cardiovascular exercise.\n"
        "- **Neuro-Ocular Health (SANS)**: Upward venous pressures can cause optic disc edema (papilledema). Regular fundoscopy and optic nerve sheath diameter (ONSD) screening ensure ICP remains safe.\n"
        "- **Cognitive Alertness**: Monitored via the 3-minute Psychomotor Vigilance Task (PVT) to catch fatigue from 90-minute orbital day/night cycles.\n\n"
        "**Clinical Notice**: *AstroAI provides educational spaceflight physiology information, not medical diagnosis or prescription. "
        "For acute clinical emergencies, consult the flight surgeon and execute the approved emergency checklists.*\n\n"
        "---\n"
        "*(Generated via AstroAI Onboard Flight Medical Engine · Autonomous Mission Protocol)*"
    )
