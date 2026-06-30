import sys
import json
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

MODEL_NAME = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"

print("Loading TinyLlama...", file=sys.stderr)

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

model = AutoModelForCausalLM.from_pretrained(
    MODEL_NAME,
    device_map="auto",
    torch_dtype=torch.float32
)

print("TinyLlama Ready!", file=sys.stderr)

if len(sys.argv) < 2:
    print(json.dumps({"error": "No transcript provided"}))
    sys.exit(1)

transcript = sys.argv[1]

prompt = f"""
You are an AI medical assistant.

Extract information from the following medical transcript.

Return ONLY valid JSON.

Schema:

{{
    "patient": {{
        "estimatedAge": null,
        "gender": "unknown"
    }},
    "encounter": {{
        "triageLevel": "yellow"
    }},
    "conditions": [],
    "vitals": [],
    "procedures": [],
    "rawNote": ""
}}

Medical Transcript:
{transcript}

JSON:
"""

inputs = tokenizer(prompt, return_tensors="pt").to(model.device)

outputs = model.generate(
    **inputs,
    max_new_tokens=256,
    temperature=0.1,
    do_sample=False,
    pad_token_id=tokenizer.eos_token_id
)

response = tokenizer.decode(
    outputs[0],
    skip_special_tokens=True
)

response = response.replace(prompt, "").strip()

print(response)