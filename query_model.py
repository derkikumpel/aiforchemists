import requests
import json
import os

API_URL = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2"
headers = {"Authorization": f"Bearer {os.getenv('HF_TOKEN')}"}

def query(prompt):
    payload = {
        "inputs": prompt,
        "parameters": {"max_new_tokens": 300}
    }
    response = requests.post(API_URL, headers=headers, json=payload)
    return response.json()

# Prompt generieren
prompt = "Gib mir eine JSON-Liste mit 3 fiktiven Nutzern mit Namen, Alter und Beruf."

result = query(prompt)
text = result[0]["generated_text"]

# extrahiere JSON (vorsichtig!)
start = text.find('{')
end = text.rfind('}') + 1
json_data = text[start:end]

with open("data.json", "w") as f:
    f.write(json_data)
