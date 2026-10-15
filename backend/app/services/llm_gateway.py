"""LLM Gateway service providing unified abstraction for OpenAI, Groq, and Mock inference."""

import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from app.config import settings
from app.models.schemas import DocumentChunk, WebSearchResult

logger = logging.getLogger(__name__)


class LLMGateway:
    """Manages LLM invocation for Document Grading, Query Rewriting, and Generation."""

    def __init__(self):
        self._llm = None
        self._init_llm()

    def _init_llm(self):
        """Initializes the active LLM client based on configuration."""
        if settings.is_mock_llm:
            logger.info("Operating in MOCK/OFFLINE LLM mode for local zero-cost evaluation.")
            self._llm = None
            return

        try:
            if settings.LLM_PROVIDER == "openai" and settings.OPENAI_API_KEY:
                from langchain_openai import ChatOpenAI

                self._llm = ChatOpenAI(
                    model=settings.LLM_MODEL,
                    temperature=settings.LLM_TEMPERATURE,
                    max_tokens=settings.LLM_MAX_TOKENS,
                    api_key=settings.OPENAI_API_KEY,
                )
                logger.info("Initialized OpenAI LLM (%s)", settings.LLM_MODEL)
            elif settings.LLM_PROVIDER == "groq" and settings.GROQ_API_KEY:
                from langchain_openai import ChatOpenAI

                self._llm = ChatOpenAI(
                    model=settings.GROQ_MODEL,
                    base_url="https://api.groq.com/openai/v1",
                    api_key=settings.GROQ_API_KEY.strip("\"'"),
                    temperature=settings.LLM_TEMPERATURE,
                )
                logger.info("Initialized Groq LLM (%s)", settings.GROQ_MODEL)
            else:
                logger.warning(
                    "Configured provider '%s' missing API key. Falling back to offline engine.",
                    settings.LLM_PROVIDER,
                )
                self._llm = None
        except Exception as e:
            logger.error("Failed to initialize LLM provider: %s. Using offline fallback.", e)
            self._llm = None

    def understand_user_query(
        self,
        query: str,
        selected_documents: Optional[List[str]] = None,
        chat_history: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """Analyzes user intent, resolves coreferences, and generates targeted search queries.

        Returns:
            {
                "intent": "document_overview" | "specific_query" | "external_search",
                "search_queries": [str],
                "explanation": str,
                "fetch_introductory_chunks": bool,
            }
        """
        is_overview_phrase = any(
            p in query.lower()
            for p in [
                "what is the document about",
                "what is this document about",
                "what is this pdf about",
                "what is the pdf about",
                "what is the chapter about",
                "what is this chapter about",
                "tell me about this document",
                "tell me about this pdf",
                "summary of",
                "summarize",
                "overview of",
                "what does this cover",
                "what does this talk about",
                "what are the contents",
                "what is in this document",
                "what is in this pdf",
                "explain this document",
                "about the document",
            ]
        )

        if self._llm:
            try:
                from langchain_core.messages import HumanMessage, SystemMessage

                doc_context_str = ""
                if selected_documents:
                    doc_context_str = f"Selected Document(s): {', '.join(selected_documents)}\n"

                history_str = ""
                if chat_history and len(chat_history) > 0:
                    recent = [
                        f"{turn.get('role', 'user')}: {turn.get('content', '')}"
                        for turn in chat_history[-3:]
                    ]
                    history_str = "Conversation Context:\n" + "\n".join(recent) + "\n"

                prompt = (
                    "You are an expert AI Query Analyzer and Search Planner for a Corrective RAG system.\n"
                    "Analyze the user's question, conversation context, and selected documents.\n\n"
                    "TASKS:\n"
                    "1. Classify intent into one of:\n"
                    "   - 'document_overview': The user wants a summary, high-level overview, topic list, or wants to know what the document/chapter is about.\n"
                    "   - 'specific_query': The user is asking a specific factual, procedural, mathematical, or technical question.\n"
                    "   - 'external_search': The user is asking for real-time external info (e.g. current weather, stock prices, external news).\n"
                    "2. Generate 1 to 3 targeted search query strings optimized for semantic vector retrieval and BM25 search.\n"
                    "   If 'document_overview', generate queries that target the introduction, title, preface, objectives, and main topics of the selected document.\n"
                    "   If conversational references exist (e.g., 'what else', 'why did they do that?'), resolve them into explicit search keywords.\n"
                    "3. Set 'fetch_introductory_chunks': true if the user wants an overview/summary of the document, false otherwise.\n\n"
                    "Output JSON strictly with keys:\n"
                    "{\n"
                    "  'intent': 'document_overview' | 'specific_query' | 'external_search',\n"
                    "  'search_queries': ['query 1', 'query 2'],\n"
                    "  'explanation': 'Brief 1-sentence rationale',\n"
                    "  'fetch_introductory_chunks': true/false\n"
                    "}"
                )

                user_msg = f"{doc_context_str}{history_str}User Question: {query}\n\nJSON output:"
                resp = self._llm.invoke(
                    [
                        SystemMessage(content=prompt),
                        HumanMessage(content=user_msg),
                    ]
                )
                raw_json = resp.content.strip()
                json_match = re.search(r"\{.*\}", raw_json, re.DOTALL)
                if json_match:
                    data = json.loads(json_match.group(0))
                    queries = data.get("search_queries", [])
                    if not isinstance(queries, list) or len(queries) == 0:
                        queries = [query]
                    return {
                        "intent": data.get(
                            "intent",
                            "document_overview" if is_overview_phrase else "specific_query",
                        ),
                        "search_queries": queries,
                        "explanation": str(
                            data.get("explanation", "Extracted intent and search keywords")
                        ),
                        "fetch_introductory_chunks": bool(
                            data.get("fetch_introductory_chunks", is_overview_phrase)
                        ),
                    }
            except Exception as e:
                logger.warning("LLM query understanding error: %s. Using heuristic planner.", e)

        # Robust Heuristic Fallback
        if is_overview_phrase:
            queries = [query]
            if selected_documents:
                for doc in selected_documents:
                    clean = re.sub(
                        r"^(chapter_\d+_|\.pdf|\.md|\.txt)", "", doc, flags=re.IGNORECASE
                    ).replace("_", " ")
                    queries.append(f"{clean} introduction overview preface objectives")
            return {
                "intent": "document_overview",
                "search_queries": queries,
                "explanation": "Identified high-level document overview / summary request",
                "fetch_introductory_chunks": True,
            }

        return {
            "intent": "specific_query",
            "search_queries": [query],
            "explanation": "Identified specific information retrieval query",
            "fetch_introductory_chunks": False,
        }

    def grade_document_relevance(
        self,
        query: str,
        document_content: str,
        source: str = "",
        is_overview_query: bool = False,
    ) -> Tuple[bool, str]:
        """Grades whether a document chunk is relevant to the user query.

        Returns (is_relevant: bool, reason: str).
        """
        # If this is a document overview request, introductory/structural chunks of the selected doc are directly relevant
        if is_overview_query:
            c_low = document_content.lower()
            overview_keywords = [
                "preface",
                "introduction",
                "chapter",
                "standard",
                "class ten",
                "class 10",
                "welcome",
                "textbook",
                "study",
                "geography",
                "history",
                "mathematics",
                "equation",
                "field visit",
            ]
            if any(k in c_low for k in overview_keywords) or len(document_content) > 100:
                return True, "Chunk provides structural context or content for document overview."

        if self._llm:
            try:
                from langchain_core.messages import HumanMessage, SystemMessage

                system_prompt = (
                    "You are a strict evaluation grader assessing relevance of a retrieved document to a user query.\n"
                    "Grade 'yes' if the document contains semantic keywords, principles, facts, or introductory context "
                    "directly relevant to answering the query. Grade 'no' if it is off-topic.\n"
                    "Output JSON strictly with keys: 'relevant' (boolean: true/false) and 'reason' (string explaining evaluation)."
                )
                user_prompt = f"User Query: {query}\n\nDocument Chunk ({source}):\n{document_content}\n\nJSON output:"

                response = self._llm.invoke(
                    [
                        SystemMessage(content=system_prompt),
                        HumanMessage(content=user_prompt),
                    ]
                )
                content = response.content.strip()

                # Extract JSON if wrapped in markdown fences
                json_match = re.search(r"\{.*?\}", content, re.DOTALL)
                if json_match:
                    data = json.loads(json_match.group(0))
                    is_rel = bool(data.get("relevant", False))
                    reason = str(data.get("reason", "Graded via LLM evaluator"))
                    return is_rel, reason
            except Exception as ex:
                logger.warning("LLM grading call failed (%s). Falling back to heuristic evaluator.", ex)

        # Robust Heuristic Grader (for mock mode and network fallbacks)
        return self._heuristic_grade_relevance(
            query, document_content, source, is_overview_query=is_overview_query
        )

    def _heuristic_grade_relevance(
        self,
        query: str,
        content: str,
        source: str = "",
        is_overview_query: bool = False,
    ) -> Tuple[bool, str]:
        """Deterministic evaluation grader assessing term and semantic relevance."""
        if is_overview_query:
            return True, "Introductory and overview content matching document summary request."

        q_lower = query.lower()
        c_lower = content.lower()

        # Stop words to filter out
        stopwords = {
            "what",
            "is",
            "the",
            "are",
            "of",
            "and",
            "to",
            "in",
            "for",
            "on",
            "a",
            "an",
            "how",
            "do",
            "does",
            "we",
            "our",
            "hirekiwi",
            "hirekiwi's",
            "about",
            "with",
            "by",
            "at",
            "from",
            "as",
            "can",
            "should",
        }

        # Tokenize query
        q_tokens = [w.strip("?,.:;\"'()[]") for w in q_lower.split() if len(w) > 2]
        significant_tokens = [w for w in q_tokens if w not in stopwords]

        if not significant_tokens:
            return True, "Query contains general terms matching corpus content."

        # Key phrases / specialized topics matching
        key_matches = [w for w in significant_tokens if w in c_lower]
        match_ratio = len(key_matches) / len(significant_tokens)

        # Check for phrase overlap
        phrase_hit = any(
            len(phrase) > 4 and phrase in c_lower
            for phrase in [
                "sev-1",
                "on-call",
                "soc 2",
                "encryption",
                "kms",
                "pull request",
                "branching",
                "zero trust",
                "vulnerability",
                "remediation",
                "slo",
                "uptime",
                "argo cd",
                "trivy",
                "snyk",
                "falco",
                "rollback",
                "kubernetes",
                "deployment",
            ]
            if phrase in q_lower
        )

        # Out-of-Domain Detection (External queries e.g. Python 3.12, LangGraph 0.1, React 19)
        ood_markers = [
            "python 3.12",
            "python 3.13",
            "kubernetes 1.30",
            "react 19",
            "today's weather",
            "stock price",
            "capital of",
            "who won",
            "latest features in",
        ]
        is_explicit_ood = any(marker in q_lower for marker in ood_markers)

        if is_explicit_ood and match_ratio < 0.3:
            return (
                False,
                f"Query targets external/out-of-domain knowledge ({', '.join([m for m in ood_markers if m in q_lower]) or 'external tech'}). Retrieved internal documents lack coverage.",
            )

        if phrase_hit or match_ratio >= 0.35:
            matched_terms = ", ".join(key_matches[:4]) if key_matches else "relevant domain keywords"
            return (
                True,
                f"Chunk contains key query concepts ({matched_terms}) aligned with document context.",
            )

        return (
            False,
            f"Retrieved chunk did not sufficiently match query terms (only matched {len(key_matches)}/{len(significant_tokens)} significant words).",
        )

    def transform_query_for_search(self, query: str) -> str:
        """Rewrites the query to optimize for web search engine retrieval."""
        if self._llm:
            try:
                from langchain_core.messages import HumanMessage, SystemMessage

                system_prompt = (
                    "You are an expert search query optimizer. Given a user question that failed internal retrieval, "
                    "re-write it into a concise, high-precision search query for a web search engine. "
                    "Do NOT include conversational filler, quotes, or punctuation. Output only the search query string."
                )
                response = self._llm.invoke(
                    [
                        SystemMessage(content=system_prompt),
                        HumanMessage(content=query),
                    ]
                )
                rewritten = response.content.strip().replace('"', "").replace("\n", " ")
                if len(rewritten) > 3:
                    return rewritten
            except Exception as ex:
                logger.warning("LLM query rewrite failed (%s). Using rule-based transform.", ex)

        # Heuristic query transformation
        cleaned = re.sub(
            r"^(what is|what are|how to|tell me about|explain|can you describe|what does)\s+",
            "",
            query,
            flags=re.IGNORECASE,
        ).strip(" ?.")
        return f"{cleaned} official documentation overview"

    def generate_rag_answer(
        self,
        query: str,
        documents: List[DocumentChunk],
        web_results: List[WebSearchResult],
        chat_history: Optional[List[Dict[str, str]]] = None,
    ) -> Tuple[str, float]:
        """Synthesizes the final grounded answer and confidence score, with conversational memory."""
        if self._llm:
            try:
                from langchain_core.messages import HumanMessage, SystemMessage

                doc_contexts = []
                for i, doc in enumerate(documents, 1):
                    doc_contexts.append(
                        f"[Document {i} - {doc.source}]:\n{doc.content}"
                    )
                docs_text = "\n\n".join(doc_contexts)

                web_contexts = []
                for i, web in enumerate(web_results, 1):
                    web_contexts.append(
                        f"[Web Source {i} - {web.title} ({web.url})]:\n{web.snippet}"
                    )
                web_text = "\n\n".join(web_contexts)

                history_context = ""
                if chat_history and len(chat_history) > 0:
                    turns = []
                    for turn in chat_history[-6:]:
                        role = "User" if turn.get("role") == "user" else "Assistant"
                        turns.append(f"{role}: {turn.get('content', '')}")
                    history_context = "--- CONVERSATION CONTEXT ---\n" + "\n".join(turns) + "\n\n"

                system_prompt = (
                    "You are a strict, production-grade AI Knowledge Assistant pair-programming with the user. "
                    "Your primary goal is to answer the user's questions clearly, accurately, and thoroughly, grounded strictly in the provided internal documents and web search results.\n\n"
                    "CRITICAL GROUNDING AND CITATION RULES:\n"
                    "1. Grounding: Answer strictly using facts and content stated in the provided context. Do NOT invent, assume, or extrapolate facts.\n"
                    "2. Document Overviews & Summaries: If the user asks what the document is about, summarize the chapter/document, or asks about its scope, synthesize a clear, structured overview highlighting its title, objectives, major topics, and observations directly from the retrieved text.\n"
                    "3. Evidence: You MUST cite the source document name and page number or section in square brackets for every fact or claim (e.g. [chapter_01_Field_Visit.pdf | Page 8] or [engineering_handbook.md > On-Call Operations]).\n"
                    "4. Direct Excerpts: Include exact or near-exact excerpts from the documents as evidence to demonstrate trust.\n"
                    "5. Missing Information / Unanswerable Questions: If the documents do not contain enough information to answer the question, or if the question is off-topic/unanswerable from the provided material, you MUST state explicitly:\n"
                    "'The requested information is unavailable in the provided documents.'\n"
                    "Do NOT attempt to guess or answer with unverified external knowledge unless external web results are explicitly provided in the context."
                )

                user_prompt = (
                    f"{history_context}"
                    f"Current User Question: {query}\n\n"
                    f"--- RETRIEVED INTERNAL DOCUMENTS ---\n{docs_text or 'None'}\n\n"
                    f"--- EXTERNAL SEARCH RESULTS ---\n{web_text or 'None'}\n\n"
                    "Provide your grounded, cited answer (or indicate unavailability):"
                )

                response = self._llm.invoke(
                    [
                        SystemMessage(content=system_prompt),
                        HumanMessage(content=user_prompt),
                    ]
                )
                answer = response.content.strip()

                # Calculate confidence based on available evidence
                confidence = 0.95 if documents and not web_results else (0.85 if documents and web_results else (0.75 if web_results else 0.0))
                return answer, confidence
            except Exception as ex:
                logger.warning("LLM generation failed (%s). Using synthesized generator.", ex)

        # High-Quality Synthesized Answer Generator
        return self._synthesize_answer(query, documents, web_results)

    def _synthesize_answer(
        self,
        query: str,
        documents: List[DocumentChunk],
        web_results: List[WebSearchResult],
    ) -> Tuple[str, float]:
        """Synthesizes a structured answer citing internal docs or web results."""
        sections = []

        if documents:
            sections.append(f"### Answer Summary\nBased on verified retrieved documents, here is the grounded answer regarding **{query}**:\n")

            for doc in documents:
                source_name = doc.source
                page_info = f" | Page {doc.metadata.get('page_number')}" if doc.metadata.get("page_number") else ""
                section_info = f" > {doc.metadata.get('section')}" if doc.metadata.get("section") and doc.metadata.get("section") != "General" else ""
                citation_label = f"{source_name}{page_info}{section_info}"

                # Extract clean key points from content
                lines = [line.strip() for line in doc.content.split("\n") if line.strip() and not line.startswith("[")]
                clean_excerpt = "\n".join(f"> {line}" for line in lines[:5])
                sections.append(f"#### Evidence from [{citation_label}]\n{clean_excerpt}\n")

            confidence = 0.95
        elif web_results:
            sections.append(
                f"### Corrective Search Retrieval Summary\n"
                f"*Note: Internal documents did not contain direct answers for this external topic. "
                f"The CRAG state machine automatically triggered a corrective web search.* \n\n"
                f"Here is the verified information gathered from external sources:\n"
            )

            for res in web_results:
                sections.append(f"- **[{res.title}]({res.url})**:\n  {res.snippet}\n")

            confidence = 0.82
        else:
            sections.append(
                "The requested information is unavailable in the provided documents."
            )
            confidence = 0.0

        full_answer = "\n".join(sections)
        return full_answer, confidence

    def grade_hallucination(self, documents: List[str], answer: str) -> Tuple[bool, str]:
        """Assesses if generated answer is grounded in provided documents."""
        if not documents:
            return True, "No documents to ground against (web search or empty)."
        doc_aggregate = " ".join(documents).lower()
        ans_lower = answer.lower()

        # Check key terms in answer against doc aggregate
        ans_words = set(re.findall(r"\b[a-zA-Z]{4,}\b", ans_lower))
        grounded_count = sum(1 for w in ans_words if w in doc_aggregate)
        ratio = grounded_count / max(len(ans_words), 1)

        is_grounded = ratio >= 0.40
        reason = f"Answer grounding ratio is {ratio:.2f} across reference text."
        return is_grounded, reason


# Singleton instance
llm_gateway = LLMGateway()
