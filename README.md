# HireKiwi Corrective Retrieval-Augmented Generation (CRAG) Service

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com)
[![LangGraph](https://img.shields.io/badge/LangGraph-CRAG_Workflow-FF6F00.svg)](https://langchain-ai.github.io/langgraph/)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-Persistent_Vector_Store-blue.svg)](https://www.trychroma.com/)
[![Groq](https://img.shields.io/badge/Groq-openai%2Fgpt--oss--120b-F55036.svg)](https://groq.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> **Assessment Submission Context**  
> **Role Target**: AI Systems Engineer (2+ years experience | 4–6 hours maximum | 6–6.6 LPA role)  
> **Problem**: Build a small AI-powered knowledge assistant that answers questions from a collection of documents (PDF, TXT, Markdown). It must provide evidence for its answers, acknowledge missing information, and avoid inventing facts.

---

## 1. System Architecture & Decisions

The HireKiwi CRAG system implements a cyclic LangGraph state machine with **Hybrid Dense-Lexical Reranking (BM25 + Dense RRF)**, persistent vector storage with **ChromaDB**, and **Groq LPUs** (`openai/gpt-oss-120b`, 131k context window) for fast grounded generation.

```text
                           +-----------------------+
                           |     User Question     |
                           +-----------+-----------+
                                       |
                                       v
                           +-----------------------+
                           |    [retrieve] Node    |  <-- ChromaDB Persistent Store
                           |   (Candidate Pool)    |      (101 Chunks Ingested)
                           +-----------+-----------+
                                       |
                                       v
                           +-----------------------+
                           |     [rerank] Node     |  <-- Hybrid BM25 + Dense RRF (k=60)
                           |   (Reciprocal Rank)   |
                           +-----------+-----------+
                                       |
                                       v
                           +-----------------------+
                           | [grade_documents] Node|  <-- LLM / Grader Evaluator
                           +-----------+-----------+
                                       |
                   +-------------------+-------------------+
                   |                                       |
         (No / Low Relevance)                     (Relevant Docs Present)
                   |                                       |
                   v                                       |
       +-----------------------+                           |
       | [transform_query] Node|                           |
       +-----------+-----------+                           |
                   |                                       |
                   v                                       |
       +-----------------------+                           |
       |   [web_search] Node   |                           |
       | (DuckDuckGo / Tavily) |                           |
       +-----------+-----------+                           |
                   |                                       |
                   +-------------------+-------------------+
                                       |
                                       v
                           +-----------------------+
                           |    [generate] Node    |  <-- Strict Grounding & Citations
                           +-----------+-----------+
                                       |
                                       v
                           +-----------------------+
                           |     Final Answer      |  <-- (Answer + Citations OR
                           +-----------------------+       "Information Unavailable")
```

### Key Technical Decisions

| Pipeline Layer | Technology | Architectural Rationale |
| :--- | :--- | :--- |
| **Document Ingestion** | PyMuPDF (`fitz`) + `pypdf` | Fast extraction of math equations, chapter layouts, and page numbers. Overlapping chunk window (600 characters, 120 character overlap) preserving paragraph integrity. |
| **Vector Store** | ChromaDB Persistent Client | High-performance local vector index with cosine similarity metric, surviving service restarts without external infrastructure dependencies. |
| **Hybrid Reranking** | BM25Okapi + Dense RRF ($k=60$) | Fuses dense semantic vector similarity with lexical term matches to prioritize exact mathematical and chapter terminology before grading. |
| **State Machine** | LangGraph `StateGraph` | Deterministic, observable state machine managing retrieval, reranking, grading, query rewrites, and generation with full step-by-step latency telemetry. |
| **LLM Gateway** | Groq (`openai/gpt-oss-120b`) | Sub-second inference with a 131,072 token context window, paired with deterministic offline fallback to guarantee 100% availability during rate limits. |
| **Reliability & Refusal** | System Prompt + Negative Routing | When documents lack evidence, the system refuses with *"The requested information is unavailable in the provided documents."* avoiding hallucinations. |
| **Frontend UI** | React + Vite + Tailwind | Modern dark SaaS dashboard featuring execution tracing, source inspect cards, document catalog, and live evaluation workbench. |

---

## 2. Ingested Chapter Documents & Corpus

The system ingests and indexes both textbook chapters (Standard 10) and enterprise engineering documents:

| Document | Subject / Category | Format | Pages | Indexed Chunks | Key Topics Covered |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `chapter_01_Linear_Equations_in_Two_Variables.pdf` | Mathematics | PDF | 29 | 54 | Cramer's Rule, Determinants ($D, D_x, D_y$), Graphical Method, Simultaneous Equations |
| `chapter_01_Field_Visit.pdf` | Geography | PDF | 8 | 8 | Geographical study skills (observation, critical thinking), India-Brazil comparison |
| `chapter_01_Historiography_Development_in_the_West.pdf` | History | PDF | 6 | 7 | Textbook Bureau Balbharati, DIKSHA QR code digital lessons, Subject Committees |
| `engineering_handbook.md` | Technical Operations | Markdown | N/A | 17 | SEV-1 to SEV-4 incident SLOs, ArgoCD canary deployment rollback criteria |
| `cloud_security_policy.md` | Security & Compliance | Markdown | N/A | 15 | AES-256 KMS key rotation, zero-trust RBAC, vulnerability remediation SLAs |
| **Total** | **Knowledge Corpus** | — | **43+** | **101** | **All documents indexed in persistent ChromaDB** |

---

## 3. Evaluation Benchmark Suite (12 Test Cases)

The evaluation suite (`eval_bench.py`) tests the system across **Answerable Questions**, **Multi-Evidence Questions**, **Refusal Reliability (Zero Hallucination)**, and **Corrective Web Search**:

```text
                    Evaluation Benchmark Summary (12 Cases)                    
┌────────┬────────────────────────┬──────────────┬───────┬──────────┬─────────┐
│ ID     │ Category               │     Type     │ Conf. │  Latency │ Status  │
├────────┼────────────────────────┼──────────────┼───────┼──────────┼─────────┤
│ TC-01  │ Math - Linear Eq       │  answerable  │ 0.95  │   7945ms │  PASS   │
│ TC-02  │ Math - Graphical       │  answerable  │ 0.95  │  14561ms │  PASS   │
│ TC-03  │ Geography - Field Study│  answerable  │ 0.95  │  20475ms │  PASS   │
│ TC-04  │ Geography - Comparison │  answerable  │ 0.95  │  22197ms │  PASS   │
│ TC-05  │ History - DIKSHA App   │  answerable  │ 0.95  │  15724ms │  PASS   │
│ TC-06  │ History - Committee    │  answerable  │ 0.95  │  34958ms │  PASS   │
│ TC-07  │ Multi-Evidence Syn.    │ multi_evid.  │ 0.95  │  17239ms │  PASS   │
│ TC-08  │ Internal - SEV-1 SLO   │  answerable  │ 0.95  │  22618ms │  PASS   │
│ TC-09  │ Internal - KMS Encrypt │  answerable  │ 0.95  │  13490ms │  PASS   │
│ TC-10  │ Reliability - Refusal  │ unanswerable │ 0.00  │  18783ms │  PASS   │
│ TC-11  │ Reliability - Refusal  │ unanswerable │ 0.00  │  15650ms │  PASS   │
│ TC-12  │ External - Web Search  │ corrective   │ 0.75  │  11389ms │  PASS   │
└────────┴────────────────────────┴──────────────┴───────┴──────────┴─────────┘
Pass Rate: 100.0% (12/12) | Refusal Accuracy: 100.0% | Passing Score: 70/100
```

### Verification of Refusal Behavior
- **Query**: *"What is the secret recipe for dark chocolate lava cake according to the textbook?"*
- **Output**: `"The requested information is unavailable in the provided documents."` (Confidence: 0.00, Zero Hallucination).

---

## 4. Setup & Running Instructions

### Prerequisites
- Python 3.10+ (Python 3.11 recommended)
- Node.js 18+ & npm
- Docker & Docker Compose (Optional)

### Option A: Local Development Setup

1. **Clone and create virtual environment**:
   ```bash
   git clone <repo-url> hirekiwi-rag
   cd hirekiwi-rag
   python -m venv .venv
   # Windows:
   .\.venv\Scripts\activate
   # Linux/macOS:
   source .venv/bin/activate
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and set your Groq API Key:
   ```ini
   LLM_PROVIDER=groq
   GROQ_API_KEY=gsk_your_groq_api_key_here
   GROQ_MODEL=openai/gpt-oss-120b
   ```

4. **Run Document Ingestion CLI**:
   ```bash
   python scripts/ingest_cli.py
   ```

5. **Start FastAPI Backend**:
   ```bash
   uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
   ```

6. **Start Frontend Dashboard**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

### Option B: Docker Containerized Setup

Build and run both backend and frontend via Docker Compose:

```bash
docker-compose up --build
```

- **Backend API**: `http://localhost:8000/docs` (Swagger UI)
- **Frontend Dashboard**: `http://localhost:5173`

---

### Option C: Running Automated Tests

Run the full pytest suite (22 unit & integration tests):

```bash
pytest backend/tests -v
```

Run the 12-question evaluation benchmark:

```bash
python eval_bench.py
```

---

## 5. API Reference

### `POST /api/query`
Executes the CRAG state machine for a user query.

**Request**:
```json
{
  "query": "How do you solve simultaneous linear equations using Cramer's Rule, and what are D, Dx, and Dy?",
  "top_k": 4,
  "enable_web_search": false,
  "similarity_threshold": 0.4
}
```

**Response**:
```json
{
  "query": "How do you solve simultaneous linear equations using Cramer's Rule...",
  "answer": "Cramer’s Rule for two‑variable linear equations...\n- D = a1*b2 - a2*b1\n- Dx = c1*b2 - c2*b1\n- Dy = a1*c2 - a2*c1\n[chapter_01_Linear_Equations_in_Two_Variables.pdf | Page 23]",
  "sources": [
    {
      "id": "chapter_01_Linear_Equations_in_Two_Variables.pdf_p23_0_a1b2c3",
      "source": "chapter_01_Linear_Equations_in_Two_Variables.pdf",
      "score": 0.9841,
      "relevance": "relevant",
      "metadata": {
        "page_number": 23,
        "rrf_score": 0.016129,
        "dense_rank": 1,
        "bm25_rank": 1
      }
    }
  ],
  "web_search_used": false,
  "confidence_score": 0.95,
  "execution_steps": [
    {"step_name": "retrieve", "status": "completed", "duration_ms": 18.2},
    {"step_name": "rerank", "status": "completed", "duration_ms": 2.4},
    {"step_name": "grade_documents", "status": "completed", "duration_ms": 1150.3},
    {"step_name": "generate", "status": "completed", "duration_ms": 1920.1}
  ],
  "total_latency_ms": 3091.0
}
```

### `GET /api/documents`
Lists all indexed documents, chunk distributions, and chapter categories.

### `POST /api/ingest`
Triggers directory or file ingestion into the vector store (`force_reload: true` to rebuild).

---

## 6. Trade-offs, Limitations & Future Work

### Trade-offs Made (within 4–6 hr Scope)
1. **Hybrid BM25 + Dense RRF vs External Cross-Encoder**:
   - *Decision*: Implemented in-memory BM25 combined with cosine distance via Reciprocal Rank Fusion ($k=60$) rather than loading a 1.5 GB HuggingFace CrossEncoder model.
   - *Rationale*: RRF executes in $\approx 2.5\text{ ms}$ with zero memory bloat, runs seamlessly in local/Docker environments without requiring CUDA GPUs, and avoids gigabyte download delays.
2. **Groq Free Tier TPM Management**:
   - *Decision*: Groq free tier imposes an 8,000 TPM limit on `openai/gpt-oss-120b`. When rate limits occur, the system falls back smoothly to heuristic deterministic grading and backoff without pipeline failures.
3. **PDF Text Extraction**:
   - *Decision*: Used PyMuPDF with pypdf fallback. Pages containing purely decorative vector curves or scanned images without embedded text fonts (such as title art) yield minimal text unless OCR (Tesseract) is incorporated.

### What to Improve with More Time
1. **Multimodal OCR for Mathematical Diagrams**:
   - Extract and embed graph coordinate plots (e.g. intersecting lines on page 7 of Linear Equations) using Vision-Language Models (e.g. LLaVA or GPT-4o-vision).
2. **Hierarchical Multi-Vector Indexing (Parent Document Retriever)**:
   - Index smaller sentence-level chunks for high-precision retrieval while passing full surrounding page contexts to the generation LLM.
3. **Streaming Token Generation via WebSocket / SSE**:
   - Stream individual tokens directly to the frontend chat UI for instant perceived latency.
