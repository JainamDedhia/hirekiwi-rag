import os
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, "backend")
if sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

from app.services.graph import run_crag_pipeline

print("[*] Executing Live CRAG Query using Groq openai/gpt-oss-120b...")
query = "How do you solve simultaneous linear equations using Cramer's Rule, and what are D, Dx, and Dy?"
print(f"Query: {query}\n")

response = run_crag_pipeline(
    query=query,
    top_k=4,
    enable_web_search=False,
)

print(f"[+] Total Latency: {response.total_latency_ms:.1f}ms")
print(f"[+] Confidence Score: {response.confidence_score}")
print(f"[+] Web Search Used: {response.web_search_used}")
print(f"[+] Execution Steps: {[s.step_name for s in response.execution_steps]}")
print(f"\n[+] Sources ({len(response.sources)}):")
for s in response.sources:
    print(f"  - [{s.source}] (relevance: {s.relevance}, score: {s.score})")

print(f"\n[+] Generated Grounded Answer:\n")
print(response.answer)
