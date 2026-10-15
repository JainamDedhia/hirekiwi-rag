import React, { useState, useEffect } from 'react';
import {
  Search,
  Database,
  Cpu,
  Globe,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  Sliders,
  FileText,
  BarChart3,
  ExternalLink,
  Layers,
  ArrowRight,
  Zap,
  BookOpen,
  Info,
  Compass,
  Calculator,
  History,
  FileCheck,
  CheckCircle,
} from 'lucide-react';

export default function App() {
  // Application State
  const [query, setQuery] = useState(
    "How do you solve simultaneous linear equations using Cramer's Rule, and what are D, Dx, and Dy?"
  );
  const [topK, setTopK] = useState(4);
  const [enableWebSearch, setEnableWebSearch] = useState(true);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.4);

  // Execution & Response State
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [activeTab, setActiveTab] = useState('pipeline'); // 'pipeline' | 'sources' | 'documents' | 'benchmarks'
  const [copied, setCopied] = useState(false);
  const [showTaskBrief, setShowTaskBrief] = useState(true);

  // System & Health State
  const [health, setHealth] = useState({
    status: 'connecting',
    llm_provider: '...',
    is_mock_llm: false,
    search_provider: '...',
    vector_store_chunks: 0,
    indexed_documents: [],
  });

  const [documentStats, setDocumentStats] = useState({
    total_documents: 0,
    total_chunks: 0,
    documents: [],
  });

  const [reindexing, setReindexing] = useState(false);

  // Preset queries categorized by chapter, multi-hop, and refusal scenarios
  const PRESET_QUERIES = [
    {
      label: "Math: Cramer's Rule",
      category: 'Mathematics',
      icon: Calculator,
      color: 'text-indigo-400',
      query: "How do you solve simultaneous linear equations using Cramer's Rule, and what are D, Dx, and Dy?",
      desc: 'Grounding in Chapter 1 Linear Equations PDF (Pages 23-24)',
    },
    {
      label: 'Geography: Field Visit Skills',
      category: 'Geography',
      icon: Compass,
      color: 'text-violet-400',
      query: 'What essential skills are needed for studying geography, and which two countries are compared in the textbook?',
      desc: 'Grounding in Chapter 1 Field Visit PDF (Preface & Page 8)',
    },
    {
      label: 'History: DIKSHA App & Committee',
      category: 'History',
      icon: History,
      color: 'text-amber-400',
      query: 'How can students access digital lessons via the DIKSHA App, and who chaired the History Subject Committee?',
      desc: 'Grounding in Chapter 1 Historiography PDF (Pages 3-4)',
    },
    {
      label: 'Engineering: SEV-1 SLOs',
      category: 'Engineering',
      icon: ShieldCheck,
      color: 'text-emerald-400',
      query: "What is HireKiwi's response SLO and resolution target for SEV-1 incidents?",
      desc: 'Grounding in Engineering Handbook (Section 4)',
    },
    {
      label: 'Multi-Evidence: Committee Oversight',
      category: 'Multi-Hop',
      icon: Layers,
      color: 'text-sky-400',
      query: 'Compare the textbook publication details, committees, and approval years across the Mathematics and History textbooks.',
      desc: 'Requires synthesizing multiple pieces of evidence across textbooks',
    },
    {
      label: 'Refusal Test: Cake Recipe',
      category: 'Unanswerable',
      icon: AlertTriangle,
      color: 'text-rose-400',
      query: 'What is the secret recipe for dark chocolate lava cake according to the textbook?',
      desc: 'Tests strict refusal: must return "information is unavailable" without inventing facts',
    },
    {
      label: 'Web Fallback: Python 3.12',
      category: 'Corrective Web',
      icon: Globe,
      color: 'text-blue-400',
      query: 'What are the latest features released in Python 3.12?',
      desc: 'Out-of-domain query: automatically triggers corrective web search',
    },
  ];

  // Fetch System Health and Document Stats
  const fetchHealthAndDocs = async () => {
    try {
      const healthRes = await fetch('/api/health');
      if (healthRes.ok) {
        const data = await healthRes.json();
        setHealth(data);
      }
      const docRes = await fetch('/api/documents');
      if (docRes.ok) {
        const data = await docRes.json();
        setDocumentStats(data);
      }
    } catch (err) {
      console.warn('Backend not yet reachable:', err);
      setHealth((prev) => ({ ...prev, status: 'offline' }));
    }
  };

  useEffect(() => {
    fetchHealthAndDocs();
    const interval = setInterval(fetchHealthAndDocs, 8000);
    return () => clearInterval(interval);
  }, []);

  // Execute CRAG Query
  const handleExecuteQuery = async (e) => {
    if (e) e.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    setResponse(null);

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          top_k: Number(topK),
          enable_web_search: Boolean(enableWebSearch),
          similarity_threshold: Number(similarityThreshold),
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      setResponse(data);
      fetchHealthAndDocs();
    } catch (err) {
      console.error('Query execution error:', err);
      setResponse({
        query,
        answer: `CRAG Execution Error: ${err.message}. Please verify the FastAPI backend is running at http://localhost:8000.`,
        sources: [],
        web_search_used: false,
        confidence_score: 0.0,
        execution_steps: [
          {
            step_name: 'error',
            status: 'error',
            details: { message: err.message },
            duration_ms: 0,
          },
        ],
        total_latency_ms: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  // Re-index Documents
  const handleReindex = async () => {
    setReindexing(true);
    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force_reload: true }),
      });
      if (res.ok) {
        await fetchHealthAndDocs();
      }
    } catch (err) {
      console.error('Re-index error:', err);
    } finally {
      setReindexing(false);
    }
  };

  const handleCopyAnswer = () => {
    if (response?.answer) {
      navigator.clipboard.writeText(response.answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-zinc-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-zinc-800/80 bg-[#0c101c]/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-white">
                  HireKiwi CRAG
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono font-medium">
                  v1.2 Production
                </span>
              </div>
              <p className="text-xs text-zinc-400">Corrective RAG Knowledge Assistant & Evaluator</p>
            </div>
          </div>

          {/* System Status Indicators */}
          <div className="flex items-center space-x-3 text-xs">
            <div className="hidden sm:flex items-center space-x-2 bg-zinc-900/80 px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-300">
              <span
                className={`w-2 h-2 rounded-full ${
                  health.status === 'healthy'
                    ? 'bg-emerald-400 animate-pulse'
                    : health.status === 'connecting'
                    ? 'bg-amber-400'
                    : 'bg-red-500'
                }`}
              />
              <span className="font-mono">
                {health.status === 'healthy' ? 'FastAPI Online' : 'Connecting...'}
              </span>
            </div>

            <div className="hidden md:flex items-center space-x-1.5 bg-zinc-900/80 px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-300">
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              <span>LLM:</span>
              <span className="font-semibold text-indigo-300 font-mono">
                {health.is_mock_llm ? 'Offline Engine' : 'Groq (gpt-oss-120b)'}
              </span>
            </div>

            <div className="flex items-center space-x-1.5 bg-zinc-900/80 px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-300">
              <Database className="w-3.5 h-3.5 text-violet-400" />
              <span>ChromaDB:</span>
              <span className="font-semibold text-violet-300 font-mono">
                {documentStats.total_chunks || health.vector_store_chunks} chunks
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
        {/* Project Assessment Specification Banner */}
        {showTaskBrief && (
          <div className="rounded-xl border border-indigo-500/20 bg-gradient-to-r from-indigo-950/40 via-zinc-900/60 to-violet-950/40 p-4 relative transition-all">
            <button
              onClick={() => setShowTaskBrief(false)}
              className="absolute top-3 right-3 text-zinc-500 hover:text-zinc-300 text-xs px-2 py-0.5 rounded border border-zinc-800"
            >
              Dismiss
            </button>
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mt-0.5">
                <Info className="w-4 h-4" />
              </div>
              <div className="space-y-1 pr-12">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-semibold text-zinc-100">
                    Role Assignment: Build a Reliable RAG API
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                    2+ yrs exp | 4–6 hrs | 6–6.6 LPA role
                  </span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  <strong>Assessment Goal:</strong> AI-powered assistant that answers questions across textbook chapters and company policies.
                  Includes <strong>PDF & Markdown ingestion</strong>, <strong>semantic retrieval with ChromaDB</strong>, <strong>Hybrid Dense-BM25 Reranking</strong>,
                  <strong>LangGraph CRAG state machine</strong>, and <strong>strict refusal without inventing facts</strong> when answers are unavailable.
                </p>
                <div className="flex flex-wrap gap-2 pt-1 text-[11px] text-zinc-400">
                  <span className="px-2 py-0.5 rounded bg-zinc-800/80 border border-zinc-700/50">
                    Math (Linear Eq) Ch 1
                  </span>
                  <span className="px-2 py-0.5 rounded bg-zinc-800/80 border border-zinc-700/50">
                    Geography (Field Visit) Ch 1
                  </span>
                  <span className="px-2 py-0.5 rounded bg-zinc-800/80 border border-zinc-700/50">
                    History (Historiography) Ch 1
                  </span>
                  <span className="px-2 py-0.5 rounded bg-zinc-800/80 border border-zinc-700/50">
                    Cloud Security Policy
                  </span>
                  <span className="px-2 py-0.5 rounded bg-zinc-800/80 border border-zinc-700/50">
                    Engineering Handbook
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Query Input Section */}
        <section className="glass-panel rounded-2xl p-5 shadow-xl border border-zinc-800/80 space-y-4">
          <form onSubmit={handleExecuteQuery} className="space-y-3">
            <div className="relative flex items-center">
              <Search className="w-5 h-5 absolute left-4 text-zinc-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask any question across the chapter PDFs or policy documents..."
                className="w-full pl-12 pr-32 py-3.5 bg-zinc-900/90 border border-zinc-700/80 rounded-xl text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-normal"
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="absolute right-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Executing CRAG...</span>
                  </>
                ) : (
                  <>
                    <span>Run Query</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>

            {/* Presets Grid */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="font-medium text-zinc-300">Preset Evaluation Scenarios:</span>
                <span className="text-[11px] text-zinc-500">Click to load test query</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {PRESET_QUERIES.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setQuery(item.query)}
                      className="glass-card glass-card-hover p-2.5 rounded-xl text-left border border-zinc-800/80 flex items-start space-x-2.5 group"
                    >
                      <div className={`p-1.5 rounded-lg bg-zinc-800/80 ${item.color} mt-0.5`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-zinc-200 group-hover:text-indigo-300 transition-colors truncate">
                          {item.label}
                        </div>
                        <div className="text-[11px] text-zinc-400 line-clamp-1">
                          {item.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pipeline Fine-Tuning Controls */}
            <div className="pt-2 border-t border-zinc-800/60 flex flex-wrap items-center justify-between gap-4 text-xs text-zinc-400">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Sliders className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Top-K:</span>
                  <select
                    value={topK}
                    onChange={(e) => setTopK(Number(e.target.value))}
                    className="bg-zinc-900 border border-zinc-800 rounded px-2 py-0.5 text-zinc-200 font-mono text-xs focus:outline-none"
                  >
                    <option value={2}>2 chunks</option>
                    <option value={4}>4 chunks (Default)</option>
                    <option value={6}>6 chunks</option>
                    <option value={8}>8 chunks</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <span>Threshold:</span>
                  <input
                    type="range"
                    min="0.1"
                    max="0.8"
                    step="0.05"
                    value={similarityThreshold}
                    onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
                    className="w-20 accent-indigo-500 cursor-pointer"
                  />
                  <span className="font-mono text-zinc-300">{similarityThreshold}</span>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableWebSearch}
                    onChange={(e) => setEnableWebSearch(e.target.checked)}
                    className="rounded bg-zinc-900 border-zinc-700 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                  />
                  <span>Enable Corrective Web Search Fallback</span>
                </label>
              </div>
            </div>
          </form>
        </section>

        {/* Navigation Tabs */}
        <div className="flex border-b border-zinc-800 space-x-4">
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`pb-3 px-2 text-sm font-medium transition-all flex items-center space-x-2 border-b-2 ${
              activeTab === 'pipeline'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>CRAG Pipeline Execution</span>
          </button>

          <button
            onClick={() => setActiveTab('sources')}
            className={`pb-3 px-2 text-sm font-medium transition-all flex items-center space-x-2 border-b-2 ${
              activeTab === 'sources'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Retrieved Chunks & Reranking</span>
            {response?.sources?.length ? (
              <span className="ml-1.5 px-2 py-0.2 text-[11px] rounded-full bg-indigo-500/20 text-indigo-300 font-mono">
                {response.sources.length}
              </span>
            ) : null}
          </button>

          <button
            onClick={() => setActiveTab('documents')}
            className={`pb-3 px-2 text-sm font-medium transition-all flex items-center space-x-2 border-b-2 ${
              activeTab === 'documents'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Chapter Documents & Store</span>
            <span className="ml-1.5 px-2 py-0.2 text-[11px] rounded-full bg-zinc-800 text-zinc-400 font-mono">
              {documentStats.total_documents || 5}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('benchmarks')}
            className={`pb-3 px-2 text-sm font-medium transition-all flex items-center space-x-2 border-b-2 ${
              activeTab === 'benchmarks'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Evaluation Benchmark (12 Tests)</span>
          </button>
        </div>

        {/* Tab 1: CRAG Pipeline & Answer Visualizer */}
        {activeTab === 'pipeline' && (
          <div className="space-y-6">
            {/* Pipeline Execution Flow */}
            <div className="glass-panel rounded-2xl p-5 border border-zinc-800/80 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-indigo-400" />
                  <span className="text-sm font-semibold text-zinc-200">
                    LangGraph CRAG Execution Trace
                  </span>
                </div>
                {response && (
                  <div className="flex items-center space-x-3 text-xs">
                    <span className="text-zinc-400">
                      Total Latency:{' '}
                      <strong className="text-indigo-300 font-mono">
                        {response.total_latency_ms.toFixed(1)} ms
                      </strong>
                    </span>
                    <span className="text-zinc-400">
                      Confidence:{' '}
                      <strong
                        className={`font-mono ${
                          response.confidence_score > 0.8
                            ? 'text-emerald-400'
                            : response.confidence_score > 0.4
                            ? 'text-amber-400'
                            : 'text-zinc-400'
                        }`}
                      >
                        {(response.confidence_score * 100).toFixed(0)}%
                      </strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Execution Steps Flowchart */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                {/* 1. Retrieve */}
                <div
                  className={`p-3 rounded-xl border ${
                    response?.execution_steps?.find((s) => s.step_name === 'retrieve')
                      ? 'bg-zinc-900/90 border-indigo-500/40'
                      : 'bg-zinc-900/40 border-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-zinc-300">1. Vector Retrieve</span>
                    <Database className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <p className="text-[11px] text-zinc-400">ChromaDB Cosine Search</p>
                  {response?.execution_steps?.find((s) => s.step_name === 'retrieve') && (
                    <div className="mt-2 text-[11px] font-mono text-indigo-300 flex justify-between">
                      <span>
                        {response.execution_steps.find((s) => s.step_name === 'retrieve').details.candidates_retrieved ||
                          response.execution_steps.find((s) => s.step_name === 'retrieve').details.retrieved_count}{' '}
                        candidates
                      </span>
                      <span>
                        {response.execution_steps.find((s) => s.step_name === 'retrieve').duration_ms.toFixed(0)}ms
                      </span>
                    </div>
                  )}
                </div>

                {/* 2. Rerank */}
                <div
                  className={`p-3 rounded-xl border ${
                    response?.execution_steps?.find((s) => s.step_name === 'rerank')
                      ? 'bg-zinc-900/90 border-violet-500/40'
                      : 'bg-zinc-900/40 border-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-zinc-300">2. Hybrid Rerank</span>
                    <Layers className="w-3.5 h-3.5 text-violet-400" />
                  </div>
                  <p className="text-[11px] text-zinc-400">BM25 + Dense RRF</p>
                  {response?.execution_steps?.find((s) => s.step_name === 'rerank') && (
                    <div className="mt-2 text-[11px] font-mono text-violet-300 flex justify-between">
                      <span>
                        Top{' '}
                        {response.execution_steps.find((s) => s.step_name === 'rerank').details.retained_chunks || topK}
                      </span>
                      <span>
                        {response.execution_steps.find((s) => s.step_name === 'rerank').duration_ms.toFixed(0)}ms
                      </span>
                    </div>
                  )}
                </div>

                {/* 3. Document Grader */}
                <div
                  className={`p-3 rounded-xl border ${
                    response?.execution_steps?.find((s) => s.step_name === 'grade_documents')
                      ? 'bg-zinc-900/90 border-indigo-500/40'
                      : 'bg-zinc-900/40 border-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-zinc-300">3. Document Grader</span>
                    <FileCheck className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <p className="text-[11px] text-zinc-400">Relevance Evaluator</p>
                  {response?.execution_steps?.find((s) => s.step_name === 'grade_documents') && (
                    <div className="mt-2 text-[11px] font-mono text-indigo-300 flex justify-between">
                      <span>
                        {response.execution_steps.find((s) => s.step_name === 'grade_documents').details.relevant_count} rel /{' '}
                        {response.execution_steps.find((s) => s.step_name === 'grade_documents').details.irrelevant_count} irr
                      </span>
                      <span>
                        {response.execution_steps.find((s) => s.step_name === 'grade_documents').duration_ms.toFixed(0)}ms
                      </span>
                    </div>
                  )}
                </div>

                {/* 4. Corrective Search */}
                <div
                  className={`p-3 rounded-xl border ${
                    response?.web_search_used
                      ? 'bg-amber-950/30 border-amber-500/50'
                      : 'bg-zinc-900/40 border-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-zinc-300">4. Fallback Search</span>
                    <Globe className={`w-3.5 h-3.5 ${response?.web_search_used ? 'text-amber-400' : 'text-zinc-500'}`} />
                  </div>
                  <p className="text-[11px] text-zinc-400">DuckDuckGo / Tavily</p>
                  <div className="mt-2 text-[11px] font-mono">
                    {response?.web_search_used ? (
                      <span className="text-amber-400 font-semibold">Triggered (Fallback)</span>
                    ) : (
                      <span className="text-zinc-500">Skipped (Internal)</span>
                    )}
                  </div>
                </div>

                {/* 5. Generation */}
                <div
                  className={`p-3 rounded-xl border ${
                    response?.execution_steps?.find((s) => s.step_name === 'generate')
                      ? 'bg-zinc-900/90 border-indigo-500/40'
                      : 'bg-zinc-900/40 border-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-zinc-300">5. Synthesis</span>
                    <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <p className="text-[11px] text-zinc-400">Groq (gpt-oss-120b)</p>
                  {response?.execution_steps?.find((s) => s.step_name === 'generate') && (
                    <div className="mt-2 text-[11px] font-mono text-indigo-300 flex justify-between">
                      <span>Citations cited</span>
                      <span>
                        {response.execution_steps.find((s) => s.step_name === 'generate').duration_ms.toFixed(0)}ms
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Answer Display Section */}
            {response && (
              <div className="glass-panel rounded-2xl p-6 border border-zinc-800/80 space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-indigo-400" />
                    <span className="text-sm font-semibold text-zinc-200">
                      Grounded Answer with Citations
                    </span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <button
                      onClick={handleCopyAnswer}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/60 text-xs text-zinc-300 flex items-center space-x-1.5 transition-all"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-zinc-400" />
                          <span>Copy Answer</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Grounded Text Display */}
                <div className="prose prose-invert max-w-none text-sm text-zinc-200 leading-relaxed space-y-3 whitespace-pre-wrap font-sans">
                  {response.answer}
                </div>

                {/* Verification & Refusal Badges */}
                <div className="pt-4 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center space-x-2">
                    {response.confidence_score > 0.8 ? (
                      <span className="flex items-center space-x-1 text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>High Grounding Confidence</span>
                      </span>
                    ) : response.confidence_score === 0.0 ? (
                      <span className="flex items-center space-x-1 text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Unavailable in Corpus (Acknowledged & Refused)</span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1 text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
                        <Info className="w-3.5 h-3.5" />
                        <span>External Search Grounded</span>
                      </span>
                    )}
                  </div>

                  <div className="text-zinc-400 text-xs">
                    <span>Evidence Sources: </span>
                    <strong className="text-zinc-200">
                      {response.sources.filter((s) => s.relevance === 'relevant').length} relevant chunks cited
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Retrieved Chunks & Reranking */}
        {activeTab === 'sources' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-200">
                Retrieved Chunks & Grading Breakdown ({response?.sources?.length || 0})
              </h3>
              <span className="text-xs text-zinc-500">
                Sorted by Hybrid Dense + BM25 RRF score
              </span>
            </div>

            {response?.sources?.length ? (
              <div className="grid grid-cols-1 gap-4">
                {response.sources.map((chunk, index) => {
                  const isRelevant = chunk.relevance === 'relevant';
                  return (
                    <div
                      key={index}
                      className={`glass-panel rounded-xl p-4 border transition-all ${
                        isRelevant ? 'border-zinc-700/80' : 'border-zinc-800/40 opacity-70'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-2 mb-3">
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-zinc-800 text-zinc-200 font-mono">
                            #{index + 1}
                          </span>
                          <span className="text-xs font-medium text-zinc-200">
                            {chunk.source}
                          </span>
                          {chunk.metadata?.page_number && (
                            <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                              Page {chunk.metadata.page_number}
                            </span>
                          )}
                          {chunk.metadata?.section && chunk.metadata.section !== 'General' && (
                            <span className="text-[11px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                              {chunk.metadata.section}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-2 text-xs">
                          {chunk.metadata?.rrf_score && (
                            <span className="font-mono text-zinc-400">
                              RRF: <strong className="text-violet-400">{chunk.metadata.rrf_score}</strong>
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                              isRelevant
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-zinc-800 text-zinc-500'
                            }`}
                          >
                            {isRelevant ? 'Graded Relevant' : 'Graded Irrelevant'}
                          </span>
                        </div>
                      </div>

                      {/* Content excerpt */}
                      <p className="text-xs text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/60">
                        {chunk.content}
                      </p>

                      {chunk.grade_reason && (
                        <div className="mt-2 text-[11px] text-zinc-400 italic">
                          Grader note: {chunk.grade_reason}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="glass-panel rounded-2xl p-8 text-center text-zinc-400 border border-zinc-800">
                <Layers className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
                <p className="text-sm">No query executed yet or no chunks retrieved.</p>
                <p className="text-xs text-zinc-500 mt-1">Run a test query to inspect retrieved evidence.</p>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Chapter Documents & Knowledge Base */}
        {activeTab === 'documents' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-zinc-200">
                  Document Knowledge Base Catalog
                </h3>
                <p className="text-xs text-zinc-400">
                  PDF chapters and markdown policy documents indexed in persistent ChromaDB
                </p>
              </div>

              <button
                onClick={handleReindex}
                disabled={reindexing}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 flex items-center space-x-1.5 border border-zinc-700 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${reindexing ? 'animate-spin' : ''}`} />
                <span>{reindexing ? 'Re-indexing Documents...' : 'Re-index Collection'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {documentStats.documents.map((doc, idx) => (
                <div
                  key={idx}
                  className="glass-panel glass-card-hover rounded-xl p-4 border border-zinc-800/80 space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        {doc.type === 'pdf' ? (
                          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <BookOpen className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            <FileText className="w-4 h-4" />
                          </div>
                        )}
                        <div>
                          <span className="text-xs font-semibold text-zinc-200 line-clamp-1">
                            {doc.name}
                          </span>
                          <span className="text-[11px] text-zinc-400">
                            {doc.category || 'General Knowledge'}
                          </span>
                        </div>
                      </div>

                      <span className="text-[10px] px-2 py-0.5 rounded uppercase font-mono bg-zinc-800 text-zinc-300">
                        {doc.type}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-zinc-400 pt-2 border-t border-zinc-800/60">
                      <div>
                        Chunks: <strong className="text-indigo-300">{doc.chunks}</strong>
                      </div>
                      {doc.pages ? (
                        <div>
                          Pages: <strong className="text-zinc-200">{doc.pages}</strong>
                        </div>
                      ) : (
                        <div>
                          Size: <strong className="text-zinc-200">{doc.size_kb} KB</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (doc.name.includes('Linear_Equation')) {
                        setQuery("How do you solve simultaneous linear equations using Cramer's Rule, and what are D, Dx, and Dy?");
                      } else if (doc.name.includes('Field_Visit')) {
                        setQuery('What essential skills are needed for studying geography, and which two countries are compared in the textbook?');
                      } else if (doc.name.includes('Historiography')) {
                        setQuery('How can students access digital lessons via DIKSHA App, and who chaired the History Subject Committee?');
                      } else if (doc.name.includes('handbook')) {
                        setQuery("What is HireKiwi's response SLO and resolution target for SEV-1 incidents?");
                      } else {
                        setQuery('What are the encryption at rest standards and KMS key rotation requirements?');
                      }
                      setActiveTab('pipeline');
                    }}
                    className="w-full py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-[11px] font-medium text-zinc-300 border border-zinc-800 flex items-center justify-center space-x-1 transition-all"
                  >
                    <span>Load Chapter Question</span>
                    <ChevronRight className="w-3 h-3 text-zinc-500" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: Evaluation Benchmark */}
        {activeTab === 'benchmarks' && (
          <div className="glass-panel rounded-2xl p-6 border border-zinc-800/80 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-zinc-200">
                  Assessment Evaluation Benchmark Suite (12 Questions)
                </h3>
                <p className="text-xs text-zinc-400">
                  Evaluating Answer Quality & Grounding (30%), Retrieval (25%), Backend & Architecture (20%), Testing & Reliability (15%)
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-semibold">
                Passing Score: 70/100 (Target: 100%)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 font-mono">
                    <th className="py-2.5 px-3">ID</th>
                    <th className="py-2.5 px-3">Test Scenario</th>
                    <th className="py-2.5 px-3">Target Subject</th>
                    <th className="py-2.5 px-3">Expected Behavior</th>
                    <th className="py-2.5 px-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-sans">
                  {[
                    { id: 'TC-01', name: "Cramer's Rule & Determinants", sub: 'Math Ch 1 (PDF)', exp: 'Ground in Pages 23-24, Cite formulas', q: "How do you solve simultaneous linear equations using Cramer's Rule, and what are D, Dx, and Dy?" },
                    { id: 'TC-02', name: 'Graphical Method Coordinates', sub: 'Math Ch 1 (PDF)', exp: 'Ground in Page 7, cite ordered pairs', q: 'What is the graphical method for solving simultaneous linear equations?' },
                    { id: 'TC-03', name: 'Geography Field Study Skills', sub: 'Geography Ch 1 (PDF)', exp: 'Observation, perception, critical thinking', q: 'What essential skills are needed for studying geography according to the textbook?' },
                    { id: 'TC-04', name: 'India and Brazil Comparison', sub: 'Geography Ch 1 (PDF)', exp: 'Ground in Page 8 preface', q: 'Which two countries are compared in the Standard 10 Geography textbook?' },
                    { id: 'TC-05', name: 'DIKSHA App Digital Textbook', sub: 'History Ch 1 (PDF)', exp: 'QR code access for audio-visual material', q: 'How can students access digital lessons via the DIKSHA App?' },
                    { id: 'TC-06', name: 'History Subject Committee', sub: 'History Ch 1 (PDF)', exp: 'Chairman Dr Sadanand More, Members', q: 'Who are the members of the History Subject Committee and authors listed in the textbook?' },
                    { id: 'TC-07', name: 'Multi-Evidence Committee Synthesis', sub: 'Multi-Doc Synthesis', exp: 'Synthesize details across Math & History', q: 'Compare the textbook publication details, committees, and approval years across the Mathematics and History textbooks.' },
                    { id: 'TC-08', name: 'SEV-1 On-Call SLOs', sub: 'Engineering Handbook', exp: '15 min response, 2 hr resolution', q: "What is HireKiwi's response SLO and resolution target for SEV-1 incidents?" },
                    { id: 'TC-09', name: 'KMS Encryption Standards', sub: 'Cloud Security Policy', exp: 'AES-256, annual key rotation', q: 'What are the encryption at rest standards and KMS key rotation requirements?' },
                    { id: 'TC-10', name: 'Refusal: Chocolate Cake Recipe', sub: 'Unanswerable (Refusal)', exp: 'Acknowledge missing info, state unavailable', q: 'What is the secret recipe for dark chocolate lava cake according to the textbook?' },
                    { id: 'TC-11', name: 'Refusal: Q3 2025 Revenue', sub: 'Unanswerable (Refusal)', exp: 'Zero hallucination refusal', q: 'What were the quarterly revenue numbers of HireKiwi in Q3 2025?' },
                    { id: 'TC-12', name: 'Corrective Search: Python 3.12', sub: 'External Fallback', exp: 'Trigger search fallback, synthesize external answer', q: 'What are the latest features released in Python 3.12?' },
                  ].map((tc, idx) => (
                    <tr key={idx} className="hover:bg-zinc-900/40">
                      <td className="py-2.5 px-3 font-mono font-semibold text-indigo-400">{tc.id}</td>
                      <td className="py-2.5 px-3 font-medium text-zinc-200">{tc.name}</td>
                      <td className="py-2.5 px-3 text-zinc-400">{tc.sub}</td>
                      <td className="py-2.5 px-3 text-zinc-300 font-mono text-[11px]">{tc.exp}</td>
                      <td className="py-2.5 px-3">
                        <button
                          onClick={() => {
                            setQuery(tc.q);
                            setActiveTab('pipeline');
                          }}
                          className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-indigo-300 font-medium text-[11px] border border-zinc-700 transition-colors"
                        >
                          Run Test
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 bg-[#0c101c]/90 py-4 text-center text-xs text-zinc-500 font-sans">
        HireKiwi Corrective RAG (CRAG) Production System &bull; LangGraph State Machine &bull; Persistent ChromaDB &bull; Groq LPUs
      </footer>
    </div>
  );
}
