import os
import sys
import json
from dotenv import load_dotenv
from huggingface_hub import InferenceClient

load_dotenv()

client = InferenceClient(
    provider="hf-inference",
    api_key=os.getenv("HF_TOKEN"),
)

if len(sys.argv) < 2:
    print(json.dumps({"error": "No transcript"}))
    sys.exit(1)

transcript = sys.argv[1]

prompt = f"""
Extract the medical information from this transcript.

Return ONLY valid JSON.

Transcript:
{transcript}
"""

response = client.chat.completions.create(
    model="TinyLlama/TinyLlama-1.1B-Chat-v1.0",
    messages=[
        {
            "role": "user",
            "content": prompt
        }
    ],
    max_tokens=300,
)

print(response.choices[0].message.content)