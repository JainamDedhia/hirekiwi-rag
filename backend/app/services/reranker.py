"""Reranker service implementing Hybrid Dense-Lexical Reciprocal Rank Fusion (RRF)."""

import logging
import re
from typing import List, Optional

from app.config import settings
from app.models.schemas import DocumentChunk

logger = logging.getLogger(__name__)


class RerankerService:
    """Reranks candidate document chunks using Hybrid Dense + BM25 Reciprocal Rank Fusion (RRF)."""

    def __init__(self):
        self.enabled = settings.RERANKING_ENABLED
        self.default_top_n = settings.RERANK_TOP_N
        self.rrf_k = 60  # Standard RRF constant

    def _tokenize(self, text: str) -> List[str]:
        """Simple whitespace and punctuation tokenizer for BM25."""
        return [w.lower() for w in re.findall(r"\b\w+\b", text) if len(w) > 1]

    def rerank(
        self,
        query: str,
        candidates: List[DocumentChunk],
        top_n: Optional[int] = None,
    ) -> List[DocumentChunk]:
        """Reranks candidate chunks by fusing dense semantic retrieval with BM25 lexical scoring.

        Args:
            query: The user query string.
            candidates: Initial candidate DocumentChunks retrieved via vector search.
            top_n: Number of top chunks to retain after reranking.

        Returns:
            Reranked list of DocumentChunks with updated scores and rerank metadata.
        """
        if not candidates or len(candidates) <= 1 or not self.enabled:
            limit = top_n or self.default_top_n
            return candidates[:limit]

        target_n = top_n or self.default_top_n
        query_tokens = self._tokenize(query)

        # 1. Dense ranking (already ordered by vector similarity)
        dense_ranks = {chunk.id: rank for rank, chunk in enumerate(candidates, 1)}

        # 2. Compute BM25 Lexical Scores
        bm25_ranks = {}
        try:
            from rank_bm25 import BM25Okapi

            tokenized_corpus = [self._tokenize(chunk.content) for chunk in candidates]
            bm25 = BM25Okapi(tokenized_corpus)
            bm25_scores = bm25.get_scores(query_tokens)

            # Sort candidate indices by BM25 score descending
            sorted_indices = sorted(range(len(candidates)), key=lambda i: bm25_scores[i], reverse=True)
            for bm_rank, idx in enumerate(sorted_indices, 1):
                bm25_ranks[candidates[idx].id] = bm_rank

        except Exception as e:
            logger.warning("BM25 reranker computation failed: %s. Using dense ranking order.", e)
            for rank, chunk in enumerate(candidates, 1):
                bm25_ranks[chunk.id] = rank

        # 3. Reciprocal Rank Fusion (RRF)
        # Score = 0.5 * (1 / (K + rank_dense)) + 0.5 * (1 / (K + rank_bm25))
        fused_scores = []
        for chunk in candidates:
            r_dense = dense_ranks.get(chunk.id, len(candidates))
            r_bm25 = bm25_ranks.get(chunk.id, len(candidates))

            rrf_score = (0.5 / (self.rrf_k + r_dense)) + (0.5 / (self.rrf_k + r_bm25))

            # Normalize to 0.0 - 1.0 range
            # Max possible RRF for rank 1 is 1.0 / (60 + 1) ~= 0.01639
            normalized_score = min(1.0, rrf_score / (1.0 / (self.rrf_k + 1)))

            # Clone chunk with updated metadata and score
            updated_meta = dict(chunk.metadata)
            updated_meta["dense_rank"] = r_dense
            updated_meta["bm25_rank"] = r_bm25
            updated_meta["rrf_score"] = round(rrf_score, 6)

            reranked_chunk = DocumentChunk(
                id=chunk.id,
                content=chunk.content,
                source=chunk.source,
                metadata=updated_meta,
                score=round(normalized_score, 4),
                relevance=chunk.relevance,
                grade_reason=chunk.grade_reason,
            )
            fused_scores.append((reranked_chunk, rrf_score))

        # 4. Sort descending by RRF score
        fused_scores.sort(key=lambda x: x[1], reverse=True)
        reranked_results = [item[0] for item in fused_scores[:target_n]]

        logger.info(
            "Reranked %d candidates to top %d chunks. Top chunk: %s (RRF: %s)",
            len(candidates),
            len(reranked_results),
            reranked_results[0].source if reranked_results else "None",
            reranked_results[0].metadata.get("rrf_score") if reranked_results else 0,
        )

        return reranked_results


# Singleton instance
reranker_service = RerankerService()
