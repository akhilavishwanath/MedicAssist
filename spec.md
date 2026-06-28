# MedicAssist — Functional Specification

**Version:** 1.0  
**Date:** 2026-06-28  
**Status:** Draft  

---

## 1. Overview

MedicAssist converts unstructured medic voice memos or typed notes into validated FHIR R4 JSON bundles. It runs fully offline on CPU hardware via a Progressive Web App (PWA).

---

## 2. User Stories

| ID | Role | Action | Outcome |
|----|------|--------|---------|
| US-01 | Field medic | Record a voice memo | App transcribes it offline within 30 s |
| US-02 | Field medic | Type a patient note | App parses it into FHIR JSON within 15 s |
| US-03 | Field medic | Review generated FHIR JSON | Can edit individual fields before saving |
| US-04 | Field medic | Save a patient record | Stored locally in IndexedDB; survives page reload |
| US-05 | Field medic | View all saved records | List view with timestamp, triage level, patient summary |
| US-06 | Field coordinator | Export a record as JSON file | Downloads valid FHIR R4 bundle .json |
| US-07 | Field coordinator | Sync records when online | Records upload to configured FHIR endpoint |
| US-08 | Any user | Install app on device | Installable as PWA; works with network disabled |

---

## 3. Functional Requirements

### 3.1 Audio Transcription (FR-AUDIO)

| Req ID | Description | Priority |
|--------|-------------|----------|
| FR-AUDIO-01 | App MUST record audio from device microphone via MediaRecorder API | Must |
| FR-AUDIO-02 | App MUST transcribe audio using whisper.cpp WASM (ggml-small.en, ~150 MB) | Must |
| FR-AUDIO-03 | Transcription MUST complete with no outbound network requests | Must |
| FR-AUDIO-04 | Transcription of a 30 s clip MUST complete in ≤ 90 s on a 4-core CPU | Must |
| FR-AUDIO-05 | App MUST display raw transcript text for medic review before parsing | Must |
| FR-AUDIO-06 | App SHOULD support WAV and WebM audio formats | Should |

### 3.2 NLP / FHIR Extraction (FR-NLP)

| Req ID | Description | Priority |
|--------|-------------|----------|
| FR-NLP-01 | App MUST extract structured data using Phi-3-mini Q4_K_M via llama.cpp WASM | Must |
| FR-NLP-02 | All inference MUST run on CPU; GPU MUST NOT be required | Must |
| FR-NLP-03 | Prompt template MUST enforce JSON-only output (no prose) | Must |
| FR-NLP-04 | App MUST validate LLM output against FHIR R4 schema before display | Must |
| FR-NLP-05 | If validation fails, app MUST show raw output and allow manual correction | Must |
| FR-NLP-06 | Extraction MUST complete in ≤ 60 s on a 4-core CPU | Must |
| FR-NLP-07 | App SHOULD extract: age, sex, chief complaint, injuries, vitals, treatments, triage level, timestamps | Should |

### 3.3 FHIR Output (FR-FHIR)

| Req ID | Description | Priority |
|--------|-------------|----------|
| FR-FHIR-01 | Output MUST be a valid FHIR R4 Bundle (resourceType = "Bundle") | Must |
| FR-FHIR-02 | Bundle MUST contain: Patient, Encounter, Condition (≥ 1), Observation (if vitals present), Procedure (if treatment present) | Must |
| FR-FHIR-03 | Triage level MUST map to START Triage colour codes: Red / Yellow / Green / Black | Must |
| FR-FHIR-04 | Timestamps MUST use ISO 8601 format | Must |
| FR-FHIR-05 | App MUST allow export as a downloadable `.json` file | Must |
| FR-FHIR-06 | App SHOULD allow copying JSON to clipboard | Should |

### 3.4 Offline / PWA (FR-OFFLINE)

| Req ID | Description | Priority |
|--------|-------------|----------|
| FR-OFFLINE-01 | App MUST be installable as a PWA (manifest.json + service worker) | Must |
| FR-OFFLINE-02 | All app assets (HTML, JS, CSS, WASM, models) MUST be cached by service worker | Must |
| FR-OFFLINE-03 | App MUST function fully with network adapter disabled | Must |
| FR-OFFLINE-04 | Records MUST persist in IndexedDB across sessions | Must |
| FR-OFFLINE-05 | App MUST queue records for sync when connectivity is detected | Should |

### 3.5 Record Management (FR-RECORDS)

| Req ID | Description | Priority |
|--------|-------------|----------|
| FR-RECORDS-01 | App MUST list all saved records with: timestamp, triage level badge, patient summary | Must |
| FR-RECORDS-02 | App MUST allow viewing full FHIR JSON of any saved record | Must |
| FR-RECORDS-03 | App MUST allow deleting a record | Must |
| FR-RECORDS-04 | App SHOULD support search/filter by triage level | Should |

---

## 4. Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-01 | Performance | End-to-end (record → FHIR JSON) in ≤ 2 min on minimum hardware |
| NFR-02 | Compatibility | Chrome 120+, Firefox 121+, Safari 17+ (desktop) |
| NFR-03 | Security | No data leaves the device unless user explicitly triggers sync |
| NFR-04 | Accessibility | WCAG 2.1 AA; operable with gloves (large touch targets ≥ 44 px) |
| NFR-05 | Model size | Total model downloads ≤ 2.5 GB |
| NFR-06 | License | All runtime dependencies MUST be FOSS; combined license MUST be GPL-3.0 compatible |

---

## 5. Out of Scope (v1)

- Multi-user / multi-device sync
- Video input
- Non-English transcription (model supports it; UI does not expose it yet)
- Native iOS / Android app (PWA install covers the use case)
- HIPAA / GDPR certification (intended for field triage, not long-term EHR storage)

---

## 6. Acceptance Criteria

The MVP is accepted when:

1. A medic can record a 20 s voice memo → receive valid FHIR R4 JSON with **no internet connection**.
2. All required FHIR resources (Patient, Encounter, Condition) are populated for a standard triage scenario.
3. The app installs as a PWA and loads successfully with Wi-Fi disabled.
4. All CI checks (≥ 10) pass on the local GitLab runner.
5. Three real demo records are committed to `/demo/` with input audio + expected JSON.
