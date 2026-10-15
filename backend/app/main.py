"""FastAPI web server for HireKiwi Corrective RAG (CRAG) system."""

import json
import logging
import time
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from pathlib import Path
from fastapi import FastAPI, File, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from app.config import settings
from app.models.schemas import (
    DocumentListResponse,
    HealthResponse,
    IngestRequest,
    IngestResponse,
    QueryRequest,
    QueryResponse,
)
from app.services.graph import crag_workflow, run_crag_pipeline
from app.services.ingestion import ingestion_service
from app.services.vector_store import vector_store_service

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("hirekiwi-rag")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: binds port immediately, syncs vector DB in background."""
    logger.info("Initializing %s (Env: %s)...", settings.APP_NAME, settings.APP_ENV)

    async def _init_vector_db():
        import asyncio
        loop = asyncio.get_event_loop()
        try:
            logger.info("Starting background vector DB synchronization...")
            await loop.run_in_executor(None, ingestion_service.ingest_sample_documents, False)
            stats = vector_store_service.get_collection_stats()
            logger.info(
                "Background vector DB sync complete: %d chunks across %d documents.",
                stats["total_chunks"],
                len(stats["indexed_documents"]),
            )
        except Exception as e:
            logger.error("Error during background vector DB initialization: %s", e)

    import asyncio
    asyncio.create_task(_init_vector_db())
    yield
    logger.info("Shutting down %s...", settings.APP_NAME)


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Production-Grade Corrective Retrieval-Augmented Generation (CRAG) Service",
    lifespan=lifespan,
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------


@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint reporting vector store and provider statuses."""
    stats = vector_store_service.get_collection_stats()
    return HealthResponse(
        status="healthy",
        app_name=settings.APP_NAME,
        version="1.0.0",
        llm_provider=settings.LLM_PROVIDER,
        is_mock_llm=settings.is_mock_llm,
        search_provider=settings.SEARCH_PROVIDER,
        embedding_provider=settings.EMBEDDING_PROVIDER,
        vector_store_chunks=stats["total_chunks"],
        indexed_documents=stats["indexed_documents"],
    )


@app.get("/api/config")
async def get_public_config():
    """Returns safe runtime configurations without secrets."""
    return {
        "app_name": settings.APP_NAME,
        "env": settings.APP_ENV,
        "llm_provider": settings.LLM_PROVIDER,
        "llm_model": settings.LLM_MODEL,
        "is_mock_llm": settings.is_mock_llm,
        "search_provider": settings.SEARCH_PROVIDER,
        "embedding_provider": settings.EMBEDDING_PROVIDER,
        "embedding_model": settings.EMBEDDING_MODEL,
        "retrieval_top_k": settings.RETRIEVAL_TOP_K,
        "similarity_threshold": settings.SIMILARITY_THRESHOLD,
        "chunk_size": settings.CHUNK_SIZE,
        "chunk_overlap": settings.CHUNK_OVERLAP,
    }


@app.post("/api/query", response_model=QueryResponse)
async def execute_crag_query(request: QueryRequest):
    """Executes the complete Corrective RAG pipeline for a given query."""
    try:
        response = run_crag_pipeline(
            query=request.query,
            top_k=request.top_k or settings.RETRIEVAL_TOP_K,
            enable_web_search=request.enable_web_search if request.enable_web_search is not None else True,
            similarity_threshold=request.similarity_threshold or settings.SIMILARITY_THRESHOLD,
            selected_documents=request.selected_documents,
            chat_history=request.chat_history,
        )
        return response
    except Exception as e:
        logger.error("Query execution failed: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"CRAG execution error: {str(e)}",
        )


@app.post("/api/query/stream")
async def stream_crag_query(request: QueryRequest):
    """Streams pipeline progress events via Server-Sent Events (SSE)."""

    async def event_generator() -> AsyncGenerator[str, None]:
        start_time = time.time()
        yield f"data: {json.dumps({'event': 'started', 'query': request.query})}\n\n"

        # Execute pipeline
        response = run_crag_pipeline(
            query=request.query,
            top_k=request.top_k or settings.RETRIEVAL_TOP_K,
            enable_web_search=request.enable_web_search if request.enable_web_search is not None else True,
            similarity_threshold=request.similarity_threshold or settings.SIMILARITY_THRESHOLD,
            selected_documents=request.selected_documents,
            chat_history=request.chat_history,
        )

        for step in response.execution_steps:
            yield f"data: {json.dumps({'event': 'step', 'step': step.model_dump()})}\n\n"

        yield f"data: {json.dumps({'event': 'completed', 'response': response.model_dump()})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/ingest", response_model=IngestResponse)
async def ingest_documents(request: IngestRequest):
    """Ingests documents from disk into ChromaDB."""
    try:
        if request.directory_path:
            from pathlib import Path

            result = ingestion_service.ingest_directory(
                Path(request.directory_path), force_reload=request.force_reload
            )
        else:
            result = ingestion_service.ingest_sample_documents(force_reload=request.force_reload)
        return result
    except Exception as e:
        logger.error("Ingestion failed: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Document ingestion error: {str(e)}",
        )


@app.get("/api/documents", response_model=DocumentListResponse)
async def list_documents():
    """Lists indexed documents, chapter details, and vector store statistics."""
    stats = vector_store_service.get_collection_stats()
    chunk_counts = vector_store_service.get_document_chunk_counts()
    catalog = ingestion_service.get_document_catalog()

    doc_details = []
    seen = set()

    # Merge catalog items with live vector store chunk counts
    for item in catalog:
        doc_name = item["name"]
        seen.add(doc_name)
        chunks = chunk_counts.get(doc_name, 0)
        doc_details.append({
            "name": doc_name,
            "status": "indexed" if chunks > 0 else "available",
            "type": item["type"],
            "category": item["category"],
            "pages": item.get("pages"),
            "size_kb": item["size_kb"],
            "chunks": chunks,
        })

    # Add any indexed documents not present in catalog
    for doc_name, count in chunk_counts.items():
        if doc_name not in seen:
            doc_details.append({
                "name": doc_name,
                "status": "indexed",
                "type": "pdf" if doc_name.lower().endswith(".pdf") else "markdown",
                "category": "Knowledge Base",
                "pages": None,
                "size_kb": 0.0,
                "chunks": count,
            })

    return DocumentListResponse(
        total_documents=len(doc_details),
        total_chunks=stats["total_chunks"],
        documents=doc_details,
    )


@app.post("/api/documents/upload")
async def upload_document(file: UploadFile = File(...)):
    """Uploads a PDF, Markdown, or TXT file, chunks it, and indexes it into ChromaDB."""
    filename = Path(file.filename).name
    allowed_extensions = {".pdf", ".md", ".markdown", ".txt"}
    suffix = Path(filename).suffix.lower()

    if suffix not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{suffix}'. Allowed formats: .pdf, .md, .txt",
        )

    destination = Path(settings.DATA_DIR) / filename
    try:
        content = await file.read()
        with open(destination, "wb") as f:
            f.write(content)

        # Ingest into vector store
        chunks = ingestion_service.ingest_file(destination)

        # Get page count if PDF
        pages = None
        if suffix == ".pdf":
            try:
                import pymupdf
                doc = pymupdf.open(str(destination))
                pages = len(doc)
                doc.close()
            except Exception:
                pass

        file_size_kb = round(len(content) / 1024, 1)
        logger.info("Uploaded and indexed '%s' (%d chunks, %s KB)", filename, len(chunks), file_size_kb)

        return {
            "status": "success",
            "message": f"Successfully uploaded and indexed '{filename}'",
            "name": filename,
            "type": "pdf" if suffix == ".pdf" else "markdown",
            "chunks": len(chunks),
            "pages": pages,
            "size_kb": file_size_kb,
        }
    except Exception as e:
        logger.error("Failed to upload/ingest document %s: %s", filename, e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Document upload and indexing failed: {str(e)}",
        )


@app.delete("/api/documents/{document_name}")
async def delete_document(document_name: str):
    """Deletes a document from the vector store and disk."""
    try:
        deleted_count = vector_store_service.delete_by_source(document_name)

        # Remove from data directory if exists
        file_path = Path(settings.DATA_DIR) / document_name
        if file_path.exists() and file_path.is_file():
            file_path.unlink()

        return {
            "status": "success",
            "message": f"Removed document '{document_name}' and {deleted_count} indexed chunks.",
        }
    except Exception as e:
        logger.error("Error deleting document %s: %s", document_name, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete document: {str(e)}",
        )


@app.delete("/api/documents")
async def clear_documents():
    """Clears all indexed documents from ChromaDB."""
    vector_store_service.clear_collection()
    return {"status": "success", "message": "All documents cleared from vector store."}
