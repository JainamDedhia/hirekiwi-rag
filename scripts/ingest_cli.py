"""CLI tool to ingest any directory or file into HireKiwi ChromaDB vector store."""

import argparse
import sys
import time
from pathlib import Path

# Add project root and backend directory
PROJECT_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.services.ingestion import ingestion_service
from app.services.vector_store import vector_store_service


def main():
    parser = argparse.ArgumentParser(description="HireKiwi RAG Ingestion CLI")
    parser.add_argument("--dir", type=str, help="Path to directory containing PDF/MD/TXT documents")
    parser.add_argument("--file", type=str, help="Path to single PDF/MD/TXT document to ingest")
    parser.add_argument("--reload", action="store_true", help="Clear existing vector store before ingesting")
    args = parser.parse_args()

    print("==================================================")
    print("   HireKiwi Knowledge Ingestion Engine (CLI)     ")
    print("==================================================")

    start_time = time.time()

    if args.file:
        file_path = Path(args.file)
        print(f"[*] Ingesting single file: {file_path}...")
        chunks = ingestion_service.ingest_file(file_path)
        print(f"[+] Successfully generated and indexed {len(chunks)} chunks.")
    elif args.dir:
        dir_path = Path(args.dir)
        print(f"[*] Ingesting directory: {dir_path} (Force reload: {args.reload})...")
        res = ingestion_service.ingest_directory(dir_path, force_reload=args.reload)
        print(f"[+] Processed {res.documents_processed} documents.")
        print(f"[+] Total indexed chunks: {res.total_chunks} in {res.duration_ms:.1f}ms")
    else:
        print(f"[*] Auto-discovering documents across data directories (Force reload: {args.reload})...")
        res = ingestion_service.ingest_sample_documents(force_reload=args.reload)
        print(f"[+] Processed {res.documents_processed} documents.")
        print(f"[+] Total indexed chunks: {res.total_chunks}")

    stats = vector_store_service.get_collection_stats()
    print("\n--- ChromaDB Collection Status ---")
    print(f"Total chunks in vector index: {stats['total_chunks']}")
    print(f"Unique source documents: {len(stats['indexed_documents'])}")
    for d in stats["indexed_documents"]:
        print(f"  • {d}")

    print(f"\n[+] Total time elapsed: {(time.time() - start_time):.2f}s")


if __name__ == "__main__":
    main()
