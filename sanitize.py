# Included in the pre-commit hook
import json

WATCH_FILES = [
    "nodered/data/flows.json",
    "nodered/data/.flows.json.backup"
]
SENSITIVE_KEYS = {"key", "cert", "saskey"}

def remove_sensitive_keys(obj):
    if isinstance(obj, dict):
        return {k: remove_sensitive_keys(v) for k, v in obj.items() if k not in SENSITIVE_KEYS}
    elif isinstance(obj, list):
        return [remove_sensitive_keys(item) for item in obj]
    else:
        return obj

def sanitize_file(filepath):
    try:
        with open(filepath, "r") as f:
            data = json.load(f)
        cleaned = remove_sensitive_keys(data)
        with open(filepath, "w") as f:
            json.dump(cleaned, f, indent=2)
        print(f"Sanitized {filepath}")
    except Exception as e:
        print(f"Error sanitizing {filepath}: {e}")

for f in WATCH_FILES:
    sanitize_file(f)