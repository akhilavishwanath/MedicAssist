# MedicAssist User Manual

## Overview

MedicAssist is an offline Progressive Web App that converts spoken or typed medical notes into structured FHIR R4 JSON.

No internet connection is required after installation.

---

# System Requirements

* Modern Web Browser
* 4 GB RAM minimum
* CPU-only device
* Microphone (for audio recording)

---

# Starting the Application

1. Open MedicAssist.
2. Install it as a Progressive Web App (optional).
3. Ensure models are downloaded.
4. The application is ready for offline use.

---

# Recording a Voice Note

1. Click **Start Recording**.
2. Speak the patient details clearly.
3. Click **Stop Recording**.
4. Wait for transcription.

---

# Using Manual Text Entry

1. Type the medical report.
2. Click **Generate FHIR JSON**.
3. Review the generated output.

---

# Saving Records

Click **Save Record** to store the generated FHIR Bundle locally using IndexedDB.

---

# Exporting Data

Click **Download JSON** to export the generated FHIR Bundle for later sharing or synchronization.

---

# Offline Usage

MedicAssist works without internet after the initial setup.

Supported offline features:

* Audio recording
* Text input
* AI inference
* FHIR generation
* Local storage
* JSON export

---

# Troubleshooting

## Audio not recording

* Verify microphone permissions.
* Refresh the application.

## Models not loading

* Ensure Whisper.cpp and Phi-3 models exist in the models directory.

## No JSON generated

* Check the transcript.
* Ensure the AI models are initialized correctly.

---

# Data Privacy

All processing occurs locally.

No patient information is sent to external servers unless the user explicitly chooses to synchronize records.
