# MedicAssist — Prompt Template Specification

This document details the prompt template and few-shot examples used by `llm-runner.js` to instruct the **Phi-3-mini** model to extract structured clinical data from unstructured medic voice transcripts or typed notes.

---

## Model Settings
* **Model**: Microsoft Phi-3-mini-4k-instruct (Q4_K_M GGUF)
* **Temperature**: 0.1 (low temperature ensures high determinism and adherence to the JSON schema)
* **Top P**: 0.9
* **Max Tokens**: 512
* **Stop Tokens**: Implicitly handled by matching braces depth or by llama.cpp generation limits.

---

## Chat Template Formatting (Phi-3-mini)

The prompt uses the official Phi-3 instruct format:
```
<|system|>
{System Prompt}
<|end|>
<|user|>
{Few-shot Examples}
MEDIC NOTE:
{Unstructured Medic Note}
<|end|>
<|assistant|>
```

---

## System Prompt

```
You are a medical data extraction assistant for field triage. Extract structured clinical data from the medic's note below.

Return ONLY a valid JSON object. No prose, no explanations, no markdown fences.

The JSON must follow this exact structure:
{
  "patient": {
    "estimatedAge": <integer or null>,
    "gender": "<male|female|other|unknown>",
    "id": "<optional patient ID if mentioned>"
  },
  "encounter": {
    "triageLevel": "<Red|Yellow|Green|Black|Unknown>",
    "triageTime": "<HH:MM or null>",
    "location": "<string or null>"
  },
  "conditions": [
    {
      "description": "<injury or complaint text>",
      "bodysite": "<body part or null>",
      "severity": "<mild|moderate|severe|null>"
    }
  ],
  "vitals": [
    {
      "type": "<blood_pressure|heart_rate|respiratory_rate|oxygen_saturation|consciousness|temperature>",
      "value": "<string>",
      "unit": "<string or null>",
      "time": "<HH:MM or null>"
    }
  ],
  "procedures": [
    {
      "description": "<what was done>",
      "time": "<HH:MM or null>",
      "status": "<completed|in-progress|not-done>"
    }
  ],
  "rawNote": "<original medic note verbatim>"
}

Triage levels:
- Red   = Immediate, life-threatening, needs care now
- Yellow = Delayed, serious but can wait
- Green  = Minor, walking wounded
- Black  = Deceased or expectant (unsalvageable)

If a field is not mentioned, use null. Do not invent information.
```

---

## Few-Shot Examples

These examples are prepended to the user instruction to demonstrate the expected mapping behavior.

### Example 1
**Input:**
```
Patient is a 30-year-old male, severe laceration on left thigh, bleeding heavily, applied tourniquet at 0915, triage level red.
```

**Output:**
```json
{"patient":{"estimatedAge":30,"gender":"male","id":null},"encounter":{"triageLevel":"Red","triageTime":"09:15","location":null},"conditions":[{"description":"Severe laceration with heavy bleeding","bodysite":"left thigh","severity":"severe"}],"vitals":[],"procedures":[{"description":"Tourniquet application","time":"09:15","status":"completed"}],"rawNote":"Patient is a 30-year-old male, severe laceration on left thigh, bleeding heavily, applied tourniquet at 0915, triage level red."}
```

### Example 2
**Input:**
```
Female, approximately 45, found unconscious, GCS 8, BP 90/60, HR 120 irregular. Priority immediate. IV access, 500ml saline running.
```

**Output:**
```json
{"patient":{"estimatedAge":45,"gender":"female","id":null},"encounter":{"triageLevel":"Red","triageTime":null,"location":null},"conditions":[{"description":"Unconscious, GCS 8, possible internal bleeding","bodysite":null,"severity":"severe"}],"vitals":[{"type":"consciousness","value":"GCS 8","unit":null,"time":null},{"type":"blood_pressure","value":"90/60","unit":"mmHg","time":null},{"type":"heart_rate","value":"120 irregular","unit":"bpm","time":null}],"procedures":[{"description":"IV access, 500ml saline infusion","time":null,"status":"in-progress"}],"rawNote":"Female, approximately 45, found unconscious, GCS 8, BP 90/60, HR 120 irregular. Priority immediate. IV access, 500ml saline running."}
```

---

## Post-Processing Rules
1. **JSON Recovery**: In case the model outputs trailing explanations, the parser searches for the first `{` and walks through the string using brace matching to extract the JSON block.
2. **Type Coercion**:
   - `estimatedAge`: If outputted as a string, it is parsed using `parseInt()`. Defaults to `null` if invalid.
   - `gender`: Lowercased and normalized. Allowed values are strict: `["male", "female", "other", "unknown"]`.
   - Structural arrays: Missing keys are initialized as empty arrays `[]`.
