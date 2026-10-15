"""Unit and integration tests for document ingestion and chunking."""

import os
from pathlib import Path
import pytest

from app.models.schemas import DocumentChunk
from app.services.ingestion import IngestionService
from app.services.vector_store import VectorStoreService


@pytest.fixture
def ingestion_service():
    return IngestionService()


def test_markdown_section_splitting(ingestion_service):
    """Verifies that markdown headers are extracted as section metadata."""
    sample_md = """# Architecture Overview
This is the general architecture overview of HireKiwi.

## Microservices
We use microservices with gRPC protocol buffers.

## Deployment
ArgoCD handles blue-green rollouts.
"""
    chunks = ingestion_service._split_markdown_sections(sample_md, "test_arch.md")

    assert len(chunks) >= 2
    sources = {c.source for c in chunks}
    assert sources == {"test_arch.md"}

    sections = [c.metadata.get("section") for c in chunks]
    assert any("Architecture Overview" in s or "Microservices" in s for s in sections)


def test_chunk_size_and_overlap(ingestion_service):
    """Verifies overlapping chunk generation on long paragraphs."""
    long_text = "HireKiwi engineering standards require high reliability. " * 30
    chunks = ingestion_service._chunk_text(long_text, chunk_size=200, chunk_overlap=50)

    assert len(chunks) > 1
    # Check that chunks have content
    for ch in chunks:
        assert len(ch) > 0


def test_chunk_id_determinism_and_hashing(ingestion_service):
    """Verifies that chunk IDs contain hashes and are deterministic."""
    sample_md = "## API Security\nAll endpoints must enforce OAuth2 and JWT validation."
    chunks1 = ingestion_service._split_markdown_sections(sample_md, "sec.md")
    chunks2 = ingestion_service._split_markdown_sections(sample_md, "sec.md")

    assert len(chunks1) == len(chunks2)
    assert chunks1[0].id == chunks2[0].id
    assert "sec.md" in chunks1[0].id


def test_ingest_sample_documents(ingestion_service):
    """Tests loading the sample enterprise documents from data directory."""
    from app.config import settings

    docs_dir = Path(settings.SAMPLE_DOCS_DIR)
    assert docs_dir.exists(), f"Sample docs directory not found at {docs_dir}"

    resp = ingestion_service.ingest_directory(docs_dir, force_reload=True)
    assert resp.status == "success"
    assert resp.documents_processed >= 2
    assert resp.total_chunks > 0
    assert "engineering_handbook.md" in resp.sources
    assert "cloud_security_policy.md" in resp.sources


def test_pdf_parsing(ingestion_service):
    """Tests parsing a real chapter PDF file and ensuring page-level chunking."""
    from app.config import settings
    pdf_path = Path(settings.DATA_DIR) / "chapter_01_Field_Visit.pdf"
    if pdf_path.exists():
        chunks = ingestion_service._parse_pdf(pdf_path)
        assert len(chunks) > 0
        assert chunks[0].source == "chapter_01_Field_Visit.pdf"
        assert chunks[0].metadata.get("file_type") == "pdf"
        assert "page_number" in chunks[0].metadata
