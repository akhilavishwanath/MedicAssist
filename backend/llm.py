import sys
import json
import warnings
import os

# Suppress warnings to avoid corrupting stdout JSON parsing
warnings.filterwarnings("ignore")
os.environ["TOKENIZERS_PARALLELISM"] = "false"

from utils.extract import extract_clinical_info
from utils.parser import parse_and_normalize_json

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No transcript"}))
        sys.exit(1)
        
    transcript = sys.argv[1]
    
    try:
        raw_output = extract_clinical_info(transcript)
        result = parse_and_normalize_json(raw_output, transcript)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e), "rawNote": transcript}))
        sys.exit(1)

if __name__ == "__main__":
    main()