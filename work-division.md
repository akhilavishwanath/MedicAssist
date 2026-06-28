# MedicAssist — Work Division Plan

**Team Size:** 2 Members

## Team Roles

| Person                                   | Role                        | Primary Responsibilities                                                                                                               |
| ---------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Developer A – AI & Backend Lead**      | Model Integration & Backend | Whisper.cpp integration, Phi-3-mini integration, FHIR JSON builder, prompt engineering, schema validation, architecture, documentation |
| **Developer B – Frontend & DevOps Lead** | PWA & Infrastructure        | UI development, audio recording, IndexedDB, Service Worker, PWA, GitLab CI/CD, testing, documentation                                  |

---

# Phase 1 — Plan & Specification (Before 10:00 AM)

| Issue | Task                                                      | Owner       | Estimate |
| ----- | --------------------------------------------------------- | ----------- | -------- |
| #1    | Repository setup, folder structure, GitLab initialization | Developer B | 20 min   |
| #2    | Functional specification & architecture                   | Developer A | 30 min   |
| #3    | FHIR schema & prompt template                             | Developer A | 30 min   |
| #4    | README, CONTRIBUTING, CHANGELOG, LICENSE                  | Developer B | 20 min   |
| #5    | Work division & issue planning                            | Both        | 15 min   |

---

# Phase 2 — MVP (Before Lunch)

## Developer A (AI & Backend)

* Integrate Whisper.cpp (CPU-only)
* Integrate Phi-3-mini with llama.cpp
* Design prompt for structured extraction
* Generate FHIR R4 Bundle
* Validate JSON against schema
* Expose AI APIs to frontend

Estimated Time: **3 Hours**

---

## Developer B (Frontend & DevOps)

* Build PWA interface
* Audio recording using MediaRecorder
* Text input interface
* Record history using IndexedDB
* Export JSON
* Service Worker & offline cache
* Integrate backend APIs
* Local GitLab Runner setup

Estimated Time: **3 Hours**

---

# Integration (Both)

| Task                                 | Owner |
| ------------------------------------ | ----- |
| Connect frontend with Whisper.cpp    | Both  |
| Connect Phi-3 output to FHIR builder | Both  |
| End-to-end testing                   | Both  |
| Prepare demo records                 | Both  |

Estimated Time: **45 minutes**

---

# Phase 3 — Repository Audit (Before 3:00 PM)

| Issue | Task                            | Owner       |
| ----- | ------------------------------- | ----------- |
| #6    | Configure pre-commit hooks      | Developer B |
| #7    | GitLab CI pipeline (10+ checks) | Developer B |
| #8    | Documentation review            | Developer A |
| #9    | Security scan & lint fixes      | Both        |
| #10   | Final repository audit          | Both        |

---

# Module Ownership

## Developer A

* whisper-runner.js
* llm-runner.js
* fhir-builder.js
* Prompt template
* FHIR validation

## Developer B

* index.html
* app.js
* db.js
* sw.js
* manifest.json
* styles.css
* GitLab CI
* Documentation

---

# Integration Interfaces

### whisper-runner.js

```javascript
window.whisperTranscribe = async (audioBuffer) => {
    // Returns transcript text
}
```

### llm-runner.js

```javascript
window.llmExtract = async (transcriptText) => {
    // Returns structured clinical JSON
}
```

### fhir-builder.js

```javascript
buildFhirBundle(data)
validateFhirBundle(bundle)
```

### db.js

```javascript
saveRecord()
listRecords()
getRecord()
deleteRecord()
```

---

# Development Strategy

To enable parallel development, the frontend uses mock transcript and mock JSON responses until Whisper.cpp and Phi-3 integration are complete.

Once the AI modules are ready, the mock functions are replaced with live inference calls without changing the frontend workflow.

---

# Deliverables

### Phase 1

* Project specification
* Repository structure
* Issue tracker
* Work allocation

### Phase 2
* Offline PWA
* Audio transcription
* Phi-3 extraction
* FHIR JSON generation
* Local storage

###Phase 3
* CI/CD (10+ checks)
* Documentation
* Security scanning
* Repository compliance
* Offline PWA
* Audio transcription
* Phi-3 extraction
* FHIR JSON generation
* Local storage

### Phase 3

* CI/CD (10+ checks)
* Documentation
* Security scanning
* Repository compliance
