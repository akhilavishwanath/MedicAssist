# MedicAssist — Work Division Plan

> Assumes a **3-person team**. Adjust column assignments if team size differs.

---

## Team Roles

| Person | Role | Primary Skills |
|--------|------|----------------|
| **Dev A** — Lead / ML | Model integration, architecture, spec | Python, JS, WASM, FHIR |
| **Dev B** — Frontend | PWA, UI, audio, offline storage | HTML/CSS/JS, IndexedDB, Service Workers |
| **Dev C** — DevOps / Backend | CI/CD, FHIR builder, schema validation | GitLab CI, JSON Schema, shell scripting |

---

## Phase 1 — Plan & Spec (→ 10:00 AM)

| Issue | Task | Owner | Est |
|-------|------|-------|-----|
| #1 | Repo init, folder structure, GitLab runner | Dev C | 30 min |
| #2 | Functional spec, FHIR schema, prompt template | Dev A | 45 min |
| #3 | Architecture doc, model selection doc | Dev A | 20 min |
| #4 | CONTRIBUTING.md, CHANGELOG bootstrap | Dev C | 15 min |
| — | Wireframes.md | Dev B | 20 min |

**All 3 devs work in parallel. Dev A leads spec; Dev C leads repo setup; Dev B drafts wireframes.**

---

## Phase 2 — MVP (→ Lunch)

```
Timeline (≈ 3 hours)

DEV A (ML):       [#7 Whisper WASM]────────[#8 Phi-3 WASM]────[#12 Integration]
DEV B (Frontend): [#5 PWA Shell]──[#6 Audio UI]──[#11 Dashboard]──[#12 Integration]
DEV C (Backend):  [#9 FHIR Builder]──[#10 IndexedDB]──────────────[#12 Integration]
```

| Issue | Task | Owner | Est |
|-------|------|-------|-----|
| #5 | PWA shell, manifest, service worker | Dev B | 45 min |
| #6 | Audio recording UI, waveform | Dev B | 30 min |
| #7 | Whisper.cpp WASM integration | Dev A | 60 min |
| #8 | Phi-3-mini llama.cpp WASM | Dev A | 60 min |
| #9 | FHIR builder + AJV validation | Dev C | 45 min |
| #10 | IndexedDB record store | Dev C | 30 min |
| #11 | Dashboard, record list, export | Dev B | 30 min |
| #12 | End-to-end wiring + demo records | All | 30 min |

**Integration point:** Dev A exposes `window.whisperTranscribe(audioBuffer)` and `window.llmExtract(text)` as async functions. Dev B calls them from `app.js`. Dev C's `fhir-builder.js` and `db.js` are consumed by Dev B's UI.

---

## Phase 3 — Repo Audit (→ 3 PM)

| Issue | Task | Owner | Est |
|-------|------|-------|-----|
| #13 | Pre-commit hooks (5 checks) | Dev C | 30 min |
| #14 | GitLab CI pipeline (10+ checks, local runner) | Dev C | 45 min |
| #15 | README polish, badges, CHANGELOG | Dev A | 20 min |
| — | Fix any CI failures | All | 30 min |

---

## Interface Contracts

### whisper-runner.js (Dev A → Dev B)
```js
// Returns promise<string> — the transcript text
window.whisperTranscribe = async (audioBuffer, onProgress) => { ... }
// onProgress(percent: number, stage: string)
```

### llm-runner.js (Dev A → Dev C)
```js
// Returns promise<object> — parsed intermediate JSON (not yet FHIR)
window.llmExtract = async (transcriptText, onProgress) => { ... }
// Output shape defined in spec/prompt-template.md
```

### fhir-builder.js (Dev C → Dev B)
```js
// Returns FHIR R4 Bundle object or throws ValidationError
import { buildFhirBundle, validateFhirBundle } from './fhir-builder.js';
```

### db.js (Dev C → Dev B)
```js
import { saveRecord, listRecords, getRecord, deleteRecord } from './db.js';
// Record shape: { id, timestamp, triageLevel, fhirBundle, rawNote }
```

---

## Dependency Graph

```
index.html
    └── app.js
          ├── whisper-runner.js    (Dev A)
          ├── llm-runner.js        (Dev A)
          ├── fhir-builder.js      (Dev C)
          └── db.js                (Dev C)

sw.js           (Dev B)
manifest.json   (Dev B)
```

**Critical path:** `#7 Whisper` and `#8 LLM` are the longest tasks. Dev A starts these at 10:00 AM sharp. Dev B and Dev C can build their modules against mock data while models load.

---

## Mock Data Strategy (unblocks parallel work)

Dev B and Dev C can use this mock until Dev A's WASM modules are ready:

```js
// In app.js — replace with real calls once ready
const MOCK_TRANSCRIPT = "Patient is a 30-year-old male, severe laceration on left thigh...";
const MOCK_LLM_OUTPUT = { patient: { estimatedAge: 30, gender: "male" }, ... };
```

Switch to live functions in issue #12.
