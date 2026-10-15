"""Persistent ChromaDB vector store service."""

import logging
import os
from typing import Any, Dict, List, Optional, Tuple

import chromadb
from chromadb.config import Settings as ChromaSettings

from app.config import settings
from app.models.schemas import DocumentChunk

logger = logging.getLogger(__name__)

COLLECTION_NAME = "hirekiwi_knowledge_base"


class VectorStoreService:
    """Manages persistent ChromaDB vector storage and semantic retrieval."""

    def __init__(self):
        self.persist_dir = settings.CHROMA_PERSIST_DIR
        os.makedirs(self.persist_dir, exist_ok=True)
        self._client: Optional[chromadb.ClientAPI] = None
        self._collection = None
        self._embedding_function = None
        self._init_store()

    def _init_store(self):
        """Initializes ChromaDB persistent client and collection."""
        try:
            self._client = chromadb.PersistentClient(
                path=self.persist_dir,
                settings=ChromaSettings(anonymized_telemetry=False, is_persistent=True),
            )
            self._setup_embedding_function()
            # Initialize collection
            _ = self.collection
            count = self.collection.count()
            logger.info("ChromaDB initialized at %s with %d existing vectors", self.persist_dir, count)
        except Exception as e:
            logger.error("Failed to initialize ChromaDB: %s. Using ephemeral store.", e)
            self._client = chromadb.Client()
            self._collection = self._client.get_or_create_collection(name=COLLECTION_NAME)

    @property
    def collection(self):
        """Always returns an active, valid Chroma collection handle."""
        try:
            if self._collection is not None:
                self._collection.count()
                return self._collection
        except Exception:
            pass

        try:
            if self._embedding_function:
                self._collection = self._client.get_or_create_collection(
                    name=COLLECTION_NAME,
                    embedding_function=self._embedding_function,
                    metadata={"hnsw:space": "cosine"},
                )
            else:
                self._collection = self._client.get_or_create_collection(
                    name=COLLECTION_NAME,
                    metadata={"hnsw:space": "cosine"},
                )
        except Exception as e:
            logger.error("Failed to re-fetch collection: %s", e)
        return self._collection

    def _setup_embedding_function(self):
        """Configures the embedding function with graceful fallbacks."""
        if settings.EMBEDDING_PROVIDER == "openai" and settings.OPENAI_API_KEY:
            try:
                from chromadb.utils import embedding_functions

                self._embedding_function = (
                    embedding_functions.OpenAIEmbeddingFunction(
                        api_key=settings.OPENAI_API_KEY,
                        model_name=settings.EMBEDDING_MODEL,
                    )
                )
                logger.info("Using OpenAI embeddings: %s", settings.EMBEDDING_MODEL)
                return
            except Exception as e:
                logger.warning("OpenAI embedding setup failed: %s. Falling back to default.", e)

        # Prefer Chroma's fast, lightweight DefaultEmbeddingFunction (ONNX, <50MB RAM, zero PyTorch bloat)
        try:
            from chromadb.utils import embedding_functions

            self._embedding_function = embedding_functions.DefaultEmbeddingFunction()
            logger.info("Using Chroma DefaultEmbeddingFunction (ONNX all-MiniLM-L6-v2).")
            return
        except Exception as onnx_err:
            logger.warning("DefaultEmbeddingFunction fallback to sentence-transformers: %s", onnx_err)

        try:
            from chromadb.utils import embedding_functions

            self._embedding_function = (
                embedding_functions.SentenceTransformerEmbeddingFunction(
                    model_name="all-MiniLM-L6-v2"
                )
            )
            logger.info("Using SentenceTransformer embeddings: all-MiniLM-L6-v2")
        except Exception as def_err:
            logger.warning("Default embedding function unavailable: %s", def_err)
            self._embedding_function = None

    def add_documents(self, chunks: List[DocumentChunk]) -> int:
        """Adds a list of document chunks into ChromaDB."""
        if not chunks:
            return 0

        ids = [chunk.id for chunk in chunks]
        documents = [chunk.content for chunk in chunks]
        metadatas = []
        for chunk in chunks:
            meta = dict(chunk.metadata)
            meta["source"] = chunk.source
            metadatas.append(meta)

        self.collection.upsert(
            ids=ids,
            documents=documents,
            metadatas=metadatas,
        )
        logger.info("Upserted %d chunks into ChromaDB collection '%s'", len(chunks), COLLECTION_NAME)
        return len(chunks)

    def similarity_search_with_score(
        self,
        query: str,
        top_k: int = 4,
        score_threshold: Optional[float] = None,
        doc_sources: Optional[List[str]] = None,
    ) -> List[Tuple[DocumentChunk, float]]:
        """Retrieves top_k chunks matching the query with cosine similarity scores, optionally filtered by source documents."""
        total_items = self.collection.count()
        if total_items == 0:
            logger.warning("Vector store is empty! No documents to retrieve.")
            return []

        actual_k = min(top_k, total_items)
        query_kwargs: Dict[str, Any] = {
            "query_texts": [query],
            "n_results": actual_k,
            "include": ["documents", "metadatas", "distances"],
        }

        # Apply document filter if requested
        if doc_sources and len(doc_sources) > 0:
            if len(doc_sources) == 1:
                query_kwargs["where"] = {"source": doc_sources[0]}
            else:
                query_kwargs["where"] = {"source": {"$in": doc_sources}}

        try:
            results = self.collection.query(**query_kwargs)
        except Exception as e:
            logger.warning("Filtered query error (%s). Retrying without where filter.", e)
            query_kwargs.pop("where", None)
            results = self.collection.query(**query_kwargs)

        matched_chunks: List[Tuple[DocumentChunk, float]] = []

        docs = results.get("documents", [[]])[0]
        metas = results.get("metadatas", [[]])[0]
        ids = results.get("ids", [[]])[0]
        distances = results.get("distances", [[]])[0]

        for chunk_id, content, meta, dist in zip(ids, docs, metas, distances):
            similarity = max(0.0, min(1.0, 1.0 - (dist if dist is not None else 0.0)))

            if score_threshold is not None and similarity < score_threshold:
                continue

            source = meta.get("source", "unknown") if meta else "unknown"
            chunk = DocumentChunk(
                id=chunk_id,
                content=content,
                source=source,
                metadata=meta or {},
                score=round(similarity, 4),
            )
            matched_chunks.append((chunk, similarity))

        return matched_chunks

    def similarity_search(
        self, query: str, top_k: int = 4, doc_sources: Optional[List[str]] = None
    ) -> List[DocumentChunk]:
        """Returns top_k matching DocumentChunks, optionally filtered by source documents."""
        scored = self.similarity_search_with_score(query, top_k=top_k, doc_sources=doc_sources)
        return [chunk for chunk, _ in scored]

    def get_collection_stats(self) -> Dict[str, Any]:
        """Returns statistics of the current collection."""
        count = self.collection.count()
        indexed_docs = self.get_indexed_documents()
        return {
            "collection_name": COLLECTION_NAME,
            "total_chunks": count,
            "indexed_documents": indexed_docs,
            "storage_path": self.persist_dir,
        }

    def get_indexed_documents(self) -> List[str]:
        """Returns list of unique document sources present in the index."""
        try:
            results = self.collection.get(include=["metadatas"])
            metadatas = results.get("metadatas", [])
            sources = set()
            for m in metadatas:
                if m and "source" in m:
                    sources.add(m["source"])
            return sorted(list(sources))
        except Exception as e:
            logger.error("Failed to query indexed documents: %s", e)
            return []

    def get_document_chunk_counts(self) -> Dict[str, int]:
        """Returns chunk count mapped to each source document."""
        try:
            results = self.collection.get(include=["metadatas"])
            metadatas = results.get("metadatas", [])
            counts: Dict[str, int] = {}
            for m in metadatas:
                if m and "source" in m:
                    src = m["source"]
                    counts[src] = counts.get(src, 0) + 1
            return counts
        except Exception as e:
            logger.error("Failed to query document chunk counts: %s", e)
            return {}

    def delete_by_source(self, source_name: str) -> int:
        """Deletes all chunks belonging to a specific source document."""
        try:
            # Check how many chunks match
            existing = self.collection.get(where={"source": source_name})
            ids = existing.get("ids", [])
            if ids:
                self.collection.delete(ids=ids)
                logger.info("Deleted %d chunks for source '%s' from ChromaDB", len(ids), source_name)
                return len(ids)
            return 0
        except Exception as e:
            logger.error("Error deleting chunks for '%s': %s", source_name, e)
            return 0

    def get_introductory_chunks(
        self, doc_sources: List[str], max_chunks_per_doc: int = 4
    ) -> List[DocumentChunk]:
        """Retrieves introductory chunks (earliest pages / chunk indices) for selected documents."""
        intro_chunks: List[DocumentChunk] = []
        if not doc_sources:
            return intro_chunks

        for src in doc_sources:
            try:
                res = self.collection.get(
                    where={"source": src},
                    include=["documents", "metadatas"],
                )
                ids = res.get("ids", [])
                docs = res.get("documents", [])
                metas = res.get("metadatas", [])

                if not ids:
                    continue

                # Sort by page_number or chunk_index
                zipped = list(zip(ids, docs, metas))
                zipped.sort(
                    key=lambda x: (
                        x[2].get("page_number", 999) if x[2] else 999,
                        x[2].get("chunk_index", 999) if x[2] else 999,
                    )
                )

                for chunk_id, content, meta in zipped[:max_chunks_per_doc]:
                    intro_chunks.append(
                        DocumentChunk(
                            id=chunk_id,
                            content=content,
                            source=src,
                            metadata=meta or {},
                            score=1.0,
                        )
                    )
            except Exception as e:
                logger.warning("Error fetching introductory chunks for '%s': %s", src, e)

        return intro_chunks

    def clear_collection(self):
        """Clears all records in the collection."""
        try:
            self._client.delete_collection(name=COLLECTION_NAME)
            self._collection = None
            _ = self.collection
            logger.info("Cleared ChromaDB collection '%s'", COLLECTION_NAME)
        except Exception as e:
            logger.error("Error clearing collection: %s", e)


# Singleton instance
vector_store_service = VectorStoreService()
