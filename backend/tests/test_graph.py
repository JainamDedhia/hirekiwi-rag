"""Tests for LangGraph CRAG workflow nodes, routing, and end-to-end execution."""

import pytest
from app.models.schemas import DocumentChunk, WebSearchResult
from app.services.graph import (
    crag_workflow,
    decide_to_generate,
    generate,
    grade_documents,
    retrieve,
    run_crag_pipeline,
    transform_query,
    web_search_node,
)
from app.services.ingestion import ingestion_service


@pytest.fixture(scope="module", autouse=True)
def setup_vector_store():
    """Ensure vector store has sample documents loaded for graph testing."""
    ingestion_service.ingest_sample_documents(force_reload=False)


def test_retrieve_node():
    """Tests the retrieve node fetches documents from ChromaDB."""
    state = {
        "question": "What is HireKiwi's on-call rotation SLO for SEV-1 incidents?",
        "top_k": 3,
        "similarity_threshold": 0.0,
        "trace": [],
    }
    result = retrieve(state)
    assert "documents" in result
    assert len(result["documents"]) > 0
    assert len(result["trace"]) == 1
    assert result["trace"][0].step_name == "retrieve"


def test_grade_documents_relevant():
    """Tests grading relevant documents retains them and does not trigger web search."""
    doc = DocumentChunk(
        id="chunk_test_1",
        content="SEV-1 (Critical): Response SLO is < 15 minutes. VP of Engineering is paged immediately.",
        source="engineering_handbook.md",
    )
    state = {
        "question": "What is the response SLO for SEV-1 incidents?",
        "documents": [doc],
        "enable_web_search": True,
        "trace": [],
    }
    result = grade_documents(state)
    assert len(result["filtered_documents"]) == 1
    assert result["web_search"] == "No"
    assert result["filtered_documents"][0].relevance == "relevant"


def test_grade_documents_irrelevant_triggers_search():
    """Tests grading irrelevant documents filters them and triggers corrective web search."""
    doc = DocumentChunk(
        id="chunk_test_2",
        content="Our frontend uses Tailwind CSS for styling and React functional components.",
        source="engineering_handbook.md",
    )
    state = {
        "question": "What are the new syntax features introduced in Python 3.12?",
        "documents": [doc],
        "enable_web_search": True,
        "trace": [],
    }
    result = grade_documents(state)
    assert len(result["filtered_documents"]) == 0
    assert result["web_search"] == "Yes"


def test_decide_to_generate_routing():
    """Verifies conditional routing decisions based on web_search state."""
    state_no_search = {"web_search": "No"}
    assert decide_to_generate(state_no_search) == "generate"

    state_search_needed = {"web_search": "Yes"}
    assert decide_to_generate(state_search_needed) == "transform_query"


def test_transform_query_node():
    """Tests query rewriter modifies query for web search."""
    state = {
        "question": "What are the latest features in Python 3.12?",
        "trace": [],
    }
    result = transform_query(state)
    assert "transformed_query" in result
    assert len(result["transformed_query"]) > 5
    assert len(result["trace"]) == 1


def test_web_search_node():
    """Tests external web search node returns results."""
    state = {
        "question": "Python 3.12 features",
        "transformed_query": "Python 3.12 release notes new features",
        "trace": [],
    }
    result = web_search_node(state)
    assert "web_results" in result
    assert len(result["web_results"]) > 0
    assert isinstance(result["web_results"][0], WebSearchResult)


def test_generate_node_with_internal_docs():
    """Tests generate node produces grounded answer from internal chunks."""
    doc = DocumentChunk(
        id="chunk_test_3",
        content="HireKiwi requires at least two peer approvals for all pull requests.",
        source="engineering_handbook.md",
    )
    state = {
        "question": "How many approvals are required for pull requests?",
        "filtered_documents": [doc],
        "web_results": [],
        "trace": [],
    }
    result = generate(state)
    assert "generation" in result
    assert len(result["generation"]) > 10
    assert result["confidence"] > 0.7


def test_end_to_end_crag_pipeline_internal_query():
    """Tests full CRAG workflow on an internal knowledge question."""
    query = "What is the policy for encrypting customer data at rest?"
    resp = run_crag_pipeline(query=query, top_k=3)

    assert resp.query == query
    assert len(resp.answer) > 20
    assert resp.confidence_score > 0.0
    assert len(resp.execution_steps) >= 3

    step_names = [s.step_name for s in resp.execution_steps]
    assert "retrieve" in step_names
    assert "grade_documents" in step_names
    assert "generate" in step_names


def test_end_to_end_crag_pipeline_external_query_fallback():
    """Tests full CRAG workflow triggering corrective fallback for external query."""
    query = "What are the latest features released in Python 3.12?"
    resp = run_crag_pipeline(query=query, top_k=3, enable_web_search=True)

    assert resp.query == query
    assert resp.web_search_used is True
    step_names = [s.step_name for s in resp.execution_steps]
    assert "transform_query" in step_names
    assert "web_search" in step_names
    assert "generate" in step_names
    assert len(resp.web_sources) > 0
