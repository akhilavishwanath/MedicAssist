# 🚑 MedicAssist — Tactical Field Medic Assistant

> **Audio/Text → Structured FHIR JSON. Offline. CPU-only. No cloud. No compromise.**

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](LICENSE)
[![CPU-First](https://img.shields.io/badge/inference-CPU--only-green)]()
[![Offline-First](https://img.shields.io/badge/offline-first-orange)]()
[![FHIR R4](https://img.shields.io/badge/FHIR-R4-red)]()

---

## The Problem

First responders, disaster relief workers, and combat medics must document patient vitals, injuries, and treatments **rapidly** — often in dead zones with **zero connectivity**. Paper forms get lost. Cloud apps fail. Every second of delay costs lives.

## The Solution

MedicAssist is a **PWA (Progressive Web App)** that runs entirely on a laptop or rugged tablet — no internet required after installation.

1. **Record** — Medic speaks a 10–30 second voice memo into the device microphone.
2. **Transcribe** — [Whisper.cpp](https://github.com/ggerganov/whisper.cpp) (`ggml-small.en` model, ~150 MB) transcribes audio **fully offline** using CPU WASM.
3. **Parse** — [Phi-3-mini-4k-instruct](https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf) quantised to Q4_K_M (~2.2 GB), served by **llama.cpp** (WASM or local binary), extracts structured clinical data.
4. **Export** — Output is a valid **FHIR R4 Encounter + Patient + Condition + Observation** JSON bundle, ready for sync when connectivity returns.

### Example Input
```
"Patient is a 30-year-old male, severe laceration on left thigh,
bleeding heavily, applied tourniquet at 0915, triage level red."
```

### Example Output (FHIR R4 Bundle)
```json
{
  "resourceType": "Bundle",
  "type": "collection",
  "entry": [
    {
      "resource": {
        "resourceType": "Patient",
        "gender": "male",
        "birthDate": "~1995"
      }
    },
    {
      "resource": {
        "resourceType": "Encounter",
        "status": "in-progress",
        "priority": { "coding": [{ "code": "A", "display": "Immediate / Red" }] }
      }
    },
    {
      "resource": {
        "resourceType": "Condition",
        "code": { "text": "Severe laceration, left thigh" },
        "severity": { "text": "Severe" }
      }
    },
    {
      "resource": {
        "resourceType": "Procedure",
        "code": { "text": "Tourniquet application" },
        "performedDateTime": "T09:15:00"
      }
    }
  ]
}
```

---

## Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| **Frontend** | Vanilla JS + HTML5 PWA | Zero framework overhead; works as installed app |
| **Speech-to-Text** | [whisper.cpp](https://github.com/ggerganov/whisper.cpp) via WASM | CPU-only, ~150 MB model, runs in browser |
| **LLM / NLP** | [llama.cpp](https://github.com/ggerganov/llama.cpp) WASM + Phi-3-mini-Q4_K_M | CPU-only, ~2.2 GB model |
| **Model format** | GGUF (Q4_K_M quantisation) | Best CPU perf/accuracy tradeoff |
| **Output schema** | FHIR R4 | Industry-standard EHR interoperability |
| **Storage** | IndexedDB + Service Worker cache | Full offline persistence |
| **CI/CD** | GitLab CI with local runner | All checks run locally, no SaaS dependency |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Browser / PWA                  │
│                                                 │
│  ┌──────────┐    ┌─────────────┐    ┌────────┐  │
│  │Microphone│───▶│whisper.wasm │───▶│Transcript│ │
│  │  Input   │    │(ggml-small) │    │  Text  │  │
│  └──────────┘    └─────────────┘    └───┬────┘  │
│                                         │        │
│  ┌──────────┐                      ┌────▼────┐   │
│  │ Text Box │─────────────────────▶│ Prompt  │   │
│  │ (manual) │                      │ Builder │   │
│  └──────────┘                      └────┬────┘   │
│                                         │        │
│                                    ┌────▼────┐   │
│                                    │llama.cpp│   │
│                                    │  WASM   │   │
│                                    │Phi-3-mini│  │
│                                    └────┬────┘   │
│                                         │        │
│                                    ┌────▼────┐   │
│                                    │FHIR R4  │   │
│                                    │  JSON   │   │
│                                    │ Builder │   │
│                                    └────┬────┘   │
│                                         │        │
│  ┌──────────────────────────────────────▼──────┐ │
│  │       IndexedDB  (offline record store)     │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
         │  (sync when online)
         ▼
    EHR / FHIR Server
```

---

## Hardware Requirements

| Spec | Minimum | Recommended |
|---|---|---|
| RAM | 4 GB | 8 GB |
| CPU | x86-64 or ARM64 | 4+ cores |
| Disk | 3 GB free | 5 GB free |
| GPU | ❌ Not used | ❌ Not used |
| Internet | ❌ Not required | ❌ Not required |

Tested on: MacBook Pro M2, Dell Latitude i5 (8 GB RAM), Raspberry Pi 5.

---

## Quick Start

```bash
# Clone
git clone https://gitlab.com/your-team/medic-assist.git
cd medic-assist

# Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
npm install
cp .env.example .env
npm start

# Frontend, in a second terminal from the repo root
npm install
npm start
# → open http://localhost:8080/src/index.html

# OR install as PWA: open in Chrome → "Install App"
```

The frontend calls the local backend at `http://localhost:3001` by default.
Override it with `?api=http://host:port` or `window.MEDICASSIST_API_BASE_URL`.

> **Offline demo:** Cache/download the required local AI models first, then open the app, disable Wi-Fi/ethernet, record audio → structured JSON output appears with no cloud network activity.

---

## Repository Structure

```
medic-assist/
├── README.md
├── LICENSE                    # GPL-3.0
├── CONTRIBUTING.md
├── CHANGELOG.md
├── .gitlab-ci.yml
├── .pre-commit-config.yaml
├── spec/
│   ├── functional-spec.md
│   ├── fhir-schema.json
│   ├── prompt-template.md
│   └── wireframes.md
├── docs/
│   ├── architecture.md
│   ├── model-selection.md
│   └── work-division.md
├── src/
│   ├── index.html
│   ├── app.js
│   ├── whisper-runner.js
│   ├── llm-runner.js
│   ├── fhir-builder.js
│   ├── db.js
│   └── sw.js                  # Service Worker
├── models/                    # .gitignore'd; downloaded by script
│   ├── ggml-small.en.bin
│   └── phi-3-mini-q4_k_m.gguf
└── scripts/
    └── download_models.sh
```

---

## License

GNU General Public License v3.0 — see [LICENSE](LICENSE).
