import os
import httpx
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GROQ_API_KEY", "").strip("\"'")
print(f"[*] Testing Groq API Key: {api_key[:8]}...{api_key[-4:] if len(api_key) > 12 else ''}")

headers = {"Authorization": f"Bearer {api_key}"}

try:
    resp = httpx.get("https://api.groq.com/openai/v1/models", headers=headers, timeout=15.0)
    print(f"[*] Response status: {resp.status_code}")
    if resp.status_code == 200:
        models = resp.json().get("data", [])
        print(f"\n[+] Total available models on Groq: {len(models)}\n")
        active_models = []
        for m in sorted(models, key=lambda x: x.get("id", "")):
            model_id = m.get("id")
            active = m.get("active", True)
            ctx = m.get("context_window", "N/A")
            owned_by = m.get("owned_by", "")
            print(f"  • {model_id:<40} (context: {str(ctx):<8} | owned_by: {owned_by})")
            if active:
                active_models.append(model_id)

        # Test inference with the best production models
        candidates = [
            "llama-3.3-70b-versatile",
            "llama-3.1-70b-versatile",
            "llama-3.1-8b-instant",
            "mixtral-8x7b-32768",
            "gemma2-9b-it",
            "openai/gpt-oss-120b",
        ]
        chosen = next((c for c in candidates if c in active_models), active_models[0] if active_models else None)
        print(f"\n[*] Recommended model to configure: {chosen}")

        if chosen:
            print(f"[*] Testing chat completion with '{chosen}'...")
            comp_resp = httpx.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers=headers,
                json={
                    "model": chosen,
                    "messages": [
                        {"role": "system", "content": "You are a concise knowledge assistant."},
                        {"role": "user", "content": "Confirm you are active and respond in under 15 words."},
                    ],
                    "temperature": 0.1,
                    "max_tokens": 50,
                },
                timeout=15.0,
            )
            print(f"[*] Completion Status: {comp_resp.status_code}")
            if comp_resp.status_code == 200:
                answer = comp_resp.json()["choices"][0]["message"]["content"]
                print(f"[+] Model response: \"{answer.strip()}\"")
                print("\n========================================================")
                print(">>> GROQ API KEY & INFERENCE ARE 100% OPERATIONAL! <<<")
                print("========================================================\n")
            else:
                print("[-] Completion failed:", comp_resp.text)
    else:
        print("[-] Failed to list models:", resp.status_code, resp.text)
except Exception as ex:
    print("[-] Exception testing Groq:", ex)
