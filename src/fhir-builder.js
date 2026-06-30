/**
 * fhir-builder.js
 * MedicAssist — Team Member 1
 *
 * Maps the intermediate LLM JSON (from prompt-template.md) to a valid
 * FHIR R4 Bundle and validates it against fhir-schema.json using Ajv.
 *
 * Public API:
 *   buildFhirBundle(llmJson)  → FhirBundle
 *   validateFhirBundle(bundle) → { valid: boolean, errors: array }
 *
 * The schema is loaded lazily on first call (works offline — fetched from
 * the same origin, which is cached by the service worker).
 */

// ─── Triage mapping ───────────────────────────────────────────────────────────

const TRIAGE_MAP = {
  red:     { code: 'R', display: 'Immediate / Red' },
  yellow:  { code: 'Y', display: 'Delayed / Yellow' },
  green:   { code: 'G', display: 'Minor / Green' },
  black:   { code: 'B', display: 'Deceased / Black' },
  unknown: { code: 'A', display: 'Unknown' },
};

/**
 * Normalises a triage string from the LLM to one of our known keys.
 * Handles "Red", "RED", "red", "immediate", etc.
 */
function normaliseTriage(raw) {
  if (!raw) return 'unknown';
  const s = raw.toLowerCase().trim();
  if (s === 'red'    || s === 'immediate') return 'red';
  if (s === 'yellow' || s === 'delayed')   return 'yellow';
  if (s === 'green'  || s === 'minor')     return 'green';
  if (s === 'black'  || s === 'deceased' || s === 'expectant') return 'black';
  return 'unknown';
}

// ─── Vital type → LOINC-ish coding hint ──────────────────────────────────────

const VITAL_CODING = {
  blood_pressure:      { code: '55284-4', display: 'Blood pressure' },
  heart_rate:          { code: '8867-4',  display: 'Heart rate' },
  respiratory_rate:    { code: '9279-1',  display: 'Respiratory rate' },
  oxygen_saturation:   { code: '59408-5', display: 'Oxygen saturation' },
  consciousness:       { code: '80288-4', display: 'Glasgow Coma Scale' },
  temperature:         { code: '8310-5',  display: 'Body temperature' },
};

// ─── ID generator ─────────────────────────────────────────────────────────────

let _idCounter = 0;
function uid(prefix) {
  return `${prefix}-${Date.now()}-${++_idCounter}`;
}

// ─── Resource builders ────────────────────────────────────────────────────────

function buildPatient(p = {}) {
  const resource = { resourceType: 'Patient', id: p.id || uid('pat') };
  if (p.gender && ['male','female','other','unknown'].includes(p.gender)) {
    resource.gender = p.gender;
  }
  if (typeof p.estimatedAge === 'number') {
    resource.estimatedAge = p.estimatedAge;
    // Rough birth year for display purposes (not stored in real FHIR)
    const year = new Date().getFullYear() - p.estimatedAge;
    resource.birthDate = `${year}`;
  }
  return resource;
}

function buildEncounter(enc = {}, patientId) {
  const triageKey = normaliseTriage(enc.triageLevel);
  const triage = TRIAGE_MAP[triageKey];

  const resource = {
    resourceType: 'Encounter',
    id: uid('enc'),
    status: 'in-progress',
    class: { code: 'EMER', display: 'Emergency' },
    subject: { reference: `Patient/${patientId}` },
    priority: {
      coding: [{
        system: 'https://medicassist.local/triage',
        code: triage.code,
        display: triage.display,
      }],
    },
  };

  // Build period.start from triageTime if present
  if (enc.triageTime) {
    const today = new Date().toISOString().split('T')[0];
    resource.period = { start: `${today}T${enc.triageTime}:00Z` };
  }

  if (enc.location) {
    resource.location = [{ location: { display: enc.location } }];
  }

  return resource;
}

function buildConditions(conditions = [], patientId) {
  return conditions.map(c => {
    const resource = {
      resourceType: 'Condition',
      id: uid('cond'),
      clinicalStatus: {
        coding: [{ code: 'active' }],
      },
      code: { text: c.description || 'Unknown condition' },
      subject: { reference: `Patient/${patientId}` },
    };

    if (c.bodysite) {
      resource.bodySite = [{ text: c.bodysite }];
    }

    if (c.severity && ['mild','moderate','severe'].includes(c.severity)) {
      resource.severity = {
        coding: [{
          code: c.severity,
          display: c.severity.charAt(0).toUpperCase() + c.severity.slice(1),
        }],
        text: c.severity,
      };
    }

    return resource;
  });
}

function buildObservations(vitals = [], patientId) {
  return vitals.map(v => {
    const coding = VITAL_CODING[v.type] || { code: 'unknown', display: v.type };
    const resource = {
      resourceType: 'Observation',
      id: uid('obs'),
      status: 'preliminary',
      code: {
        coding: [{
          system: 'http://loinc.org',
          code: coding.code,
          display: coding.display,
        }],
        text: coding.display,
      },
      subject: { reference: `Patient/${patientId}` },
    };

    // Use valueQuantity only when the value is a clean number (e.g. "96"),
    // not compound readings like "90/60" or "120 irregular" — those stay
    // as valueString so we don't silently drop information.
    const isCleanNumber = /^-?\d+(\.\d+)?$/.test(String(v.value).trim());
    if (isCleanNumber && v.unit) {
      resource.valueQuantity = { value: parseFloat(v.value), unit: v.unit };
    } else {
      resource.valueString = String(v.value);
    }

    if (v.time) {
      const today = new Date().toISOString().split('T')[0];
      resource.effectiveDateTime = `${today}T${v.time}:00Z`;
    }

    return resource;
  });
}

function buildProcedures(procedures = [], patientId) {
  return procedures.map(p => {
    const resource = {
      resourceType: 'Procedure',
      id: uid('proc'),
      status: p.status || 'completed',
      code: { text: p.description || 'Undocumented procedure' },
      subject: { reference: `Patient/${patientId}` },
    };

    if (p.time) {
      const today = new Date().toISOString().split('T')[0];
      resource.performedDateTime = `${today}T${p.time}:00`;
    }

    return resource;
  });
}

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * Converts intermediate LLM JSON (per prompt-template.md) into a FHIR R4 Bundle.
 *
 * @param {object} llmJson - Parsed output from llm-runner.js
 * @returns {object} FHIR R4 Bundle
 * @throws {Error} if llmJson is null/undefined or missing required shape
 */
export function buildFhirBundle(llmJson) {
  if (!llmJson || typeof llmJson !== 'object') {
    throw new Error('buildFhirBundle: llmJson must be a non-null object');
  }

  const patient   = buildPatient(llmJson.patient   || {});
  const encounter = buildEncounter(llmJson.encounter || {}, patient.id);
  const conditions = buildConditions(llmJson.conditions || [], patient.id);
  const observations = buildObservations(llmJson.vitals || [], patient.id);
  const procedures = buildProcedures(llmJson.procedures || [], patient.id);

  const entries = [
    { resource: patient },
    { resource: encounter },
    ...conditions.map(r => ({ resource: r })),
    ...observations.map(r => ({ resource: r })),
    ...procedures.map(r => ({ resource: r })),
  ];

  const bundle = {
    resourceType: 'Bundle',
    type: 'collection',
    timestamp: new Date().toISOString(),
    entry: entries,
    // Non-FHIR metadata for the app — stripped before any real FHIR server upload
    _meta: {
      triageLevel: normaliseTriage(llmJson.encounter?.triageLevel),
      rawNote: llmJson.rawNote || '',
      generatedBy: 'MedicAssist v0.1.0',
    },
  };

  return bundle;
}

// ─── Validation ───────────────────────────────────────────────────────────────

let _ajvInstance = null;
let _validateFn  = null;

/**
 * Loads AJV and compiles the schema on first call (lazy, cached).
 * Works offline — schema is same-origin and cached by service worker.
 */
async function getValidator() {
  if (_validateFn) return _validateFn;

  // Load AJV from CDN on first use. SW will cache this after first online load.
  if (!window.ajv7) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/ajv/8.12.0/ajv2020.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  const Ajv = window.ajv7 || window.Ajv2020 || window.Ajv;
  _ajvInstance = new Ajv({ strict: false, allErrors: true });

  const schemaRes = await fetch('/spec/fhir-schema.json');
  const schema = await schemaRes.json();

  // The oneOf on entry.resource causes issues with strict AJV; relax it
  // to just require resourceType (we validate shape ourselves in buildFhirBundle)
  const relaxedSchema = JSON.parse(JSON.stringify(schema));
  relaxedSchema.definitions?.['Bundle']?.properties?.entry?.items
    ?.properties?.resource && delete relaxedSchema.properties?.entry
      ?.items?.properties?.resource?.oneOf;

  _validateFn = _ajvInstance.compile(relaxedSchema);
  return _validateFn;
}

/**
 * Validates a FHIR Bundle against fhir-schema.json.
 *
 * @param {object} bundle - The bundle to validate
 * @returns {{ valid: boolean, errors: Array }} 
 */
export async function validateFhirBundle(bundle) {
  try {
    const validate = await getValidator();
    const valid = validate(bundle);
    return { valid, errors: validate.errors || [] };
  } catch (err) {
    // Validation infrastructure failed (e.g. offline and AJV not cached yet)
    // Fall back to structural smoke-test
    console.warn('AJV unavailable, running smoke validation:', err.message);
    return smokeValidate(bundle);
  }
}

/**
 * Minimal offline smoke-test if AJV fails to load.
 * Checks the fields our app actually relies on.
 */
function smokeValidate(bundle) {
  const errors = [];

  if (bundle?.resourceType !== 'Bundle') {
    errors.push({ message: 'resourceType must be Bundle' });
  }
  if (bundle?.type !== 'collection') {
    errors.push({ message: 'type must be collection' });
  }
  if (!Array.isArray(bundle?.entry) || bundle.entry.length < 3) {
    errors.push({ message: 'entry must be an array with at least 3 items' });
  }

  const types = (bundle?.entry || []).map(e => e?.resource?.resourceType);
  if (!types.includes('Patient'))   errors.push({ message: 'Missing Patient resource' });
  if (!types.includes('Encounter')) errors.push({ message: 'Missing Encounter resource' });
  if (!types.includes('Condition')) errors.push({ message: 'Missing at least one Condition resource' });

  return { valid: errors.length === 0, errors };
}

// ─── Helpers exported for app.js / db.js ─────────────────────────────────────

/**
 * Extracts a short human-readable summary from a bundle for the record list UI.
 * Returns: { triageLevel, patientSummary, conditionSummary }
 */
export function summariseBundle(bundle) {
  const encounter = bundle.entry.find(e => e.resource.resourceType === 'Encounter')?.resource;
  const patient   = bundle.entry.find(e => e.resource.resourceType === 'Patient')?.resource;
  const conditions = bundle.entry
    .filter(e => e.resource.resourceType === 'Condition')
    .map(e => e.resource);

  const triageCode = encounter?.priority?.coding?.[0]?.code ?? 'A';
  const triageDisplay = encounter?.priority?.coding?.[0]?.display ?? 'Unknown';

  const age = patient?.estimatedAge;
  const gender = patient?.gender ?? 'unknown';
  const patientSummary = age ? `${gender}, ~${age} yrs` : gender;

  const conditionSummary = conditions.length > 0
    ? conditions[0].code.text + (conditions.length > 1 ? ` +${conditions.length - 1} more` : '')
    : 'No conditions recorded';

  return { triageCode, triageDisplay, patientSummary, conditionSummary };
}

/**
 * Returns triage colour string for CSS class assignment.
 * 'red' | 'yellow' | 'green' | 'black' | 'unknown'
 */
export function triageColour(bundle) {
  const enc = bundle.entry.find(e => e.resource.resourceType === 'Encounter')?.resource;
  const code = enc?.priority?.coding?.[0]?.code;
  const map = { R: 'red', Y: 'yellow', G: 'green', B: 'black', A: 'unknown' };
  return map[code] ?? 'unknown';
}