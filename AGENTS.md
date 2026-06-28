# AGENTS.md

## Project

MedicAssist – Tactical Field Medic Assistant

## Purpose

Convert unstructured medical voice or text notes into structured FHIR R4 JSON completely offline using CPU-only AI models.

---

# AI Components

## Speech Recognition Agent

**Model**

* Whisper.cpp

**Input**

* Audio recording

**Output**

* Transcript text

---

## Information Extraction Agent

**Model**

* Microsoft Phi-3 Mini (GGUF)

**Runtime**

* llama.cpp

**Input**

* Transcript text

**Output**

* Structured clinical information

---

## FHIR Builder Agent

**Purpose**

Convert extracted clinical entities into a valid FHIR R4 Bundle.

Resources generated include:

* Patient
* Encounter
* Condition
* Observation
* Procedure

---

## Storage Agent

Responsible for:

* Saving records in IndexedDB
* Loading records
* Deleting records
* Exporting JSON

---

## Synchronization Agent (Future)

Responsibilities:

* Detect connectivity
* Upload FHIR Bundles to a configured FHIR server
* Retry failed synchronizations

---

# Application Flow

```
Audio / Text

↓

Whisper.cpp

↓

Transcript

↓

Phi-3 Mini

↓

Structured Medical Data

↓

FHIR Builder

↓

FHIR Bundle

↓

IndexedDB

↓

Export / Sync
```

---

# Design Principles

* Offline-first
* CPU-first
* Privacy-first
* Open Source
* FHIR compliant
* Progressive Web App

---

# Future Enhancements

* Multi-language transcription
* Image-to-FHIR extraction
* OCR support
* Hospital synchronization
* Multi-patient session management
