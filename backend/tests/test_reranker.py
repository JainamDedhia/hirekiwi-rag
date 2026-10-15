"""Unit tests for Hybrid BM25 + Dense Reciprocal Rank Fusion Reranker."""

import pytest
from app.models.schemas import DocumentChunk
from app.services.reranker import RerankerService


def test_reranker_basic_ordering():
    """Tests that reranker appropriately blends dense and lexical scores."""
    reranker = RerankerService()

    chunks = [
        DocumentChunk(
            id="c1",
            content="Linear equations in two variables can be solved using Cramer's Rule with determinants D, Dx, Dy.",
            source="math.pdf",
            score=0.75,
            metadata={"source": "math.pdf"},
        ),
        DocumentChunk(
            id="c2",
            content="Weather in tropical rain forests involves high precipitation and constant warm temperature.",
            source="geo.pdf",
            score=0.85,
            metadata={"source": "geo.pdf"},
        ),
        DocumentChunk(
            id="c3",
            content="Simultaneous linear equations graphical method requires finding coordinates of points.",
            source="math.pdf",
            score=0.70,
            metadata={"source": "math.pdf"},
        ),
    ]

    query = "How to solve linear equations using determinants and Cramer's rule?"
    results = reranker.rerank(query, chunks, top_n=2)

    assert len(results) == 2
    # The most relevant chunk to Cramer's Rule should be ranked #1
    assert results[0].id == "c1"
    assert "rrf_score" in results[0].metadata
    assert "dense_rank" in results[0].metadata
    assert "bm25_rank" in results[0].metadata


def test_reranker_empty_or_single_candidate():
    """Tests that empty or single candidate lists are handled gracefully without error."""
    reranker = RerankerService()
    assert reranker.rerank("any query", []) == []

    single = [
        DocumentChunk(
            id="c1",
            content="Single chunk test content",
            source="doc.txt",
            metadata={},
        )
    ]
    res = reranker.rerank("any query", single)
    assert len(res) == 1
    assert res[0].id == "c1"
