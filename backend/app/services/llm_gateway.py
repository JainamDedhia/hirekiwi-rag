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
        """Uses the LLM to understand query intent, handle conversational messages, and plan search queries.

        Returns:
            {
                "action": "conversational" | "search_documents",
                "conversational_response": str or None,
                "search_reasoning": str,
                "search_queries": [str],
                "is_overview_request": bool,
            }
        """
        if self._llm:
            try:
                from langchain_core.messages import HumanMessage, SystemMessage

                doc_context_str = ""
                if selected_documents:
                    doc_context_str = f"Selected Document(s): {', '.join(selected_documents)}\n"
                else:
                    doc_context_str = "Selected Document(s): All Documents\n"

                history_str = ""
                if chat_history and len(chat_history) > 0:
                    recent = [
                        f"{turn.get('role', 'user')}: {turn.get('content', '')}"
                        for turn in chat_history[-3:]
                    ]
                    history_str = "Conversation Context:\n" + "\n".join(recent) + "\n"

                prompt = (
                    "You are an expert AI Knowledge Assistant and Intelligent Search Planner.\n"
                    "You have access to an internal knowledge base of documents.\n\n"
                    "Analyze the user's message, conversation context, and selected documents to determine the appropriate action:\n\n"
                    "1. 'conversational': Use this if the user is greeting (e.g. 'hi', 'hello', 'hey'), thanking you, asking who you are, what you can do, or engaging in small talk.\n"
                    "   - In 'conversational_response', provide a warm, helpful response introducing yourself as the HireKiwi AI Knowledge Assistant and inviting them to explore or ask questions about the loaded documents.\n"
                    "   - Set 'search_queries' to [].\n\n"
                    "2. 'search_documents': Use this if the user is asking about any subject, requesting a document summary/overview, asking factual questions, math/technical problems, or looking for specific info in the documents.\n"
                    "   - In 'search_reasoning', clearly explain what specific knowledge or evidence needs to be retrieved from the documents.\n"
                    "   - In 'search_queries', formulate 1 to 3 targeted search query strings optimized for semantic vector retrieval and BM25 search.\n"
                    "   - Set 'is_overview_request' to true if the user wants an overview/summary of the document, false otherwise.\n\n"
                    "Output strictly a JSON object with keys:\n"
                    "{\n"
                    "  'action': 'conversational' | 'search_documents',\n"
                    "  'conversational_response': '...' (or null),\n"
                    "  'search_reasoning': '...',\n"
                    "  'search_queries': ['query 1', 'query 2'],\n"
                    "  'is_overview_request': true | false\n"
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
                    action = data.get("action", "search_documents")
                    search_queries = data.get("search_queries", [])
                    if action == "search_documents" and (not isinstance(search_queries, list) or len(search_queries) == 0):
                        search_queries = [query]
                    return {
                        "action": action,
                        "conversational_response": data.get("conversational_response"),
                        "search_reasoning": str(data.get("search_reasoning", "")),
                        "search_queries": search_queries,
                        "is_overview_request": bool(data.get("is_overview_request", False)),
                    }
            except Exception as e:
                logger.warning("LLM query understanding error: %s. Using heuristic planner.", e)

        # Fallback if LLM offline
        q_clean = query.strip().lower()
        if len(q_clean.split()) <= 2 and q_clean in {"hi", "hello", "hey", "hola", "greetings", "good morning", "good evening", "help"}:
            return {
                "action": "conversational",
                "conversational_response": "Hello! I am your AI Knowledge Assistant. How can I help you today? You can select any document above and ask me questions or request an overview.",
                "search_reasoning": "",
                "search_queries": [],
                "is_overview_request": False,
            }

        return {
            "action": "search_documents",
            "conversational_response": None,
            "search_reasoning": "Searching corpus for relevant information matching user query",
            "search_queries": [query],
            "is_overview_request": False,
        }

    def grade_document_relevance(
        self,
        query: str,
        document_content: str,
        source: str = "",
        is_overview_query: bool = False,
        search_reasoning: str = "",
    ) -> Tuple[bool, str]:
        """Grades whether a document chunk is relevant to the user query.

        Returns (is_relevant: bool, reason: str).
        """
        if self._llm:
            try:
                from langchain_core.messages import HumanMessage, SystemMessage

                system_prompt = (
                    "You are an evaluation grader assessing relevance of a retrieved document to a user query and search intent.\n"
                    "Grade 'yes' if the document contains facts, concepts, definitions, or introductory context "
                    "relevant to answering the user inquiry. Grade 'no' only if it is completely off-topic.\n"
                    "Output JSON strictly with keys: 'relevant' (boolean: true/false) and 'reason' (string explaining evaluation)."
                )
                reasoning_context = f"Search Reasoning: {search_reasoning}\n" if search_reasoning else ""
                user_prompt = f"{reasoning_context}User Query: {query}\n\nDocument Chunk ({source}):\n{document_content}\n\nJSON output:"

                response = self._llm.invoke(
                    [
                        SystemMessage(content=system_prompt),
                        HumanMessage(content=user_prompt),
                    ]
                )
                content = response.content.strip()

                json_match = re.search(r"\{.*?\}", content, re.DOTALL)
                if json_match:
                    data = json.loads(json_match.group(0))
                    is_rel = bool(data.get("relevant", False))
                    reason = str(data.get("reason", "Graded via LLM evaluator"))
                    return is_rel, reason
            except Exception as ex:
                logger.warning("LLM grading call failed (%s). Falling back to heuristic evaluator.", ex)

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
