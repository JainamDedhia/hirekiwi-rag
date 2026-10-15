"""Pydantic schemas for request, response, and pipeline representations."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class DocumentChunk(BaseModel):
    """Represents an ingested text chunk with metadata."""

    id: str = Field(description="Unique identifier for chunk")
    content: str = Field(description="Text content of the document chunk")
    source: str = Field(description="Source document filename or URI")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Metadata key-value pairs")
    score: Optional[float] = Field(default=None, description="Retrieval similarity score")
    relevance: Optional[str] = Field(default="unscored", description="'relevant' or 'irrelevant'")
    grade_reason: Optional[str] = Field(default=None, description="Evaluation rationale by grader")


class GradedDocument(BaseModel):
    """Result of LLM grading a document chunk against a user query."""

    document: DocumentChunk
    is_relevant: bool
    reason: str


class WebSearchResult(BaseModel):
    """External web search result item."""

    title: str
    url: str
    snippet: str


class PipelineStep(BaseModel):
    """Step execution metric and trace in CRAG state machine."""

    step_name: str = Field(description="Name of the LangGraph node executed")
    status: str = Field(default="completed", description="'completed', 'skipped', or 'error'")
    details: Dict[str, Any] = Field(default_factory=dict, description="Step metadata and counts")
    duration_ms: float = Field(default=0.0, description="Step execution time in milliseconds")


class QueryRequest(BaseModel):
    """Input payload for CRAG query pipeline."""

    query: str = Field(..., min_length=2, description="Natural language user question")
    top_k: Optional[int] = Field(default=4, ge=1, le=20, description="Number of chunks to retrieve")
    enable_web_search: Optional[bool] = Field(
        default=True, description="Whether to allow web search fallback if internal docs fail"
    )
    similarity_threshold: Optional[float] = Field(
        default=None, description="Minimum similarity score filter"
    )


class QueryResponse(BaseModel):
    """Output payload from CRAG pipeline."""

    query: str
    answer: str
    sources: List[DocumentChunk] = Field(default_factory=list)
    web_search_used: bool = False
    rewritten_query: Optional[str] = None
    web_sources: List[WebSearchResult] = Field(default_factory=list)
    confidence_score: float = Field(default=0.0, ge=0.0, le=1.0)
    execution_steps: List[PipelineStep] = Field(default_factory=list)
    total_latency_ms: float = 0.0


class IngestRequest(BaseModel):
    """Request payload to trigger document ingestion."""

    file_path: Optional[str] = Field(default=None, description="Specific file to ingest")
    directory_path: Optional[str] = Field(
        default=None, description="Directory of documents to ingest"
    )
    force_reload: bool = Field(
        default=False, description="Clear existing collection before ingesting"
    )


class IngestResponse(BaseModel):
    """Response payload for document ingestion."""

    status: str
    documents_processed: int
    total_chunks: int
    sources: List[str]
    duration_ms: float


class HealthResponse(BaseModel):
    """System health and operational status."""

    status: str
    app_name: str
    version: str
    llm_provider: str
    is_mock_llm: bool
    search_provider: str
    embedding_provider: str
    vector_store_chunks: int
    indexed_documents: List[str]


class DocumentListResponse(BaseModel):
    """List of indexed documents and statistics."""

    total_documents: int
    total_chunks: int
    documents: List[Dict[str, Any]]
