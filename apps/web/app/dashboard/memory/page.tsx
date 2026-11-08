'use client';

import React, { useState } from 'react';
import { MemoryCategory, MemoryImportance, MemoryStatus } from '@bhuvi/shared';
import { useMemory } from '../../../lib/use-memory';
import {
  MemoryIcon,
  SearchIcon,
  RefreshIcon,
  TrashIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  ClockIcon,
  SparklesIcon,
} from '../../../components/ui/icons';

const CATEGORIES: MemoryCategory[] = [
  'PERSONAL',
  'PROJECT',
  'EDUCATION',
  'WORK',
  'BUSINESS',
  'IMPORTANT_EVENTS',
  'NOTES',
  'CONVERSATION',
];

const IMPORTANCES: MemoryImportance[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export default function MemoryDashboardPage() {
  const {
    memories,
    activeMemory,
    stats,
    searchResults,
    askResult,
    isLoading,
    isSearching,
    isAsking,
    isSaving,
    error,
    filters,
    setFilters,
    createMemory,
    updateMemory,
    deleteMemory,
    reprocessMemory,
    selectMemory,
    searchMemories,
    askQuestion,
    clearAskResult,
    clearSearchResults,
    refresh,
  } = useMemory();

  // Tab switcher
  const [activeTab, setActiveTab] = useState<'memories' | 'search' | 'ask'>('memories');

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState<MemoryCategory>('PERSONAL');
  const [formImportance, setFormImportance] = useState<MemoryImportance>('MEDIUM');
  const [formTags, setFormTags] = useState('');

  // Semantic search input
  const [searchQuery, setSearchQuery] = useState('');
  const [searchThreshold, setSearchThreshold] = useState(0.45);

  // RAG ask input
  const [askQuery, setAskQuery] = useState('');

  const handleOpenCreateModal = () => {
    setIsEditing(false);
    setFormTitle('');
    setFormContent('');
    setFormCategory('PERSONAL');
    setFormImportance('MEDIUM');
    setFormTags('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = () => {
    if (!activeMemory) return;
    setIsEditing(true);
    setFormTitle(activeMemory.title);
    setFormContent(activeMemory.content);
    setFormCategory(activeMemory.category);
    setFormImportance(activeMemory.importance);
    setFormTags(activeMemory.tags ? activeMemory.tags.join(', ') : '');
    setIsModalOpen(true);
  };

  const handleSaveMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim()) return;

    const tagsArray = formTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (isEditing && activeMemory) {
      await updateMemory(activeMemory.id, {
        title: formTitle.trim(),
        content: formContent.trim(),
        category: formCategory,
        importance: formImportance,
        tags: tagsArray,
      });
    } else {
      await createMemory({
        title: formTitle.trim(),
        content: formContent.trim(),
        category: formCategory,
        importance: formImportance,
        tags: tagsArray,
      });
    }

    setIsModalOpen(false);
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    await searchMemories(searchQuery, { threshold: searchThreshold });
  };

  const handleAskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!askQuery.trim()) return;
    await askQuestion(askQuery);
  };

  const getCategoryBadgeClass = (category: MemoryCategory) => {
    switch (category) {
      case 'PERSONAL':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'PROJECT':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'WORK':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'EDUCATION':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'BUSINESS':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'IMPORTANT_EVENTS':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'CONVERSATION':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'NOTES':
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const getImportanceBadgeClass = (importance: MemoryImportance) => {
    switch (importance) {
      case 'CRITICAL':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'HIGH':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'MEDIUM':
        return 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20';
      case 'LOW':
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const getStatusBadge = (status: MemoryStatus) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircleIcon className="w-3.5 h-3.5" /> Indexed
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <ClockIcon className="w-3.5 h-3.5 animate-spin" /> Vectorizing
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangleIcon className="w-3.5 h-3.5" /> Failed
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
            <ClockIcon className="w-3.5 h-3.5" /> Queued
          </span>
        );
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-950 text-white min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-inner">
              <MemoryIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                Personal Memory &amp; Knowledge System
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30">
                  RAG + Embeddings
                </span>
              </h1>
              <p className="text-sm text-gray-400">
                Local-first long-term memory engine with PostgreSQL vector storage &amp; Ollama
                Nomics embeddings.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => void refresh()}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-900 border border-white/10 text-gray-300 hover:text-white hover:bg-gray-800 transition-colors text-sm font-medium disabled:opacity-50"
            >
              <RefreshIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Sync
            </button>
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bhuvi-gradient text-white text-sm font-semibold shadow-lg shadow-purple-500/20 hover:opacity-95 transition-opacity"
            >
              + Add Memory
            </button>
          </div>
        </div>

        {/* Global Error Notice */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-start gap-3">
            <AlertTriangleIcon className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Memory Operation Notice</p>
              <p className="text-xs mt-0.5 text-rose-400/90">{error}</p>
            </div>
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-gray-900/60 border border-white/5 space-y-1">
            <div className="text-xs font-medium text-gray-400">Total Memories</div>
            <div className="text-2xl font-black text-white">{stats?.totalMemories ?? 0}</div>
            <div className="text-xs text-purple-400 font-medium">Stored in PostgreSQL</div>
          </div>
          <div className="p-4 rounded-2xl bg-gray-900/60 border border-white/5 space-y-1">
            <div className="text-xs font-medium text-gray-400">Indexed Chunks</div>
            <div className="text-2xl font-black text-white">{stats?.totalChunks ?? 0}</div>
            <div className="text-xs text-cyan-400 font-medium">Dense Vector Embeddings</div>
          </div>
          <div className="p-4 rounded-2xl bg-gray-900/60 border border-white/5 space-y-1">
            <div className="text-xs font-medium text-gray-400">Active Status</div>
            <div className="text-2xl font-black text-emerald-400">
              {stats?.completedMemories ?? 0}
            </div>
            <div className="text-xs text-emerald-400/80 font-medium">Ready for RAG Recall</div>
          </div>
          <div className="p-4 rounded-2xl bg-gray-900/60 border border-white/5 space-y-1">
            <div className="text-xs font-medium text-gray-400">Pending / Processing</div>
            <div className="text-2xl font-black text-amber-400">{stats?.pendingMemories ?? 0}</div>
            <div className="text-xs text-amber-400/80 font-medium">BullMQ Worker Pipeline</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
          <button
            onClick={() => setActiveTab('memories')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 ${
              activeTab === 'memories'
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-900'
            }`}
          >
            <MemoryIcon className="w-4 h-4" />
            Knowledge Base ({memories.length})
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 ${
              activeTab === 'search'
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-900'
            }`}
          >
            <SearchIcon className="w-4 h-4" />
            Vector Search
          </button>
          <button
            onClick={() => setActiveTab('ask')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 ${
              activeTab === 'ask'
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-900'
            }`}
          >
            <SparklesIcon className="w-4 h-4 text-amber-400" />
            Ask BHUVI (RAG)
          </button>
        </div>

        {/* TAB 1: MEMORIES LIST & DETAILS */}
        {activeTab === 'memories' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Filter & List */}
            <div className="lg:col-span-5 space-y-4">
              {/* Search & Category Filter */}
              <div className="p-3 rounded-2xl bg-gray-900/60 border border-white/5 space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Filter memories by keyword…"
                    value={filters.search ?? ''}
                    onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                    className="w-full pl-9 pr-3 py-2 bg-gray-950 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                  <SearchIcon className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
                  <button
                    onClick={() => setFilters((f) => ({ ...f, category: undefined }))}
                    className={`px-2.5 py-1 rounded-lg shrink-0 font-medium ${
                      !filters.category
                        ? 'bg-white/10 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    All
                  </button>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() =>
                        setFilters((f) => ({
                          ...f,
                          category: f.category === cat ? undefined : cat,
                        }))
                      }
                      className={`px-2.5 py-1 rounded-lg shrink-0 font-medium border ${
                        filters.category === cat
                          ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                          : 'border-white/5 text-gray-400 hover:text-white'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Memory List Cards */}
              <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
                {isLoading && memories.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 text-sm">
                    Loading personal memories…
                  </div>
                ) : memories.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl bg-gray-900/40 border border-white/5 text-gray-400 space-y-3">
                    <MemoryIcon className="w-8 h-8 text-gray-600 mx-auto" />
                    <p className="text-sm">No memories recorded yet.</p>
                    <button
                      onClick={handleOpenCreateModal}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 text-xs font-semibold text-white"
                    >
                      Create First Memory
                    </button>
                  </div>
                ) : (
                  memories.map((mem) => {
                    const isSelected = activeMemory?.id === mem.id;
                    return (
                      <div
                        key={mem.id}
                        onClick={() => void selectMemory(mem.id)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-purple-950/20 border-purple-500/40 shadow-lg shadow-purple-500/5'
                            : 'bg-gray-900/50 border-white/5 hover:border-white/10 hover:bg-gray-900/80'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-sm text-white line-clamp-1">
                            {mem.title}
                          </h3>
                          {getStatusBadge(mem.status)}
                        </div>
                        <p className="text-xs text-gray-400 line-clamp-2 mt-1.5 leading-relaxed">
                          {mem.content}
                        </p>
                        <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-white/5 text-xs text-gray-500">
                          <span
                            className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${getCategoryBadgeClass(
                              mem.category,
                            )}`}
                          >
                            {mem.category}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${getImportanceBadgeClass(
                              mem.importance,
                            )}`}
                          >
                            {mem.importance}
                          </span>
                          <span className="ml-auto text-[11px] text-gray-400 font-medium">
                            {mem.chunksCount ?? 0} {mem.chunksCount === 1 ? 'chunk' : 'chunks'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Column: Detailed View */}
            <div className="lg:col-span-7">
              {activeMemory ? (
                <div className="p-6 rounded-2xl bg-gray-900/70 border border-white/10 space-y-6">
                  {/* Detail Header */}
                  <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/10">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full border text-xs font-semibold ${getCategoryBadgeClass(
                            activeMemory.category,
                          )}`}
                        >
                          {activeMemory.category}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full border text-xs font-semibold ${getImportanceBadgeClass(
                            activeMemory.importance,
                          )}`}
                        >
                          {activeMemory.importance}
                        </span>
                        {getStatusBadge(activeMemory.status)}
                      </div>
                      <h2 className="text-xl font-bold text-white mt-2">{activeMemory.title}</h2>
                      <div className="text-xs text-gray-500">
                        Added: {new Date(activeMemory.createdAt).toLocaleString()} • Source:{' '}
                        {activeMemory.source}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleOpenEditModal}
                        className="px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-medium text-gray-200 border border-white/10 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => void reprocessMemory(activeMemory.id)}
                        title="Re-chunk and generate fresh vector embeddings"
                        className="px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-medium text-cyan-300 border border-cyan-500/20 transition-colors"
                      >
                        Re-Index
                      </button>
                      <button
                        onClick={() => void deleteMemory(activeMemory.id)}
                        className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Tags */}
                  {activeMemory.tags && activeMemory.tags.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-gray-500 font-medium">Tags:</span>
                      {activeMemory.tags.map((t) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-xs text-gray-300 font-mono"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Content */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                      Memory Text Content
                    </h4>
                    <div className="p-4 rounded-xl bg-gray-950 border border-white/5 text-sm text-gray-200 whitespace-pre-wrap leading-relaxed font-sans">
                      {activeMemory.content}
                    </div>
                  </div>

                  {/* Chunks and Vector Embeddings Inspection */}
                  <div className="space-y-3 pt-2 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                        Vector Chunks ({activeMemory.chunks?.length ?? 0})
                      </h4>
                      <span className="text-xs text-purple-400 font-mono">
                        Model: {activeMemory.chunks?.[0]?.modelName ?? 'nomic-embed-text'} (
                        {activeMemory.chunks?.[0]?.dimensions ?? 768}-dim)
                      </span>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {activeMemory.chunks && activeMemory.chunks.length > 0 ? (
                        activeMemory.chunks.map((chk) => (
                          <div
                            key={chk.id}
                            className="p-3 rounded-xl bg-gray-950/80 border border-white/5 text-xs space-y-1.5"
                          >
                            <div className="flex items-center justify-between text-gray-400">
                              <span className="font-semibold text-purple-300">
                                Chunk #{chk.chunkIndex + 1}
                              </span>
                              <span>
                                {chk.tokenCount} tokens • {chk.dimensions} dims
                              </span>
                            </div>
                            <p className="text-gray-300 leading-relaxed font-mono text-[11px]">
                              {chk.content}
                            </p>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-gray-500 italic p-3">
                          No vector chunks generated yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full min-h-[400px] flex flex-col items-center justify-center p-8 rounded-2xl bg-gray-900/40 border border-white/5 text-center space-y-3">
                  <MemoryIcon className="w-12 h-12 text-gray-700" />
                  <h3 className="font-semibold text-base text-gray-300">No Memory Selected</h3>
                  <p className="text-sm text-gray-500 max-w-sm">
                    Select a memory from the left list to inspect its content, tags, and vector
                    embeddings, or create a new memory.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: SEMANTIC VECTOR SEARCH */}
        {activeTab === 'search' && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-gray-900/70 border border-white/10 space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <SearchIcon className="w-5 h-5 text-purple-400" />
                Dense Vector Cosine Similarity Search
              </h2>
              <p className="text-xs text-gray-400 max-w-2xl">
                Test your knowledge retrieval using raw semantic vector matching. Your search query
                is converted into an embedding using Ollama and ranked against all stored chunk
                vectors.
              </p>

              <form onSubmit={handleSearchSubmit} className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Enter natural language query (e.g. WiFi password, database port, roadmap deadline)…"
                    className="flex-1 px-4 py-3 bg-gray-950 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="submit"
                    disabled={isSearching || !searchQuery.trim()}
                    className="px-6 py-3 rounded-xl bhuvi-gradient text-white text-sm font-semibold shadow-lg shadow-purple-500/20 disabled:opacity-50"
                  >
                    {isSearching ? 'Searching…' : 'Semantic Search'}
                  </button>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>Cosine Similarity Threshold: {(searchThreshold * 100).toFixed(0)}%</span>
                  <input
                    type="range"
                    min="0.2"
                    max="0.8"
                    step="0.05"
                    value={searchThreshold}
                    onChange={(e) => setSearchThreshold(parseFloat(e.target.value))}
                    className="w-40 accent-purple-500"
                  />
                  {searchResults.length > 0 && (
                    <button
                      type="button"
                      onClick={clearSearchResults}
                      className="text-gray-500 hover:text-gray-300 underline ml-auto"
                    >
                      Clear results
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Results */}
            <div className="space-y-3">
              {isSearching ? (
                <div className="p-8 text-center text-sm text-gray-400">
                  Computing query embedding and searching vector chunks…
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Found {searchResults.length} matching memory chunks
                  </div>
                  {searchResults.map((res, i) => (
                    <div
                      key={res.chunkId}
                      className="p-5 rounded-2xl bg-gray-900/60 border border-white/5 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-400">#{i + 1}</span>
                          <h4 className="font-bold text-sm text-white">{res.title}</h4>
                          <span
                            className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${getCategoryBadgeClass(
                              res.category,
                            )}`}
                          >
                            {res.category}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 font-mono text-xs font-bold">
                            {(res.similarity * 100).toFixed(1)}% Match
                          </span>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-gray-950 border border-white/5 text-xs text-gray-300 leading-relaxed font-sans">
                        {res.chunkContent}
                      </div>

                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>Source: {res.source}</span>
                        <button
                          onClick={() => {
                            void selectMemory(res.memoryId);
                            setActiveTab('memories');
                          }}
                          className="text-purple-400 hover:text-purple-300 font-medium"
                        >
                          View Full Memory →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : searchQuery && !isSearching ? (
                <div className="p-8 text-center rounded-2xl bg-gray-900/40 border border-white/5 text-gray-500 text-sm">
                  No memory chunks exceeded the {(searchThreshold * 100).toFixed(0)}% similarity
                  threshold for your query.
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* TAB 3: ASK BHUVI (RAG) */}
        {activeTab === 'ask' && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-gray-900/70 border border-white/10 space-y-4">
              <div className="flex items-center gap-2">
                <SparklesIcon className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-bold text-white">Ask BHUVI (Personal Knowledge RAG)</h2>
              </div>
              <p className="text-xs text-gray-400 max-w-2xl">
                Ask natural language questions about yourself, your projects, or your stored
                memories. BHUVI uses vector search to retrieve grounded facts and generates an
                honest, citation-backed answer using local Ollama (qwen2.5:3b).
              </p>

              <form onSubmit={handleAskSubmit} className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={askQuery}
                    onChange={(e) => setAskQuery(e.target.value)}
                    placeholder="Ask anything about your stored knowledge (e.g., What is my WiFi password?)…"
                    className="flex-1 px-4 py-3 bg-gray-950 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="submit"
                    disabled={isAsking || !askQuery.trim()}
                    className="px-6 py-3 rounded-xl bhuvi-gradient text-white text-sm font-semibold shadow-lg shadow-purple-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isAsking ? (
                      <>
                        <ClockIcon className="w-4 h-4 animate-spin" /> Thinking…
                      </>
                    ) : (
                      'Ask BHUVI'
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* RAG Answer Display */}
            {askResult && (
              <div className="p-6 rounded-2xl bg-purple-950/20 border border-purple-500/30 space-y-5">
                <div className="flex items-center justify-between border-b border-purple-500/20 pb-4">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">
                      Question
                    </span>
                    <h3 className="text-base font-bold text-white">{askResult.question}</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 font-mono">
                      {(askResult.confidence * 100).toFixed(0)}% Confidence
                    </span>
                    <span className="text-xs text-gray-500 font-mono">
                      {askResult.durationMs}ms
                    </span>
                    <button
                      onClick={clearAskResult}
                      className="text-xs text-gray-400 hover:text-white"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Grounded Answer */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Grounded Answer
                  </span>
                  <div className="p-4 rounded-xl bg-gray-950/80 border border-white/10 text-sm text-gray-100 leading-relaxed font-sans whitespace-pre-wrap">
                    {askResult.answer}
                  </div>
                </div>

                {/* Cited Sources */}
                {askResult.sources.length > 0 && (
                  <div className="space-y-2.5 pt-2">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Retrieved Memory Sources ({askResult.sources.length})
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {askResult.sources.map((src) => (
                        <div
                          key={src.memoryId}
                          className="p-3.5 rounded-xl bg-gray-950/60 border border-white/5 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-white line-clamp-1">
                              {src.title}
                            </span>
                            <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                              {(src.relevanceScore * 100).toFixed(0)}% relevance
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400 line-clamp-2 italic">
                            &ldquo;{src.snippet}&rdquo;
                          </p>
                          <div className="flex justify-end">
                            <button
                              onClick={() => {
                                void selectMemory(src.memoryId);
                                setActiveTab('memories');
                              }}
                              className="text-[11px] text-purple-400 hover:text-purple-300 font-medium"
                            >
                              Open Memory →
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Modal: Add / Edit Memory */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-gray-900 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <h3 className="text-lg font-bold text-white">
                  {isEditing ? 'Edit Memory' : 'Create New Personal Memory'}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-white text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveMemory} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Home WiFi Details, Project Roadmap, Passport Info…"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-950 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Category *
                    </label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as MemoryCategory)}
                      className="w-full px-3.5 py-2.5 bg-gray-950 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Importance
                    </label>
                    <select
                      value={formImportance}
                      onChange={(e) => setFormImportance(e.target.value as MemoryImportance)}
                      className="w-full px-3.5 py-2.5 bg-gray-950 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500"
                    >
                      {IMPORTANCES.map((imp) => (
                        <option key={imp} value={imp}>
                          {imp}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. wifi, personal, credentials, project-x"
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-950 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Content *
                  </label>
                  <textarea
                    required
                    rows={6}
                    placeholder="Detailed memory content, instructions, facts, or reference notes. BHUVI will split this into semantic chunks and generate vector embeddings…"
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-950 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 font-sans"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-gray-800 text-gray-300 text-sm font-medium hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || !formTitle.trim() || !formContent.trim()}
                    className="px-5 py-2 rounded-xl bhuvi-gradient text-white text-sm font-semibold shadow-lg shadow-purple-500/20 disabled:opacity-50"
                  >
                    {isSaving
                      ? 'Processing & Vectorizing…'
                      : isEditing
                        ? 'Save Changes'
                        : 'Create & Index'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
