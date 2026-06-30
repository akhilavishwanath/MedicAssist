import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
import os

MODEL_ID = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"

SYSTEM_PROMPT = """You are a medical data extraction assistant for field triage. Extract structured clinical data from the medic's note below.

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

If a field is not mentioned, use null. Do not invent information."""

_tokenizer = None
_model = None

def get_model_and_tokenizer():
    global _tokenizer, _model
    if _model is None:
        _tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, local_files_only=True)
        _model = AutoModelForCausalLM.from_pretrained(
            MODEL_ID,
            local_files_only=True,
            torch_dtype=torch.float32,
            device_map="cpu"
        )
    return _model, _tokenizer

def extract_clinical_info(transcript):
    model, tokenizer = get_model_and_tokenizer()
    
    # Structure turn-by-turn chat history
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": "Patient is a 30-year-old male, severe laceration on left thigh, bleeding heavily, applied tourniquet at 0915, triage level red."},
        {"role": "assistant", "content": '{"patient":{"estimatedAge":30,"gender":"male","id":null},"encounter":{"triageLevel":"Red","triageTime":"09:15","location":null},"conditions":[{"description":"Severe laceration with heavy bleeding","bodysite":"left thigh","severity":"severe"}],"vitals":[],"procedures":[{"description":"Tourniquet application","time":"09:15","status":"completed"}],"rawNote":"Patient is a 30-year-old male, severe laceration on left thigh, bleeding heavily, applied tourniquet at 0915, triage level red."}'},
        {"role": "user", "content": "Female, approximately 45, found unconscious, GCS 8, BP 90/60, HR 120 irregular. Priority immediate. IV access, 500ml saline running."},
        {"role": "assistant", "content": '{"patient":{"estimatedAge":45,"gender":"female","id":null},"encounter":{"triageLevel":"Red","triageTime":null,"location":null},"conditions":[{"description":"Unconscious, GCS 8, possible internal bleeding","bodysite":null,"severity":"severe"}],"vitals":[{"type":"consciousness","value":"GCS 8","unit":null,"time":null},{"type":"blood_pressure","value":"90/60","unit":"mmHg","time":null},{"type":"heart_rate","value":"120 irregular","unit":"bpm","time":null}],"procedures":[{"description":"IV access, 500ml saline infusion","time":null,"status":"in-progress"}],"rawNote":"Female, approximately 45, found unconscious, GCS 8, BP 90/60, HR 120 irregular. Priority immediate. IV access, 500ml saline running."}'},
        {"role": "user", "content": transcript.strip()}
    ]
    
    # Apply official TinyLlama chat template formatting
    prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = tokenizer(prompt, return_tensors="pt")
    
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=512,
            do_sample=False
        )
    
    new_tokens = outputs[0][inputs["input_ids"].shape[1]:]
    response_text = tokenizer.decode(new_tokens, skip_special_tokens=True)
    return response_text
