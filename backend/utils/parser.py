import json
import re

def parse_and_normalize_json(raw_output, transcript=""):
    # Strip markdown code blocks if any
    cleaned = re.sub(r'```json\s*', '', raw_output, flags=re.IGNORECASE)
    cleaned = re.sub(r'```\s*', '', cleaned).strip()
    
    # Extract first {...}
    start = cleaned.find('{')
    end = cleaned.rfind('}')
    
    if start == -1 or end == -1 or end < start:
        return {"rawNote": transcript}
        
    json_str = cleaned[start:end+1]
    
    try:
        data = json.loads(json_str)
    except Exception:
        return {"rawNote": transcript}
        
    # Normalize schema
    normalized = {
        "patient": {
            "estimatedAge": None,
            "gender": "unknown",
            "id": None
        },
        "encounter": {
            "triageLevel": "Unknown",
            "triageTime": None,
            "location": None
        },
        "conditions": [],
        "vitals": [],
        "procedures": [],
        "rawNote": transcript
    }
    
    # Deep merge and coerce
    if "patient" in data and isinstance(data["patient"], dict):
        p = data["patient"]
        age = p.get("estimatedAge")
        if isinstance(age, str):
            try:
                age = int(re.sub(r'\D', '', age))
            except Exception:
                age = None
        elif not isinstance(age, int):
            age = None
        normalized["patient"]["estimatedAge"] = age
        
        gender = str(p.get("gender", "unknown")).lower().strip()
        if gender not in ["male", "female", "other", "unknown"]:
            gender = "unknown"
        normalized["patient"]["gender"] = gender
        
        normalized["patient"]["id"] = p.get("id")
        
    if "encounter" in data and isinstance(data["encounter"], dict):
        e = data["encounter"]
        triage = str(e.get("triageLevel", "Unknown")).strip()
        # Normalise casing
        triage = triage.capitalize()
        if triage not in ["Red", "Yellow", "Green", "Black", "Unknown"]:
            triage = "Unknown"
        normalized["encounter"]["triageLevel"] = triage
        
        # Time normalisation
        time = e.get("triageTime")
        if time:
            # check HH:MM format
            time_match = re.search(r'(\d{1,2})[\s:]?(\d{2})', str(time))
            if time_match:
                normalized["encounter"]["triageTime"] = f"{int(time_match.group(1)):02d}:{time_match.group(2)}"
        
        normalized["encounter"]["location"] = e.get("location")
        
    if "conditions" in data and isinstance(data["conditions"], list):
        for c in data["conditions"]:
            if isinstance(c, dict):
                normalized["conditions"].append({
                    "description": c.get("description", "Unknown condition"),
                    "bodysite": c.get("bodysite"),
                    "severity": c.get("severity")
                })
                
    if "vitals" in data and isinstance(data["vitals"], list):
        for v in data["vitals"]:
            if isinstance(v, dict):
                normalized["vitals"].append({
                    "type": v.get("type"),
                    "value": str(v.get("value", "")),
                    "unit": v.get("unit"),
                    "time": v.get("time")
                })
                
    if "procedures" in data and isinstance(data["procedures"], list):
        for p in data["procedures"]:
            if isinstance(p, dict):
                normalized["procedures"].append({
                    "description": p.get("description"),
                    "time": p.get("time"),
                    "status": p.get("status", "completed")
                })
                
    if "rawNote" in data and data["rawNote"]:
        normalized["rawNote"] = data["rawNote"]
        
    return normalized
