#!/usr/bin/env bash
# ==============================================================================
# HireKiwi Corrective RAG (CRAG) Management & Execution Script
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Detect Python & binary paths (Virtualenv or System)
if [ -d "$SCRIPT_DIR/.venv/Scripts" ]; then
  PYTHON_BIN="$SCRIPT_DIR/.venv/Scripts/python.exe"
  PYTEST_BIN="$SCRIPT_DIR/.venv/Scripts/pytest.exe"
  UVICORN_BIN="$SCRIPT_DIR/.venv/Scripts/uvicorn.exe"
elif [ -d "$SCRIPT_DIR/.venv/bin" ]; then
  PYTHON_BIN="$SCRIPT_DIR/.venv/bin/python"
  PYTEST_BIN="$SCRIPT_DIR/.venv/bin/pytest"
  UVICORN_BIN="$SCRIPT_DIR/.venv/bin/uvicorn"
else
  PYTHON_BIN="python"
  PYTEST_BIN="pytest"
  UVICORN_BIN="uvicorn"
fi

show_help() {
  echo "======================================================================"
  echo "  HireKiwi Corrective RAG (CRAG) Control CLI"
  echo "======================================================================"
  echo "Usage: ./run.sh [COMMAND]"
  echo ""
  echo "Commands:"
  echo "  setup       Install Python and Node.js dependencies"
  echo "  ingest      Ingest sample documents into persistent ChromaDB"
  echo "  test        Run backend pytest test suite"
  echo "  eval        Run CRAG evaluation benchmark"
  echo "  backend     Start FastAPI backend server (port 8000)"
  echo "  frontend    Start Vite frontend dashboard (port 5173)"
  echo "  dev         Start both Backend and Frontend concurrently"
  echo "  help        Display this help message"
  echo "======================================================================"
}

cmd_setup() {
  echo "[+] Setting up HireKiwi CRAG dependencies..."
  if [ ! -f ".env" ]; then
    echo "[*] Copying .env.example to .env..."
    cp .env.example .env
  fi

  echo "[*] Creating virtual environment if missing..."
  if [ ! -d ".venv" ]; then
    python -m venv .venv
  fi

  echo "[*] Installing Python backend requirements..."
  "$PYTHON_BIN" -m pip install -r requirements.txt

  echo "[*] Installing Frontend npm dependencies..."
  cd "$SCRIPT_DIR/frontend"
  npm install
  cd "$SCRIPT_DIR"
  echo "[✓] Setup complete!"
}

cmd_ingest() {
  echo "[+] Ingesting sample documents into ChromaDB..."
  PYTHONPATH="$SCRIPT_DIR/backend" "$PYTHON_BIN" -c "
from app.services.ingestion import ingestion_service
res = ingestion_service.ingest_sample_documents(force_reload=True)
print(f'Ingestion successful: {res.total_chunks} chunks from {res.documents_processed} documents in {res.duration_ms}ms')
"
  echo "[✓] Ingestion finished."
}

cmd_test() {
  echo "[+] Running backend test suite with pytest..."
  PYTHONPATH="$SCRIPT_DIR/backend" "$PYTEST_BIN" backend/tests -v
}

cmd_eval() {
  echo "[+] Running CRAG Evaluation Benchmark..."
  "$PYTHON_BIN" eval_bench.py
}

cmd_backend() {
  echo "[+] Starting FastAPI backend on http://localhost:8000..."
  cd "$SCRIPT_DIR/backend"
  "$UVICORN_BIN" app.main:app --host 0.0.0.0 --port 8000 --reload
}

cmd_frontend() {
  echo "[+] Starting Vite frontend on http://localhost:5173..."
  cd "$SCRIPT_DIR/frontend"
  npm run dev
}

cmd_dev() {
  echo "[+] Starting HireKiwi CRAG in concurrent development mode..."
  # Trap SIGINT to kill background processes
  trap 'kill 0' SIGINT;
  (cmd_backend) &
  (cmd_frontend) &
  wait
}

case "$1" in
  setup)
    cmd_setup
    ;;
  ingest)
    cmd_ingest
    ;;
  test)
    cmd_test
    ;;
  eval)
    cmd_eval
    ;;
  backend)
    cmd_backend
    ;;
  frontend)
    cmd_frontend
    ;;
  dev)
    cmd_dev
    ;;
  help|--help|-h|"")
    show_help
    ;;
  *)
    echo "Unknown command: $1"
    show_help
    exit 1
    ;;
esac
