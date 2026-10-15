"""Configuration management for HireKiwi Corrective RAG (CRAG)."""

import os
from pathlib import Path
from typing import List, Union
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve base project directory
CURRENT_FILE = Path(__file__).resolve()
APP_DIR = CURRENT_FILE.parent
BACKEND_DIR = APP_DIR.parent
PROJECT_ROOT = BACKEND_DIR.parent


class Settings(BaseSettings):
    """Application settings loaded from environment variables or .env file."""

    model_config = SettingsConfigDict(
        env_file=str(PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # General App Config
    APP_NAME: str = "HireKiwi-CRAG"
    APP_ENV: str = "development"
    DEBUG: bool = True
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # LLM Settings
    LLM_PROVIDER: str = "openai"  # "openai", "groq", "ollama", "mock"
    LLM_MODEL: str = "gpt-4o-mini"
    LLM_TEMPERATURE: float = 0.0
    LLM_MAX_TOKENS: int = 1024

    # API Keys
    OPENAI_API_KEY: str = Field(default="")
    GROQ_API_KEY: str = Field(default="")
    GROQ_MODEL: str = "openai/gpt-oss-120b"
    TAVILY_API_KEY: str = Field(default="")

    # Web Search Settings
    SEARCH_PROVIDER: str = "duckduckgo"  # "duckduckgo", "tavily", "mock"
    SEARCH_MAX_RESULTS: int = 3

    # Vector Database & Embeddings
    EMBEDDING_PROVIDER: str = "sentence-transformers"  # "sentence-transformers", "openai"
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    CHROMA_PERSIST_DIR: str = str(PROJECT_ROOT / "data" / "chroma_db")
    SAMPLE_DOCS_DIR: str = str(PROJECT_ROOT / "data" / "sample_documents")
    DATA_DIR: str = str(PROJECT_ROOT / "data")

    # Ingestion Parameters
    CHUNK_SIZE: int = 600
    CHUNK_OVERLAP: int = 120

    # CRAG Parameters
    RETRIEVAL_TOP_K: int = 4
    INITIAL_RETRIEVAL_K: int = 8
    SIMILARITY_THRESHOLD: float = 0.4
    RERANKING_ENABLED: bool = True
    RERANK_TOP_N: int = 4
    REWRITE_QUERY_ENABLED: bool = True
    STRICT_GRADING: bool = False

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                import json

                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @field_validator("CHROMA_PERSIST_DIR", "SAMPLE_DOCS_DIR", mode="after")
    @classmethod
    def resolve_relative_paths(cls, v: str) -> str:
        path = Path(v)
        if not path.is_absolute():
            return str((PROJECT_ROOT / path).resolve())
        return str(path.resolve())

    @property
    def is_mock_llm(self) -> bool:
        """Determines if the LLM should operate in mock/offline mode."""
        if self.LLM_PROVIDER == "mock":
            return True
        if self.LLM_PROVIDER == "openai" and not self.OPENAI_API_KEY:
            return True
        if self.LLM_PROVIDER == "groq" and not self.GROQ_API_KEY:
            return True
        return False


# Singleton instance
settings = Settings()

# Ensure required directories exist
os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
os.makedirs(settings.SAMPLE_DOCS_DIR, exist_ok=True)
