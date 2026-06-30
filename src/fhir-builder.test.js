import { describe, test } from 'node:test';
import assert from 'node:assert';
import { buildFhirBundle, summariseBundle, triageColour } from './fhir-builder.js';

// Jest-style matchers mapped to node:assert
function expect(actual) {
  return {
    toBe(expected) {
      assert.strictEqual(actual, expected);
    },
    toEqual(expected) {
      assert.deepStrictEqual(actual, expected);
    },
    toMatch(regex) {
      assert.ok(regex.test(actual), `Expected "${actual}" to match ${regex}`);
    }
  };
}

// Test constants
const EXAMPLE_1 = {
  patient: { estimatedAge: 30, gender: 'male', id: 'pat-123' },
  encounter: { triageLevel: 'Red', triageTime: '09:15', location: 'Sector 4' },
  conditions: [
    { description: 'Severe laceration on left thigh', bodysite: 'left thigh', severity: 'severe' }
  ],
  vitals: [
    { type: 'heart_rate', value: '120', unit: 'bpm', time: '09:15' }
  ],
  procedures: [
    { description: 'Tourniquet applied', time: '09:15', status: 'completed' }
  ],
  rawNote: 'Patient is a 30-year-old male, severe laceration on left thigh, bleeding heavily, applied tourniquet at 0915, triage level red.'
};

const MINIMAL_GREEN = {
  patient: { estimatedAge: 25, gender: 'female' },
  encounter: { triageLevel: 'Green' },
  conditions: [
    { description: 'Scratches on arm' }
  ]
};

describe('buildFhirBundle', () => {
  test('correctly maps patient data', () => {
    const bundle = buildFhirBundle(EXAMPLE_1);
    const patient = bundle.entry.find(e => e.resource.resourceType === 'Patient')?.resource;
    
    assert.ok(patient, 'Patient resource should exist');
    expect(patient.gender).toBe('male');
    expect(patient.estimatedAge).toBe(30);
    expect(patient.id).toBe('pat-123');
    
    const currentYear = new Date().getFullYear();
    expect(patient.birthDate).toBe(String(currentYear - 30));
  });

  test('correctly maps encounter data', () => {
    const bundle = buildFhirBundle(EXAMPLE_1);
    const encounter = bundle.entry.find(e => e.resource.resourceType === 'Encounter')?.resource;

    assert.ok(encounter, 'Encounter resource should exist');
    expect(encounter.status).toBe('in-progress');
    expect(encounter.class.code).toBe('EMER');
    expect(encounter.priority.coding[0].code).toBe('R');
    expect(encounter.priority.coding[0].display).toBe('Immediate / Red');
    expect(encounter.location[0].location.display).toBe('Sector 4');
    
    const today = new Date().toISOString().split('T')[0];
    expect(encounter.period.start).toBe(`${today}T09:15:00Z`);
  });

  test('correctly maps conditions data', () => {
    const bundle = buildFhirBundle(EXAMPLE_1);
    const condition = bundle.entry.find(e => e.resource.resourceType === 'Condition')?.resource;

    assert.ok(condition, 'Condition resource should exist');
    expect(condition.clinicalStatus.coding[0].code).toBe('active');
    expect(condition.code.text).toBe('Severe laceration on left thigh');
    expect(condition.bodySite[0].text).toBe('left thigh');
    expect(condition.severity.coding[0].code).toBe('severe');
  });

  test('correctly maps observations data with valueQuantity', () => {
    const bundle = buildFhirBundle(EXAMPLE_1);
    const obs = bundle.entry.find(e => e.resource.resourceType === 'Observation')?.resource;

    assert.ok(obs, 'Observation resource should exist');
    expect(obs.status).toBe('preliminary');
    expect(obs.code.text).toBe('Heart rate');
    expect(obs.valueQuantity.value).toBe(120);
    expect(obs.valueQuantity.unit).toBe('bpm');
  });

  test('correctly maps observations data with valueString for irregular values', () => {
    const input = {
      ...EXAMPLE_1,
      vitals: [{ type: 'heart_rate', value: '120 irregular', unit: 'bpm' }]
    };
    const bundle = buildFhirBundle(input);
    const obs = bundle.entry.find(e => e.resource.resourceType === 'Observation')?.resource;

    assert.ok(obs, 'Observation resource should exist');
    expect(obs.valueString).toBe('120 irregular');
    assert.strictEqual(obs.valueQuantity, undefined);
  });

  test('correctly maps procedures data', () => {
    const bundle = buildFhirBundle(EXAMPLE_1);
    const proc = bundle.entry.find(e => e.resource.resourceType === 'Procedure')?.resource;

    assert.ok(proc, 'Procedure resource should exist');
    expect(proc.status).toBe('completed');
    expect(proc.code.text).toBe('Tourniquet applied');
  });
});

describe('summariseBundle', () => {
  test('handles no conditions', () => {
    const input = {
      patient: { estimatedAge: 30, gender: 'male' },
      encounter: { triageLevel: 'Red' },
      conditions: []
    };
    const bundle = buildFhirBundle(input);
    const summary = summariseBundle(bundle);
    expect(summary.conditionSummary).toBe('No conditions recorded');
  });

  test('handles single condition', () => {
    const bundle = buildFhirBundle(EXAMPLE_1);
    const summary = summariseBundle(bundle);
    expect(summary.conditionSummary).toBe('Severe laceration on left thigh');
  });

  test('handles multiple conditions with "+N more" suffix', () => {
    const input = {
      ...EXAMPLE_1,
      conditions: [
        { description: 'Severe laceration on left thigh' },
        { description: 'Fractured rib' },
        { description: 'Concussion' }
      ]
    };
    const bundle = buildFhirBundle(input);
    const summary = summariseBundle(bundle);
    expect(summary.conditionSummary).toMatch(/\+2 more/);
  });
});

describe('triageColour', () => {
  test('maps Red triage to "red"', () => {
    const bundle = buildFhirBundle(EXAMPLE_1);
    expect(triageColour(bundle)).toBe('red');
  });

  test('maps Green triage to "green"', () => {
    const bundle = buildFhirBundle(MINIMAL_GREEN);
    expect(triageColour(bundle)).toBe('green');
  });

  test('maps Yellow triage to "yellow"', () => {
    const input = { ...EXAMPLE_1, encounter: { triageLevel: 'Yellow' } };
    const bundle = buildFhirBundle(input);
    expect(triageColour(bundle)).toBe('yellow');
  });

  test('maps Black triage to "black"', () => {
    const input = { ...EXAMPLE_1, encounter: { triageLevel: 'Black' } };
    const bundle = buildFhirBundle(input);
    expect(triageColour(bundle)).toBe('black');
  });

  test('maps Unknown triage to "unknown"', () => {
    const input = { ...EXAMPLE_1, encounter: { triageLevel: 'foo' } };
    const bundle = buildFhirBundle(input);
    expect(triageColour(bundle)).toBe('unknown');
  });
});
