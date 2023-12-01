import json

def save_json(filepath, payload):
  with open(filepath, 'w', encoding='utf-8') as outfile:
    json.dump(payload, outfile, ensure_ascii=False, sort_keys=True, indent=2)