import React, { useState, useEffect, useRef } from 'react';
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
  Sparkles,
  Sliders,
  Trash2,
  Info,
  Layers,
  ArrowRight,
  Filter,
} from 'lucide-react';

export default function App() {
  // Available documents from backend catalog
  const [availableDocs, setAvailableDocs] = useState([]);
  // Selected document filenames (empty array = all documents)
  const [selectedDocs, setSelectedDocs] = useState([]);

  // Chat message state: [{ id, role: 'user' | 'assistant', content, sources, steps, confidence, web_search_used, latency_ms }]
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hello! I am your AI Knowledge Assistant. Select which PDF(s) or policies you want me to search above, and ask me any question.\n\nI will retrieve relevant chunks from ChromaDB, rerank them using Hybrid BM25 + Dense RRF, cite source documents and page numbers, and strictly avoid inventing facts.",
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

  // System status
  const [health, setHealth] = useState({
    status: 'connecting',
    llm_provider: 'groq',
    vector_store_chunks: 0,
  });

  const chatEndRef = useRef(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Fetch document catalog and health
  const fetchDocsAndHealth = async () => {
    try {
      const [hRes, dRes] = await Promise.all([
        fetch('/api/health'),
        fetch('/api/documents'),
      ]);

      if (hRes.ok) {
        const hData = await hRes.json();
        setHealth(hData);
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

  // Toggle document selection
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

  // Submit chat message
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const query = inputQuery.trim();
    if (!query || loading) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuery('');
    setLoading(true);

    // Format chat history for context
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
          selected_documents: selectedDocs.length > 0 ? selectedDocs : null,
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
        filtered_docs: selectedDocs.length > 0 ? selectedDocs : ['All Documents'],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Chat query error:', err);
      const errorMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `Error retrieving answer: ${err.message}. Please verify the FastAPI backend is running at http://localhost:8000.`,
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
          "Chat cleared. Select the document(s) you wish to search above and ask any question.",
        sources: [],
        steps: [],
        confidence: 1.0,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  // Calculate active chunk count based on selected documents
  const activeChunkCount = availableDocs
    .filter((d) => selectedDocs.length === 0 || selectedDocs.includes(d.name))
    .reduce((sum, d) => sum + (d.chunks || 0), 0);

  return (
    <div className="min-h-screen bg-[#090d16] text-zinc-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-zinc-800/80 bg-[#0c101c]/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-base tracking-tight text-white">
                  HireKiwi CRAG Assistant
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                  Live Conversational RAG
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Corrective RAG &bull; Hybrid BM25+Dense Reranking &bull; Zero Hallucination
              </p>
            </div>
          </div>

          {/* System Status Indicators */}
          <div className="flex items-center space-x-3 text-xs">
            <div className="hidden sm:flex items-center space-x-2 bg-zinc-900/80 px-2.5 py-1 rounded-lg border border-zinc-800 text-zinc-300">
              <span
                className={`w-2 h-2 rounded-full ${
                  health.status === 'healthy'
                    ? 'bg-emerald-400 animate-pulse'
                    : 'bg-amber-400'
                }`}
              />
              <span className="font-mono text-[11px]">
                {health.status === 'healthy' ? 'FastAPI Online' : 'Connecting...'}
              </span>
            </div>

            <div className="hidden md:flex items-center space-x-1.5 bg-zinc-900/80 px-2.5 py-1 rounded-lg border border-zinc-800 text-zinc-300">
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[11px]">LLM:</span>
              <span className="font-semibold text-indigo-300 font-mono text-[11px]">
                Groq (gpt-oss-120b)
              </span>
            </div>

            <div className="flex items-center space-x-1.5 bg-zinc-900/80 px-2.5 py-1 rounded-lg border border-zinc-800 text-zinc-300">
              <Database className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-[11px]">ChromaDB:</span>
              <span className="font-semibold text-violet-300 font-mono text-[11px]">
                {health.vector_store_chunks || 101} chunks
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Document Selector Header Bar */}
      <section className="border-b border-zinc-800/80 bg-[#0e1322]/80 backdrop-blur px-4 py-3">
        <div className="max-w-6xl mx-auto space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center space-x-2 text-zinc-300 font-medium">
              <Filter className="w-3.5 h-3.5 text-indigo-400" />
              <span>Target Documents to Search:</span>
              <span className="text-[11px] text-zinc-400 font-mono">
                ({selectedDocs.length === 0 ? 'All Documents' : `${selectedDocs.length} Selected`} &bull; {activeChunkCount} chunks)
              </span>
            </div>

            <button
              onClick={handleSelectAllDocs}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                selectedDocs.length === 0
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700'
              }`}
            >
              Select All Documents
            </button>
          </div>

          {/* Document Selection Pills */}
          <div className="flex flex-wrap gap-2 pt-1">
            {availableDocs.map((doc, idx) => {
              const isSelected = selectedDocs.includes(doc.name);
              const isAll = selectedDocs.length === 0;
              const active = isAll || isSelected;

              return (
                <button
                  key={idx}
                  onClick={() => handleToggleDoc(doc.name)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center space-x-2 transition-all ${
                    active
                      ? isSelected
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200'
                        : 'bg-zinc-800/90 border-zinc-700 text-zinc-200'
                      : 'bg-zinc-900/40 border-zinc-800/80 text-zinc-500 hover:text-zinc-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    readOnly
                    className="w-3 h-3 rounded bg-zinc-900 border-zinc-700 text-indigo-600 pointer-events-none"
                  />
                  {doc.type === 'pdf' ? (
                    <BookOpen className="w-3.5 h-3.5 text-rose-400" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-sky-400" />
                  )}
                  <span className="truncate max-w-[220px]">{doc.name}</span>
                  {doc.pages && (
                    <span className="text-[10px] text-zinc-400 font-mono">
                      p.{doc.pages}
                    </span>
                  )}
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800/80 text-zinc-400 font-mono">
                    {doc.chunks} ch
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Main Chat Container */}
      <main className="max-w-6xl mx-auto px-4 py-4 flex-1 w-full flex flex-col justify-between overflow-hidden">
        {/* Messages Stream */}
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
                  <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-0.5 text-indigo-400">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-2xl rounded-2xl p-4 space-y-3 ${
                    isUser
                      ? 'bg-indigo-600/15 border border-indigo-500/30 text-zinc-100 rounded-tr-none'
                      : 'glass-panel rounded-tl-none border border-zinc-800/80 text-zinc-200'
                  }`}
                >
                  {/* Message Header */}
                  <div className="flex items-center justify-between text-[11px] text-zinc-400 border-b border-white/[0.06] pb-2">
                    <span className="font-semibold text-zinc-300">
                      {isUser ? 'You' : 'CRAG Assistant (Groq 120B)'}
                    </span>
                    <div className="flex items-center space-x-2">
                      {msg.latency_ms && (
                        <span className="font-mono text-zinc-400">
                          {msg.latency_ms.toFixed(0)}ms
                        </span>
                      )}
                      <span>{msg.timestamp}</span>
                      {!isUser && (
                        <button
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="hover:text-zinc-200 p-1 rounded transition-colors"
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

                  {/* Message Content */}
                  <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans">
                    {msg.content}
                  </div>

                  {/* Evidence & Reranking Breakdown for Assistant Replies */}
                  {!isUser && msg.sources && msg.sources.length > 0 && (
                    <div className="pt-2 border-t border-white/[0.06] space-y-2">
                      {/* Toggle Evidence Drawer */}
                      <button
                        onClick={() =>
                          setExpandedSources((prev) => ({
                            ...prev,
                            [msg.id]: !sourcesExpanded,
                          }))
                        }
                        className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 flex items-center space-x-1.5 transition-colors"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>
                          {sourcesExpanded ? 'Hide' : 'Show'} Evidence & Hybrid Reranking Scores ({msg.sources.length} chunks)
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
                              className="bg-zinc-950/70 border border-zinc-800 rounded-lg p-2.5 space-y-1.5 text-[11px]"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-1 border-b border-zinc-800 pb-1">
                                <div className="flex items-center space-x-2">
                                  <span className="font-mono text-zinc-400">#{idx + 1}</span>
                                  <span className="font-semibold text-zinc-200">{chunk.source}</span>
                                  {chunk.metadata?.page_number && (
                                    <span className="px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                                      Page {chunk.metadata.page_number}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center space-x-2 font-mono text-[10px]">
                                  {chunk.metadata?.rrf_score && (
                                    <span className="text-violet-300">
                                      RRF: {chunk.metadata.rrf_score}
                                    </span>
                                  )}
                                  <span
                                    className={`px-1.5 py-0.2 rounded ${
                                      chunk.relevance === 'relevant'
                                        ? 'bg-emerald-500/10 text-emerald-400'
                                        : 'bg-zinc-800 text-zinc-400'
                                    }`}
                                  >
                                    {chunk.relevance}
                                  </span>
                                </div>
                              </div>
                              <p className="text-zinc-300 whitespace-pre-wrap font-mono line-clamp-4 leading-relaxed">
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
                        <div className="flex flex-wrap gap-1.5 pt-2">
                          {msg.steps.map((st, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-400"
                            >
                              {st.step_name}: {st.duration_ms.toFixed(0)}ms
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 mt-0.5 text-zinc-300">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Typing / Thinking Indicator */}
          {loading && (
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-0.5 text-indigo-400">
                <Bot className="w-4 h-4 animate-spin" />
              </div>
              <div className="glass-panel rounded-2xl rounded-tl-none p-3.5 border border-zinc-800 text-xs text-zinc-300 flex items-center space-x-2">
                <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                <span>Searching selected documents &amp; reranking candidates with BM25...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Bar & Controls */}
        <div className="pt-2 border-t border-zinc-800/80 space-y-2 bg-[#090d16]">
          <form onSubmit={handleSendMessage} className="relative flex items-center">
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Ask any question about the selected document(s)..."
              disabled={loading}
              className="w-full pl-4 pr-24 py-3.5 bg-zinc-900/90 border border-zinc-700/80 rounded-xl text-zinc-100 placeholder-zinc-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-normal"
            />
            <button
              type="submit"
              disabled={loading || !inputQuery.trim()}
              className="absolute right-2 px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Quick Chat Options */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-zinc-400 px-1">
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-1.5 cursor-pointer text-zinc-400 hover:text-zinc-200">
                <input
                  type="checkbox"
                  checked={enableWebSearch}
                  onChange={(e) => setEnableWebSearch(e.target.checked)}
                  className="rounded bg-zinc-900 border-zinc-700 text-indigo-600 focus:ring-indigo-500 w-3 h-3"
                />
                <span>Web Search Fallback</span>
              </label>

              <div className="flex items-center space-x-1.5">
                <span>Top-K Chunks:</span>
                <select
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                  className="bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-zinc-200 font-mono text-[11px] focus:outline-none"
                >
                  <option value={2}>2</option>
                  <option value={4}>4 (Default)</option>
                  <option value={6}>6</option>
                  <option value={8}>8</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleClearChat}
              className="text-zinc-500 hover:text-zinc-300 flex items-center space-x-1 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear Chat</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
