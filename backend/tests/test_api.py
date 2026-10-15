"""Integration tests for FastAPI REST API endpoints."""

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_api_health():
    """Tests /api/health endpoint returns 200 and healthy status."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "llm_provider" in data
    assert "vector_store_chunks" in data
    assert isinstance(data["vector_store_chunks"], int)


def test_api_config():
    """Tests /api/config returns public configuration."""
    response = client.get("/api/config")
    assert response.status_code == 200
    data = response.json()
    assert "app_name" in data
    assert "llm_provider" in data
    assert "retrieval_top_k" in data


def test_api_documents_list():
    """Tests /api/documents returns list of indexed documents."""
    response = client.get("/api/documents")
    assert response.status_code == 200
    data = response.json()
    assert "total_documents" in data
    assert "total_chunks" in data
    assert "documents" in data


def test_api_query_endpoint():
    """Tests /api/query executes CRAG pipeline."""
    payload = {
        "query": "What is the policy for pull request approvals and branching?",
        "top_k": 3,
        "enable_web_search": True,
    }
    response = client.post("/api/query", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["query"] == payload["query"]
    assert "answer" in data
    assert len(data["answer"]) > 0
    assert "execution_steps" in data
    assert len(data["execution_steps"]) >= 3
    assert "total_latency_ms" in data


def test_api_query_validation():
    """Tests /api/query rejects invalid input."""
    # Too short query (< 2 characters)
    response = client.post("/api/query", json={"query": "a"})
    assert response.status_code == 422


def test_api_ingest_endpoint():
    """Tests /api/ingest triggers document re-ingestion."""
    payload = {
        "force_reload": False,
    }
    response = client.post("/api/ingest", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "total_chunks" in data
