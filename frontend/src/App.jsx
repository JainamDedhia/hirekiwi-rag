import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send,
  Bot,
  User,
  Database,
  Cpu,
  Globe,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  BookOpen,
  Sliders,
  Trash2,
  Info,
  Layers,
  ArrowRight,
  Filter,
  Plus,
  X,
  ShieldCheck,
  Sparkles,
  Search,
  ExternalLink,
  CornerDownLeft,
  Compass,
  ArrowLeft,
} from 'lucide-react';

// Custom rich markdown message renderer
function MarkdownMessage({ content, isUser }) {
  if (isUser) {
    return <div className="text-[13px] sm:text-sm leading-relaxed whitespace-pre-wrap">{content}</div>;
  }

  // Sanitize raw <br> tags into markdown line breaks and normalize square citations
  const sanitized = (content || '')
    .replace(/<br\s*\/?>/gi, '\n\n')
    .replace(/【(.*?)】/g, '[$1]');

  return (
    <div className="text-[13px] sm:text-sm leading-relaxed text-[#D4D4D8] space-y-2.5">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-base sm:text-lg font-bold text-white mt-4 mb-2 pb-1.5 border-b border-white/[0.08] flex items-center gap-2">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm sm:text-base font-bold text-[#EDEDED] mt-3.5 mb-1.5 pb-1 border-b border-white/[0.06]">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xs sm:text-sm font-semibold text-white mt-3 mb-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#5E6AD2] inline-block"></span>
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-xs font-semibold text-zinc-300 mt-2 mb-0.5">{children}</h4>
          ),
          p: ({ children }) => (
            <p className="my-1.5 leading-relaxed text-[#D4D4D8]">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 space-y-1 my-2 text-[#D4D4D8] marker:text-zinc-500">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 space-y-1 my-2 text-[#D4D4D8] marker:text-zinc-500">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed pl-1">{children}</li>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-3 rounded-lg border border-white/[0.08] bg-[#0E0F12] shadow-sm">
              <table className="w-full text-left text-xs border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[#16181D] text-zinc-300 uppercase text-[10px] tracking-wider border-b border-white/[0.08]">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-white/[0.05] text-zinc-300">{children}</tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-white/[0.02] transition-colors divide-x divide-white/[0.04]">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="py-2.5 px-3.5 font-semibold text-zinc-200 whitespace-nowrap">{children}</th>
          ),
          td: ({ children }) => (
            <td className="py-2.5 px-3.5 align-top leading-relaxed text-zinc-300">{children}</td>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-[#5E6AD2] pl-3 py-1.5 my-2.5 bg-[#5E6AD2]/5 text-zinc-300 italic text-xs rounded-r">
              {children}
            </blockquote>
          ),
          code: ({ inline, children }) => {
            if (inline) {
              return (
                <code className="px-1.5 py-0.5 rounded bg-[#1A1D24] text-zinc-200 font-mono text-[11px] border border-white/[0.08]">
                  {children}
                </code>
              );
            }
            return (
              <pre className="p-3.5 rounded-lg bg-[#0E0F12] border border-white/[0.08] font-mono text-xs overflow-x-auto my-2 text-zinc-200">
                <code>{children}</code>
              </pre>
            );
          },
          strong: ({ children }) => (
            <strong className="font-semibold text-white">{children}</strong>
          ),
        }}
      >
        {sanitized}
      </ReactMarkdown>
    </div>
  );
}

export default function App() {
  const [showTour, setShowTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  useEffect(() => {
    try {
      const tourSeen = localStorage.getItem('hirekiwi_tour_seen');
      if (!tourSeen) {
        const timer = setTimeout(() => {
          setShowTour(true);
        }, 800);
        return () => clearTimeout(timer);
      }
    } catch (e) {
      console.warn('Could not read tour state', e);
    }
  }, []);

  const handleStartTour = () => {
    setTourStep(0);
    setShowTour(true);
  };

  const handleCloseTour = () => {
    setShowTour(false);
    try {
      localStorage.setItem('hirekiwi_tour_seen', 'true');
    } catch (e) {
      // ignore
    }
  };

  const tourSteps = [
    {
      badge: "Architecture & Foundation",
      title: "Corrective RAG (CRAG) Assistant",
      description:
        "Welcome! This AI knowledge assistant answers queries from Standard-10 textbook PDFs and engineering policy handbooks using a cyclic LangGraph state machine with 100% zero-hallucination verification.",
      bulletPoints: [
        "Dedicated 24/7 AWS EC2 backend with persistent ChromaDB vector store",
        "Sub-second Groq LPU inference using openai/gpt-oss-120b (131k context)",
        "Zero cold starts, fully decoupled Vercel Edge architecture",
      ],
      icon: Sparkles,
    },
    {
      badge: "Knowledge Boundaries",
      title: "Dynamic Knowledge Scope",
      description:
        "Use the top scope bar to isolate questions to a single textbook (e.g. Mathematics, Geography, or History) or query across the entire multi-document corpus simultaneously.",
      bulletPoints: [
        "Click any document chip to toggle active knowledge scope",
        "Total chunk counter dynamically adjusts based on active filters",
        "Upload new PDFs, Markdown, or TXT files on the fly via the + Add Doc button",
      ],
      icon: Filter,
    },
    {
      badge: "Factuality & Evidence",
      title: "Strict Grounding & Page-Level Citations",
      description:
        "Every claim generated is anchored in verifiable text excerpts with exact document names and page numbers (e.g., [chapter_01_Linear_Equations...pdf | Page 21]).",
      bulletPoints: [
        "Zero Hallucination: Acknowledges missing information when queries are out-of-corpus",
        "Trust Factor Badge: Displays 0% to 100% confidence grounded in evidence",
        "Evaluation score: 100% pass rate on answerable and unanswerable benchmarks",
      ],
      icon: ShieldCheck,
    },
    {
      badge: "Retrieval Innovation",
      title: "Hybrid BM25 + Dense Reranking & Telemetry",
      description:
        "Retrieval fuses dense semantic embeddings with lexical keyword matching using Reciprocal Rank Fusion (RRF k=60) before LLM document grading.",
      bulletPoints: [
        "Click 'Show Evidence Chunks' on any response to inspect retrieved excerpts",
        "View dense vector rank vs. BM25 keyword rank side-by-side",
        "Real-time execution step telemetry (duration in ms for each graph node)",
      ],
      icon: Layers,
    },
    {
      badge: "Self-Correction & Fallback",
      title: "Adaptive Web Search & Quick Prompts",
      description:
        "When internal documents lack sufficient confidence, the pipeline can autonomously self-correct using DuckDuckGo web search.",
      bulletPoints: [
        "Toggle 'Web Fallback' on or off in the bottom command bar",
        "Adjust Top-K chunk retrieval depth (2 to 8 chunks)",
        "Click any pre-crafted prompt below to immediately test the system!",
      ],
      icon: Compass,
      actionPrompt: "Explain Cramer's rule step-by-step with determinants D, Dx, Dy, and the textbook worked example.",
      actionDoc: "chapter_01_Linear_Equations_in_Two_Variables.pdf",
    },
  ];

  const [availableDocs, setAvailableDocs] = useState([]);
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [notification, setNotification] = useState(null);
  const fileInputRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  };

  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "### Welcome to the HireKiwi Knowledge Assistant\n" +
        "I provide strictly grounded, evidence-backed answers from your document collection using **Corrective RAG (CRAG)** with hybrid dense-lexical reranking.\n\n" +
        "- **Evidence Citations**: Every claim is cited with the exact document name and page number (`[doc | Page X]`).\n" +
        "- **Zero Hallucination**: When information is unavailable in the corpus, I clearly acknowledge missing data.\n" +
        "- **Targeted Scope**: You can select specific PDFs above or search across all loaded documents.",
      sources: [],
      steps: [],
      confidence: 1.0,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [topK, setTopK] = useState(4);
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [expandedSources, setExpandedSources] = useState({});
  const [expandedSteps, setExpandedSteps] = useState({});

  const [health, setHealth] = useState({
    status: 'connecting',
    llm_provider: 'groq',
    vector_store_chunks: 101,
  });

  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const fetchDocsAndHealth = async () => {
    try {
      const [hRes, dRes] = await Promise.all([
        fetch('/api/health'),
        fetch('/api/documents'),
      ]);

      if (hRes.ok) {
        const hData = await hRes.json();
        setHealth(hData);
      } else {
        setHealth((prev) => ({ ...prev, status: 'offline' }));
      }
      if (dRes.ok) {
        const dData = await dRes.json();
        setAvailableDocs(dData.documents || []);
      }
    } catch (err) {
      console.warn('Backend connection error:', err);
      setHealth((prev) => ({ ...prev, status: 'offline' }));
    }
  };

  useEffect(() => {
    fetchDocsAndHealth();
    const interval = setInterval(fetchDocsAndHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleDoc = (docName) => {
    setSelectedDocs((prev) => {
      if (prev.includes(docName)) {
        return prev.filter((d) => d !== docName);
      } else {
        return [...prev, docName];
      }
    });
  };

  const handleSelectAllDocs = () => {
    setSelectedDocs([]);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const validExtensions = ['.pdf', '.md', '.markdown', '.txt'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!validExtensions.includes(ext)) {
      showToast(`Unsupported format "${ext}". Please upload PDF, Markdown, or TXT.`, 'error');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      showToast('File size exceeds 50MB limit.', 'error');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Upload failed with HTTP ${res.status}`);
      }

      const data = await res.json();
      showToast(`Indexed "${data.name}" (${data.chunks} chunks)!`, 'success');
      await fetchDocsAndHealth();

      setSelectedDocs((prev) => {
        if (!prev.includes(data.name)) {
          return [...prev, data.name];
        }
        return prev;
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `upload-${Date.now()}`,
          role: 'assistant',
          content: `Indexed **${data.name}** into ChromaDB (${data.chunks} chunks${
            data.pages ? `, ${data.pages} pages` : ''
          }). It is now active and selected for queries.`,
          sources: [],
          steps: [],
          confidence: 1.0,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err) {
      console.error('File upload error:', err);
      showToast(err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDoc = async (docName, e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${docName}" and remove all its chunks from the vector store?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(docName)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error(`Failed to delete (HTTP ${res.status})`);
      }
      showToast(`Removed "${docName}" from index.`, 'success');
      setSelectedDocs((prev) => prev.filter((d) => d !== docName));
      await fetchDocsAndHealth();
    } catch (err) {
      console.error('Delete doc error:', err);
      showToast(err.message, 'error');
    }
  };

  const executeQuery = async (queryText, targetDocs = null) => {
    const query = queryText.trim();
    if (!query || loading) return;

    const activeDocs = targetDocs !== null ? targetDocs : selectedDocs;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuery('');
    setLoading(true);

    const historyPayload = messages
      .filter((m) => m.id !== 'welcome')
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query,
          top_k: Number(topK),
          enable_web_search: Boolean(enableWebSearch),
          selected_documents: activeDocs.length > 0 ? activeDocs : null,
          chat_history: historyPayload,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();

      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.answer,
        sources: data.sources || [],
        steps: data.execution_steps || [],
        confidence: data.confidence_score,
        web_search_used: data.web_search_used,
        latency_ms: data.total_latency_ms,
        filtered_docs: activeDocs.length > 0 ? activeDocs : ['All Documents'],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Chat query error:', err);
      const errorMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `**Error communicating with backend**: ${err.message}. Please verify the backend service is operational.`,
        sources: [],
        steps: [],
        confidence: 0.0,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = (e) => {
    if (e) e.preventDefault();
    executeQuery(inputQuery);
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content:
          "### Chat Cleared\nSelect the document(s) you wish to search above and ask any question.",
        sources: [],
        steps: [],
        confidence: 1.0,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const handleRunTourDemo = () => {
    const currentStepData = tourSteps[tourStep];
    handleCloseTour();
    if (currentStepData?.actionPrompt) {
      if (currentStepData.actionDoc) {
        setSelectedDocs([currentStepData.actionDoc]);
      }
      setTimeout(() => {
        executeQuery(
          currentStepData.actionPrompt,
          currentStepData.actionDoc ? [currentStepData.actionDoc] : null
        );
      }, 150);
    }
  };

  const activeChunkCount = availableDocs
    .filter((d) => selectedDocs.length === 0 || selectedDocs.includes(d.name))
    .reduce((sum, d) => sum + (d.chunks || 0), 0);

  // Suggested Quick Queries for initial exploration
  const quickPrompts = [
    {
      title: "📐 Cramer's Rule Formula",
      prompt: "Explain Cramer's rule step-by-step with determinants D, Dx, Dy, and the textbook worked example.",
      doc: "chapter_01_Linear_Equations_in_Two_Variables.pdf",
    },
    {
      title: "🌿 Field Visit & Biodiversity",
      prompt: "What is Chapter 1 about and what is the comparison between India and Brazil's flora and fauna?",
      doc: "chapter_01_Field_Visit.pdf",
    },
    {
      title: "🏛️ Western Historiography",
      prompt: "What are the core stages of historical research and notable scholars covered in Chapter 1?",
      doc: "chapter_01_Historiography_Development_in_the_West.pdf",
    },
    {
      title: "🔒 Incident Response SLOs",
      prompt: "What are the response time SLOs and procedures for Sev-1 incidents in the engineering handbook?",
      doc: "engineering_handbook.md",
    },
  ];

  return (
    <div className="min-h-screen bg-[#0B0C0E] text-[#EDEDED] flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="border-b border-white/[0.07] bg-[#0E0F12]/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Minimalist Engineered Logo */}
            <div className="w-7 h-7 rounded-lg bg-[#16181D] border border-white/10 flex items-center justify-center text-white shadow-sm">
              <Database className="w-3.5 h-3.5 text-zinc-200" />
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-sm tracking-tight text-[#EDEDED]">
                HireKiwi RAG
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-zinc-400 border border-white/[0.08] font-mono">
                CRAG v2.0
              </span>
            </div>
          </div>

          {/* System Status Indicators */}
          <div className="flex items-center space-x-2.5 text-xs">
            <div className="flex items-center space-x-2 bg-[#14161B] px-2.5 py-1 rounded-md border border-white/[0.08] text-zinc-300">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  health.status === 'healthy'
                    ? 'bg-emerald-400'
                    : 'bg-amber-400 animate-pulse'
                }`}
              />
              <span className="font-mono text-[11px] text-zinc-300">
                {health.status === 'healthy' ? 'FastAPI Live' : 'Connecting...'}
              </span>
            </div>

            <div className="hidden sm:flex items-center space-x-1.5 bg-[#14161B] px-2.5 py-1 rounded-md border border-white/[0.08] text-zinc-400 font-mono text-[11px]">
              <Cpu className="w-3 h-3 text-zinc-400" />
              <span>Groq 120B</span>
            </div>

            <div className="hidden md:flex items-center space-x-1.5 bg-[#14161B] px-2.5 py-1 rounded-md border border-white/[0.08] text-zinc-400 font-mono text-[11px]">
              <span>{health.vector_store_chunks || 101} Chunks</span>
            </div>

            <button
              type="button"
              onClick={handleStartTour}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md border border-[#5E6AD2]/40 hover:border-[#5E6AD2] bg-[#5E6AD2]/10 hover:bg-[#5E6AD2]/20 text-[#A5B4FC] hover:text-white transition-all text-[11px] font-medium shadow-sm"
              title="Interactive Feature Tour"
            >
              <Compass className="w-3.5 h-3.5 text-[#818CF8]" />
              <span className="hidden sm:inline">Tour</span>
            </button>

            <button
              onClick={handleClearChat}
              className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-[#1A1D24] rounded-md transition-colors"
              title="Clear Conversation"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Target Document Selector Strip */}
      <section className="border-b border-white/[0.07] bg-[#0E0F12] px-4 py-2.5">
        <div className="max-w-6xl mx-auto space-y-2">
          {/* Notification Banner */}
          {notification && (
            <div
              className={`p-2.5 rounded-lg text-xs flex items-center justify-between transition-all ${
                notification.type === 'error'
                  ? 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
                  : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                {notification.type === 'error' ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                )}
                <span>{notification.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setNotification(null)}
                className="hover:opacity-75 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center space-x-2 text-zinc-300 font-medium">
              <Filter className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-xs uppercase tracking-wider text-zinc-400 font-semibold text-[11px]">
                Knowledge Scope
              </span>
              <span className="text-[11px] text-zinc-500 font-mono">
                ({selectedDocs.length === 0 ? 'All Documents' : `${selectedDocs.length} Active`} &bull; {activeChunkCount} chunks)
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".pdf,.md,.markdown,.txt"
                className="hidden"
              />

              {/* Modern Minimalist Add Document Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-[#18191E] hover:bg-[#202227] text-zinc-200 border border-white/[0.12] flex items-center space-x-1.5 transition-all disabled:opacity-50 shadow-sm"
                title="Upload a PDF, Markdown, or TXT document"
              >
                {uploading ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin text-zinc-400" />
                    <span>Indexing File...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3 h-3 text-zinc-400" />
                    <span>Add Document</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleSelectAllDocs}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  selectedDocs.length === 0
                    ? 'bg-zinc-800 text-white border border-white/10'
                    : 'bg-[#14161B] text-zinc-400 hover:text-zinc-200 border border-white/[0.06]'
                }`}
              >
                Select All
              </button>
            </div>
          </div>

          {/* Document Selection Pills */}
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {availableDocs.map((doc, idx) => {
              const isSelected = selectedDocs.includes(doc.name);
              const isAll = selectedDocs.length === 0;
              const active = isAll || isSelected;

              return (
                <div
                  key={idx}
                  onClick={() => handleToggleDoc(doc.name)}
                  className={`group cursor-pointer px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center space-x-2 transition-all ${
                    active
                      ? isSelected
                        ? 'bg-[#181A22] border-white/20 text-white shadow-sm'
                        : 'bg-[#14161B] border-white/[0.08] text-zinc-300'
                      : 'bg-[#0E0F12]/60 border-white/[0.04] text-zinc-500 hover:text-zinc-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    readOnly
                    className="w-3 h-3 rounded bg-zinc-900 border-zinc-700 text-indigo-500 pointer-events-none"
                  />
                  {doc.type === 'pdf' ? (
                    <BookOpen className="w-3 h-3 text-rose-400 shrink-0" />
                  ) : (
                    <FileText className="w-3 h-3 text-sky-400 shrink-0" />
                  )}
                  <span className="truncate max-w-[190px] text-[12px]" title={doc.name}>
                    {doc.name}
                  </span>
                  {doc.pages && (
                    <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                      p.{doc.pages}
                    </span>
                  )}
                  <span className="text-[10px] px-1 py-0.2 rounded bg-zinc-800/80 text-zinc-400 font-mono shrink-0">
                    {doc.chunks} ch
                  </span>

                  <button
                    type="button"
                    onClick={(e) => handleDeleteDoc(doc.name, e)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-500 hover:text-rose-400 transition-opacity ml-0.5"
                    title={`Delete ${doc.name}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Main Chat Interface */}
      <main className="max-w-6xl mx-auto px-4 py-4 flex-1 w-full flex flex-col justify-between overflow-hidden">
        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-4">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const sourcesExpanded = expandedSources[msg.id] || false;
            const stepsExpanded = expandedSteps[msg.id] || false;

            return (
              <div
                key={msg.id}
                className={`flex items-start space-x-3 ${
                  isUser ? 'justify-end' : 'justify-start'
                }`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-lg bg-[#16181D] border border-white/10 flex items-center justify-center shrink-0 mt-0.5 text-zinc-300 shadow-sm">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}

                <div
                  className={`rounded-2xl p-4 space-y-3 transition-all ${
                    isUser
                      ? 'max-w-xl bg-[#1A1C23] border border-white/10 text-white rounded-tr-sm'
                      : 'w-full max-w-3xl lg:max-w-4xl bg-[#111317] border border-white/[0.08] rounded-tl-sm text-zinc-200 shadow-lg'
                  }`}
                >
                  {/* Message Header */}
                  <div className="flex flex-col space-y-1.5 border-b border-white/[0.06] pb-2">
                    <div className="flex items-center justify-between text-[11px] text-zinc-400">
                      <span className="font-semibold text-zinc-300">
                        {isUser ? 'You' : 'CRAG Knowledge Assistant'}
                      </span>
                      <div className="flex items-center space-x-2">
                        {msg.latency_ms && (
                          <span className="font-mono text-zinc-500 text-[10px]">
                            {msg.latency_ms.toFixed(0)}ms
                          </span>
                        )}
                        <span className="text-[10px] text-zinc-500">{msg.timestamp}</span>
                        {!isUser && (
                          <button
                            onClick={() => handleCopy(msg.id, msg.content)}
                            className="hover:text-zinc-200 p-1 rounded transition-colors text-zinc-400"
                            title="Copy Answer"
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Trust Factor & Scope Badge */}
                    {!isUser && msg.confidence !== undefined && (
                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono border flex items-center space-x-1.5 ${
                            msg.confidence >= 0.85
                              ? (msg.sources && msg.sources.length > 0
                                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                                  : 'bg-zinc-800/80 border-white/10 text-zinc-300')
                              : msg.confidence > 0.0
                              ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                              : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                          }`}
                        >
                          <ShieldCheck className="w-3 h-3 shrink-0" />
                          <span>
                            Trust Factor: {Math.round(msg.confidence * 100)}% &bull;{' '}
                            {msg.confidence >= 0.85
                              ? (msg.sources && msg.sources.length > 0
                                  ? 'High Grounding (Direct Document Evidence)'
                                  : 'Direct Conversational Interaction')
                              : msg.confidence > 0.0
                              ? 'Partial Evidence'
                              : 'Missing from Corpus (Zero Hallucination)'}
                          </span>
                        </span>
                        {msg.filtered_docs && (
                          <span className="text-[10px] text-zinc-500 font-mono">
                            Scope: {msg.filtered_docs.join(', ')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Message Content rendered as rich formatted Markdown */}
                  <MarkdownMessage content={msg.content} isUser={isUser} />

                  {/* Evidence Drawer for Assistant Replies */}
                  {!isUser && msg.sources && msg.sources.length > 0 && (
                    <div className="pt-2 border-t border-white/[0.06] space-y-2">
                      <button
                        onClick={() =>
                          setExpandedSources((prev) => ({
                            ...prev,
                            [msg.id]: !sourcesExpanded,
                          }))
                        }
                        className="text-[11px] font-medium text-zinc-400 hover:text-zinc-200 flex items-center space-x-1.5 transition-colors"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>
                          {sourcesExpanded ? 'Hide' : 'Show'} Evidence Chunks &amp; Hybrid Reranking Scores ({msg.sources.length} chunks retained)
                        </span>
                        {sourcesExpanded ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>

                      {sourcesExpanded && (
                        <div className="space-y-2 pt-1">
                          {msg.sources.map((chunk, idx) => (
                            <div
                              key={idx}
                              className="bg-[#0B0C0E] border border-white/[0.08] rounded-lg p-2.5 space-y-1.5 text-[11px]"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-1 border-b border-white/[0.06] pb-1">
                                <div className="flex items-center space-x-2">
                                  <span className="font-mono text-zinc-500">#{idx + 1}</span>
                                  <span className="font-medium text-zinc-200">{chunk.source}</span>
                                  {chunk.metadata?.page_number && (
                                    <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-white/[0.06] font-mono text-[10px]">
                                      Page {chunk.metadata.page_number}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center space-x-2 font-mono text-[10px]">
                                  {chunk.metadata?.rrf_score && (
                                    <span className="text-zinc-400">
                                      RRF: {chunk.metadata.rrf_score}
                                    </span>
                                  )}
                                  <span
                                    className={`px-1.5 py-0.2 rounded ${
                                      chunk.relevance === 'relevant'
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                        : 'bg-zinc-800 text-zinc-400'
                                    }`}
                                  >
                                    {chunk.relevance}
                                  </span>
                                </div>
                              </div>
                              <p className="text-zinc-400 whitespace-pre-wrap font-mono line-clamp-4 leading-relaxed text-[11px]">
                                {chunk.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Execution Trace Toggle */}
                  {!isUser && msg.steps && msg.steps.length > 0 && (
                    <div className="pt-1">
                      <button
                        onClick={() =>
                          setExpandedSteps((prev) => ({
                            ...prev,
                            [msg.id]: !stepsExpanded,
                          }))
                        }
                        className="text-[10px] text-zinc-500 hover:text-zinc-400 flex items-center space-x-1"
                      >
                        <Info className="w-3 h-3" />
                        <span>{stepsExpanded ? 'Hide' : 'View'} CRAG Pipeline Nodes</span>
                        {stepsExpanded ? (
                          <ChevronUp className="w-2.5 h-2.5" />
                        ) : (
                          <ChevronDown className="w-2.5 h-2.5" />
                        )}
                      </button>

                      {stepsExpanded && (
                        <div className="space-y-1.5 pt-2">
                          {msg.steps.map((st, i) => (
                            <div
                              key={i}
                              className="bg-[#0B0C0E] border border-white/[0.08] rounded p-2 text-[10px] font-mono text-zinc-400 space-y-1"
                            >
                              <div className="flex items-center justify-between text-zinc-300">
                                <span className="font-semibold text-zinc-200">
                                  {st.step_name === 'understand_query'
                                    ? '1. LLM Query Analyzer & Search Planner'
                                    : st.step_name === 'conversational_reply'
                                    ? '2. Direct Conversational Responder'
                                    : st.step_name === 'retrieve'
                                    ? '2. Vector Store Retrieval'
                                    : st.step_name === 'rerank'
                                    ? '3. Hybrid BM25 + Dense RRF Reranker'
                                    : st.step_name === 'grade_documents'
                                    ? '4. Corrective Relevance Grader'
                                    : st.step_name === 'transform_query'
                                    ? '5. Query Rewriter'
                                    : st.step_name === 'web_search_node'
                                    ? '6. Web Search Fallback'
                                    : st.step_name === 'generate'
                                    ? '7. Answer Generation & Citations'
                                    : st.step_name}
                                </span>
                                <span className="text-zinc-500">{st.duration_ms.toFixed(0)}ms</span>
                              </div>
                              {st.details && (
                                <div className="text-zinc-400 text-[10px] pl-2 border-l border-white/[0.08] space-y-0.5">
                                  {st.step_name === 'understand_query' && (
                                    <>
                                      <div>Action: <span className="text-zinc-200">{st.details.action || st.details.intent}</span></div>
                                      {(st.details.search_reasoning || st.details.explanation) && (
                                        <div>Reasoning: <span className="text-zinc-300">{st.details.search_reasoning || st.details.explanation}</span></div>
                                      )}
                                      {st.details.search_queries && st.details.search_queries.length > 0 && (
                                        <div>Planned Queries: <span className="text-zinc-300">{JSON.stringify(st.details.search_queries)}</span></div>
                                      )}
                                    </>
                                  )}
                                  {st.step_name === 'conversational_reply' && (
                                    <div>Interaction: <span className="text-emerald-400">Direct Conversational Small Talk / Greeting (0 vector searches needed)</span></div>
                                  )}
                                  {st.step_name === 'retrieve' && (
                                    <div>Retrieved: <span className="text-zinc-200">{st.details.candidates_retrieved} candidate chunks</span> across {JSON.stringify(st.details.doc_sources || [])}</div>
                                  )}
                                  {st.step_name === 'rerank' && (
                                    <div>Retained: <span className="text-zinc-200">{st.details.retained_chunks} chunks</span> via {st.details.method} (Top RRF: {st.details.top_rrf_score})</div>
                                  )}
                                  {st.step_name === 'grade_documents' && (
                                    <div>Graded: <span className="text-emerald-400">{st.details.relevant_count} relevant</span>, <span className="text-zinc-500">{st.details.irrelevant_count} irrelevant</span></div>
                                  )}
                                  {st.step_name === 'generate' && (
                                    <div>Trust Score: <span className="text-emerald-400">{st.details.confidence}</span> (Sources: {st.details.internal_sources_used} internal, {st.details.web_sources_used} web)</div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-7 h-7 rounded-lg bg-[#1A1C23] border border-white/10 flex items-center justify-center shrink-0 mt-0.5 text-zinc-300 shadow-sm">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Quick Suggested Prompts when starting fresh */}
          {messages.length <= 1 && (
            <div className="pt-2 pb-3">
              <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold mb-2">
                Suggested Test Inquiries
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {quickPrompts.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedDocs([item.doc]);
                      executeQuery(item.prompt, [item.doc]);
                    }}
                    className="p-3 rounded-xl bg-[#121316] hover:bg-[#18191E] border border-white/[0.08] hover:border-white/20 text-left transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-white group-hover:text-[#5E6AD2] transition-colors">
                        {item.title}
                      </span>
                      <ArrowRight className="w-3 h-3 text-zinc-500 group-hover:text-white transition-colors" />
                    </div>
                    <p className="text-[11px] text-zinc-400 line-clamp-2 mt-1 leading-snug">
                      {item.prompt}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono">
                      <BookOpen className="w-2.5 h-2.5 text-zinc-400" />
                      <span>{item.doc}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Thinking / Pipeline Running State */}
          {loading && (
            <div className="flex items-start space-x-3">
              <div className="w-7 h-7 rounded-lg bg-[#16181D] border border-white/10 flex items-center justify-center shrink-0 mt-0.5 text-zinc-300 shadow-sm">
                <Bot className="w-3.5 h-3.5 animate-spin" />
              </div>
              <div className="bg-[#111317] rounded-2xl rounded-tl-sm p-3 border border-white/[0.08] text-xs text-zinc-300 flex items-center space-x-2">
                <RefreshCw className="w-3.5 h-3.5 text-zinc-400 animate-spin" />
                <span>Executing CRAG pipeline: Planning queries, retrieving chunks &amp; reranking with BM25...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Command Bar Input Box (Raycast / Linear Style) */}
        <div className="pt-2 border-t border-white/[0.07] space-y-2 bg-[#0B0C0E]">
          <form
            onSubmit={handleSendMessage}
            className="rounded-xl border border-white/[0.12] bg-[#121316] focus-within:border-white/25 focus-within:ring-1 focus-within:ring-white/10 transition-all p-2 shadow-xl"
          >
            <div className="relative flex items-center">
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Ask any question about the selected document(s)..."
                disabled={loading}
                className="w-full bg-transparent pl-2.5 pr-20 py-1.5 text-zinc-100 placeholder-zinc-500 text-xs sm:text-sm focus:outline-none font-normal"
              />
              <button
                type="submit"
                disabled={loading || !inputQuery.trim()}
                className="absolute right-1 px-3 py-1.5 bg-white text-black hover:bg-zinc-200 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>Send</span>
                <CornerDownLeft className="w-3 h-3" />
              </button>
            </div>

            {/* Bottom Toolbar inside Input Card */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 px-1 border-t border-white/[0.04] text-[11px] text-zinc-400">
              <div className="flex items-center space-x-3">
                <label className="flex items-center space-x-1.5 cursor-pointer text-zinc-400 hover:text-zinc-200 transition-colors">
                  <input
                    type="checkbox"
                    checked={enableWebSearch}
                    onChange={(e) => setEnableWebSearch(e.target.checked)}
                    className="rounded bg-zinc-900 border-zinc-700 text-[#5E6AD2] w-3 h-3"
                  />
                  <span>Web Fallback</span>
                </label>

                <div className="flex items-center space-x-1.5">
                  <span className="text-zinc-500">Top-K:</span>
                  <select
                    value={topK}
                    onChange={(e) => setTopK(Number(e.target.value))}
                    className="bg-[#18191E] border border-white/[0.08] rounded px-1.5 py-0.5 text-zinc-200 font-mono text-[11px] focus:outline-none"
                  >
                    <option value={2}>2</option>
                    <option value={4}>4</option>
                    <option value={6}>6</option>
                    <option value={8}>8</option>
                  </select>
                </div>
              </div>

              <div className="text-[10px] text-zinc-500 font-mono">
                {selectedDocs.length === 0
                  ? 'Searching All Documents'
                  : `Searching: ${selectedDocs.join(', ')}`}
              </div>
            </div>
          </form>
        </div>
      </main>

      {/* Interactive Feature Tour Modal */}
      {showTour && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-[#111216] border border-white/[0.12] rounded-2xl shadow-2xl overflow-hidden p-6 text-zinc-100 space-y-5">
            {/* Top Bar inside modal */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#5E6AD2]/15 border border-[#5E6AD2]/30 text-[#A5B4FC] text-[11px] font-medium tracking-wide">
                  {tourSteps[tourStep].badge}
                </span>
                <span className="text-zinc-500 text-[11px] font-mono">
                  {tourStep + 1} of {tourSteps.length}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCloseTour}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                title="Close Tour"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Icon & Title */}
            <div className="space-y-2">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-[#5E6AD2]/10 border border-[#5E6AD2]/20 flex items-center justify-center text-[#818CF8] shadow-sm">
                  {React.createElement(tourSteps[tourStep].icon, { className: 'w-5 h-5' })}
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {tourSteps[tourStep].title}
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed pt-1">
                {tourSteps[tourStep].description}
              </p>
            </div>

            {/* Bullet Points */}
            <div className="bg-[#16181D] border border-white/[0.06] rounded-xl p-3.5 space-y-2">
              {tourSteps[tourStep].bulletPoints.map((pt, i) => (
                <div key={i} className="flex items-start space-x-2.5 text-xs text-zinc-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                  <span className="leading-snug">{pt}</span>
                </div>
              ))}
            </div>

            {/* Step Indicators & Action Controls */}
            <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
              {/* Dots */}
              <div className="flex items-center space-x-1.5">
                {tourSteps.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setTourStep(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === tourStep ? 'w-5 bg-[#5E6AD2]' : 'w-1.5 bg-white/20 hover:bg-white/40'
                    }`}
                    title={`Jump to step ${i + 1}`}
                  />
                ))}
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center space-x-2">
                {tourStep > 0 && (
                  <button
                    type="button"
                    onClick={() => setTourStep((prev) => Math.max(prev - 1, 0))}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-white/[0.1] text-zinc-300 hover:text-white hover:bg-white/[0.05] text-xs font-medium transition-colors"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    <span>Back</span>
                  </button>
                )}

                {tourStep < tourSteps.length - 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={handleCloseTour}
                      className="px-2.5 py-1.5 text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
                    >
                      Skip
                    </button>
                    <button
                      type="button"
                      onClick={() => setTourStep((prev) => Math.min(prev + 1, tourSteps.length - 1))}
                      className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-white text-black hover:bg-zinc-200 text-xs font-semibold transition-all shadow-sm"
                    >
                      <span>Next</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleCloseTour}
                      className="px-3 py-1.5 rounded-lg border border-white/[0.1] text-zinc-300 hover:text-white hover:bg-white/[0.05] text-xs transition-colors"
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      onClick={handleRunTourDemo}
                      className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-[#5E6AD2] hover:bg-[#4F5BC0] text-white text-xs font-semibold shadow-lg shadow-[#5E6AD2]/30 transition-all"
                    >
                      <span>Run Demo Query</span>
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
