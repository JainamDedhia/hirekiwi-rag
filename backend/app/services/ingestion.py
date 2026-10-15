"""Document ingestion service supporting PDF, Markdown, and TXT with chunking and deduplication."""

import hashlib
import logging
import os
import re
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.config import settings
from app.models.schemas import DocumentChunk, IngestResponse
from app.services.vector_store import vector_store_service

logger = logging.getLogger(__name__)


class IngestionService:
    """Handles parsing, chunking, and vector indexing of PDF, Markdown, and Text documents."""

    def __init__(self):
        self.chunk_size = settings.CHUNK_SIZE
        self.chunk_overlap = settings.CHUNK_OVERLAP

    def _clean_text(self, text: str) -> str:
        """Cleans and normalizes unicode text from PDF/markdown extractions."""
        if not text:
            return ""
        # Normalize mathematical symbols and whitespace
        text = text.replace("\u2212", "-").replace("\u00a0", " ")
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    def _parse_pdf(self, file_path: Path) -> List[DocumentChunk]:
        """Extracts text from PDF documents page-by-page and splits into searchable chunks."""
        chunks: List[DocumentChunk] = []
        filename = file_path.name
        total_pages = 0

        # Attempt extraction using PyMuPDF (fitz)
        try:
            import pymupdf

            doc = pymupdf.open(str(file_path))
            total_pages = len(doc)

            for page_idx in range(total_pages):
                page_num = page_idx + 1
                page = doc[page_idx]
                raw_text = page.get_text()
                clean_text = self._clean_text(raw_text)

                if len(clean_text) < 30:
                    continue

                # Split page text into overlapping chunks
                sub_chunks = self._chunk_text(clean_text, self.chunk_size, self.chunk_overlap)
                for chunk_idx, sub_text in enumerate(sub_chunks):
                    if len(sub_text.strip()) < 20:
                        continue

                    # Prepend grounding citation header
                    full_chunk_text = f"[{filename} | Page {page_num}]\n{sub_text.strip()}"
                    chunk_hash = hashlib.md5(full_chunk_text.encode("utf-8")).hexdigest()[:10]
                    chunk_id = f"{filename}_p{page_num}_{chunk_idx}_{chunk_hash}"

                    chunk = DocumentChunk(
                        id=chunk_id,
                        content=full_chunk_text,
                        source=filename,
                        metadata={
                            "source": filename,
                            "file_type": "pdf",
                            "page_number": page_num,
                            "total_pages": total_pages,
                            "chunk_index": chunk_idx,
                            "char_length": len(full_chunk_text),
                        },
                    )
                    chunks.append(chunk)

            doc.close()
            logger.info("Parsed PDF %s via PyMuPDF: %d chunks across %d pages", filename, len(chunks), total_pages)
            return chunks

        except Exception as e:
            logger.warning("PyMuPDF parsing failed for %s (%s). Attempting pypdf fallback.", filename, e)

        # Fallback extraction using pypdf
        try:
            import pypdf

            reader = pypdf.PdfReader(str(file_path))
            total_pages = len(reader.pages)

            for page_idx, page in enumerate(reader.pages):
                page_num = page_idx + 1
                raw_text = page.extract_text() or ""
                clean_text = self._clean_text(raw_text)

                if len(clean_text) < 30:
                    continue

                sub_chunks = self._chunk_text(clean_text, self.chunk_size, self.chunk_overlap)
                for chunk_idx, sub_text in enumerate(sub_chunks):
                    if len(sub_text.strip()) < 20:
                        continue

                    full_chunk_text = f"[{filename} | Page {page_num}]\n{sub_text.strip()}"
                    chunk_hash = hashlib.md5(full_chunk_text.encode("utf-8")).hexdigest()[:10]
                    chunk_id = f"{filename}_p{page_num}_{chunk_idx}_{chunk_hash}"

                    chunk = DocumentChunk(
                        id=chunk_id,
                        content=full_chunk_text,
                        source=filename,
                        metadata={
                            "source": filename,
                            "file_type": "pdf",
                            "page_number": page_num,
                            "total_pages": total_pages,
                            "chunk_index": chunk_idx,
                            "char_length": len(full_chunk_text),
                        },
                    )
                    chunks.append(chunk)

            logger.info("Parsed PDF %s via pypdf fallback: %d chunks across %d pages", filename, len(chunks), total_pages)
            return chunks

        except Exception as ex:
            logger.error("All PDF extraction methods failed for %s: %s", filename, ex)
            return []

    def _split_markdown_sections(self, content: str, filename: str) -> List[DocumentChunk]:
        """Splits markdown into logical chunks preserving section headers and hierarchy."""
        chunks: List[DocumentChunk] = []
        header_pattern = re.compile(r"^(#{1,3}\s+.+)$", re.MULTILINE)
        parts = header_pattern.split(content)

        current_section = "General"
        i = 0
        while i < len(parts):
            part = parts[i].strip()
            if not part:
                i += 1
                continue

            if part.startswith("#"):
                current_section = part.lstrip("#").strip()
                i += 1
                continue

            body = part
            i += 1

            sub_chunks = self._chunk_text(body, self.chunk_size, self.chunk_overlap)
            for idx, text in enumerate(sub_chunks):
                if len(text.strip()) < 20:
                    continue

                full_chunk_text = f"[{filename} > {current_section}]\n{text.strip()}"
                chunk_hash = hashlib.md5(full_chunk_text.encode("utf-8")).hexdigest()[:10]
                chunk_id = f"{filename}_{current_section.replace(' ', '_')[:20]}_{idx}_{chunk_hash}"

                chunk = DocumentChunk(
                    id=chunk_id,
                    content=full_chunk_text,
                    source=filename,
                    metadata={
                        "source": filename,
                        "file_type": "markdown",
                        "section": current_section,
                        "chunk_index": idx,
                        "char_length": len(full_chunk_text),
                    },
                )
                chunks.append(chunk)

        # Fallback if no markdown headers were found
        if not chunks and content.strip():
            raw_chunks = self._chunk_text(content, self.chunk_size, self.chunk_overlap)
            for idx, text in enumerate(raw_chunks):
                chunk_hash = hashlib.md5(text.encode("utf-8")).hexdigest()[:10]
                chunk_id = f"{filename}_chunk_{idx}_{chunk_hash}"
                chunks.append(
                    DocumentChunk(
                        id=chunk_id,
                        content=text,
                        source=filename,
                        metadata={
                            "source": filename,
                            "file_type": "text",
                            "section": "General",
                            "chunk_index": idx,
                            "char_length": len(text),
                        },
                    )
                )

        return chunks

    def _chunk_text(self, text: str, chunk_size: int, chunk_overlap: int) -> List[str]:
        """Splits arbitrary text into overlapping chunks respecting sentence/paragraph boundaries."""
        raw_paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

        units: List[str] = []
        for p in raw_paragraphs:
            if len(p) <= chunk_size:
                units.append(p)
            else:
                sentences = re.split(r"(?<=[.!?])\s+", p)
                current_sent_group = []
                current_len = 0
                for s in sentences:
                    if current_len + len(s) > chunk_size and current_sent_group:
                        units.append(" ".join(current_sent_group))
                        current_sent_group = [s]
                        current_len = len(s)
                    else:
                        current_sent_group.append(s)
                        current_len += len(s) + 1
                if current_sent_group:
                    units.append(" ".join(current_sent_group))

        chunks: List[str] = []
        current_chunk: List[str] = []
        current_length = 0

        for unit in units:
            unit = unit.strip()
            if not unit:
                continue

            if current_length + len(unit) > chunk_size and current_chunk:
                chunks.append("\n\n".join(current_chunk))
                last_unit = current_chunk[-1]
                overlap_text = (
                    last_unit if len(last_unit) <= chunk_overlap else last_unit[-chunk_overlap:]
                )
                current_chunk = [overlap_text, unit]
                current_length = len(overlap_text) + len(unit)
            else:
                current_chunk.append(unit)
                current_length += len(unit)

        if current_chunk:
            chunks.append("\n\n".join(current_chunk))

        # Fallback for continuous text without sentence/paragraph breaks
        if len(chunks) <= 1 and len(text) > chunk_size:
            chunks = []
            start = 0
            while start < len(text):
                end = min(start + chunk_size, len(text))
                chunks.append(text[start:end])
                if end == len(text):
                    break
                start += max(1, chunk_size - chunk_overlap)

        return chunks

    def ingest_file(self, file_path: Path) -> List[DocumentChunk]:
        """Ingests a single PDF, Markdown, or TXT file into ChromaDB."""
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        filename = file_path.name
        suffix = file_path.suffix.lower()

        if suffix == ".pdf":
            chunks = self._parse_pdf(file_path)
        else:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            chunks = self._split_markdown_sections(content, filename)

        if chunks:
            vector_store_service.add_documents(chunks)
        return chunks

    def discover_documents(self) -> List[Path]:
        """Finds all supported documents in data/ and sample_documents/ directories."""
        supported_extensions = {".pdf", ".md", ".markdown", ".txt"}
        candidate_dirs = [
            Path(settings.DATA_DIR),
            Path(settings.SAMPLE_DOCS_DIR),
        ]

        found_files: Dict[str, Path] = {}
        for d in candidate_dirs:
            if d.exists() and d.is_dir():
                for f in d.iterdir():
                    if f.is_file() and f.suffix.lower() in supported_extensions:
                        if f.name not in found_files:
                            found_files[f.name] = f

        return [found_files[k] for k in sorted(found_files.keys())]

    def ingest_directory(
        self, dir_path: Optional[Path] = None, force_reload: bool = False
    ) -> IngestResponse:
        """Ingests all supported documents from the specified directory or data directories."""
        start_time = time.time()

        if force_reload:
            logger.info("Force reload requested: Clearing existing vector index.")
            vector_store_service.clear_collection()

        if dir_path:
            if not dir_path.exists():
                raise FileNotFoundError(f"Directory not found: {dir_path}")
            supported_extensions = {".pdf", ".md", ".markdown", ".txt"}
            files = [
                f for f in dir_path.iterdir() if f.is_file() and f.suffix.lower() in supported_extensions
            ]
        else:
            files = self.discover_documents()

        all_chunks: List[DocumentChunk] = []
        processed_files: List[str] = []

        for file_path in sorted(files):
            try:
                chunks = self.ingest_file(file_path)
                all_chunks.extend(chunks)
                processed_files.append(file_path.name)
                logger.info("Successfully ingested %s (%d chunks)", file_path.name, len(chunks))
            except Exception as e:
                logger.error("Failed to ingest %s: %s", file_path.name, e)

        duration = (time.time() - start_time) * 1000.0

        return IngestResponse(
            status="success",
            documents_processed=len(processed_files),
            total_chunks=len(all_chunks),
            sources=processed_files,
            duration_ms=round(duration, 2),
        )

    def ingest_sample_documents(self, force_reload: bool = False) -> IngestResponse:
        """Ingests all discoverable PDF and markdown documents if collection is empty, forced, or missing newly added files."""
        stats = vector_store_service.get_collection_stats()
        indexed = set(stats["indexed_documents"])
        discoverable = self.discover_documents()
        missing = [f for f in discoverable if f.name not in indexed]

        if not force_reload and stats["total_chunks"] > 0 and not missing:
            logger.info(
                "ChromaDB already contains %d chunks and all %d discoverable documents are indexed.",
                stats["total_chunks"],
                len(discoverable),
            )
            return IngestResponse(
                status="skipped",
                documents_processed=len(stats["indexed_documents"]),
                total_chunks=stats["total_chunks"],
                sources=stats["indexed_documents"],
                duration_ms=0.0,
            )

        if force_reload:
            return self.ingest_directory(dir_path=None, force_reload=True)

        # Ingest missing files into existing index
        start_time = time.time()
        new_chunks: List[DocumentChunk] = []
        new_processed: List[str] = []
        for file_path in missing:
            try:
                chunks = self.ingest_file(file_path)
                new_chunks.extend(chunks)
                new_processed.append(file_path.name)
                logger.info("Ingested missing document %s (%d chunks)", file_path.name, len(chunks))
            except Exception as e:
                logger.error("Failed to ingest missing document %s: %s", file_path.name, e)

        duration = (time.time() - start_time) * 1000.0
        latest_stats = vector_store_service.get_collection_stats()
        return IngestResponse(
            status="success",
            documents_processed=len(new_processed),
            total_chunks=latest_stats["total_chunks"],
            sources=latest_stats["indexed_documents"],
            duration_ms=round(duration, 2),
        )

    def get_document_catalog(self) -> List[Dict[str, Any]]:
        """Returns detailed metadata about all documents currently indexed or discoverable."""
        docs = self.discover_documents()
        catalog = []

        for f in docs:
            file_type = "pdf" if f.suffix.lower() == ".pdf" else "markdown"
            pages = None
            if file_type == "pdf":
                try:
                    import pymupdf
                    d = pymupdf.open(str(f))
                    pages = len(d)
                    d.close()
                except Exception:
                    pass

            size_kb = round(f.stat().st_size / 1024, 1)

            # Assign topic / chapter category
            category = "User Document"
            if "linear_equation" in f.name.lower():
                category = "Mathematics (Std 10, Ch 1)"
            elif "field_visit" in f.name.lower():
                category = "Geography (Std 10, Ch 1)"
            elif "historiography" in f.name.lower():
                category = "History (Std 10, Ch 1)"
            elif "engineering_handbook" in f.name.lower():
                category = "Engineering Guidelines"
            elif "cloud_security" in f.name.lower():
                category = "Security & Compliance"

            catalog.append({
                "name": f.name,
                "type": file_type,
                "category": category,
                "size_kb": size_kb,
                "pages": pages,
                "path": str(f),
            })

        return catalog


# Singleton instance
ingestion_service = IngestionService()
