'use client';

import React, { useState } from 'react';
import {
  MessageCategory,
  MessagePriority,
  MessageUrgency,
  MessageProcessingStatus,
  MessageAnalysisResult,
  ActionItemStatus,
} from '@bhuvi/shared';
import { useMessages } from '../../../lib/use-messages';
import {
  MessagesIcon,
  SearchIcon,
  RefreshIcon,
  TrashIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  ClockIcon,
  SparklesIcon,
} from '../../../components/ui/icons';

const CATEGORIES: MessageCategory[] = [
  'PERSONAL',
  'WORK',
  'EDUCATION',
  'FINANCIAL',
  'BUSINESS',
  'SOCIAL',
  'PROMOTIONAL',
  'TRANSACTIONAL',
  'NOTIFICATION',
  'OTHER',
];

const PRIORITIES: MessagePriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const URGENCIES: MessageUrgency[] = ['URGENT', 'TIME_SENSITIVE', 'NORMAL', 'NONE'];

export default function MessagesDashboardPage() {
  const {
    messages,
    activeMessage,
    stats,
    isLoading,
    isSubmitting,
    error,
    filters,
    setFilters,
    createMessage,
    analyzePreview,
    analyzeExistingMessage,
    updateActionItemStatus,
    deleteMessage,
    selectMessage,
    refresh,
  } = useMessages();

  // Tab switcher
  const [activeTab, setActiveTab] = useState<'feed' | 'playground'>('feed');

  // Manual message form
  const [senderName, setSenderName] = useState('');
  const [senderIdentifier, setSenderIdentifier] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [previewResult, setPreviewResult] = useState<MessageAnalysisResult | null>(null);

  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    const res = await analyzePreview({
      content,
      senderName: senderName || undefined,
      subject: subject || undefined,
    });
    if (res) {
      setPreviewResult(res);
    }
  };

  const handleSaveAndAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !senderName.trim()) return;
    const created = await createMessage({
      senderName,
      senderIdentifier: senderIdentifier || undefined,
      subject: subject || undefined,
      content,
      autoAnalyze: true,
    });
    if (created) {
      setContent('');
      setSubject('');
      setPreviewResult(null);
      setActiveTab('feed');
    }
  };

  const getPriorityBadgeClass = (priority: MessagePriority) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-red-500/20 text-red-400 border border-red-500/30';
      case 'HIGH':
        return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
      case 'MEDIUM':
        return 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
      case 'LOW':
        return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      default:
        return 'bg-gray-800 text-gray-400';
    }
  };

  const getUrgencyBadgeClass = (urgency: MessageUrgency) => {
    switch (urgency) {
      case 'URGENT':
        return 'bg-rose-500/20 text-rose-300 border border-rose-500/30';
      case 'TIME_SENSITIVE':
        return 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30';
      case 'NORMAL':
        return 'bg-blue-500/20 text-blue-300 border border-blue-500/30';
      default:
        return 'bg-gray-800 text-gray-500';
    }
  };

  const getCategoryBadgeClass = (cat: MessageCategory) => {
    switch (cat) {
      case 'FINANCIAL':
        return 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50';
      case 'WORK':
        return 'bg-indigo-950/60 text-indigo-400 border-indigo-800/50';
      case 'NOTIFICATION':
        return 'bg-purple-950/60 text-purple-400 border-purple-800/50';
      case 'PROMOTIONAL':
        return 'bg-pink-950/60 text-pink-400 border-pink-800/50';
      case 'PERSONAL':
        return 'bg-sky-950/60 text-sky-400 border-sky-800/50';
      default:
        return 'bg-gray-900 text-gray-400 border-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-bhuvi-500/10 border border-bhuvi-500/20 text-bhuvi-400 shadow-inner">
              <MessagesIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Message Intelligence
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  Module 07
                </span>
              </h1>
              <p className="text-sm text-gray-400">
                Local-first AI analysis, classification, priority extraction, and action detection
              </p>
            </div>
          </div>
        </div>

        {/* Tab & Refresh Bar */}
        <div className="flex items-center gap-3">
          <div className="flex p-1 bg-gray-900/80 border border-white/5 rounded-xl">
            <button
              onClick={() => setActiveTab('feed')}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'feed'
                  ? 'bg-bhuvi-600 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Message Feed
            </button>
            <button
              onClick={() => setActiveTab('playground')}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'playground'
                  ? 'bg-bhuvi-600 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <SparklesIcon className="w-3.5 h-3.5" />
              AI Analyzer
            </button>
          </div>

          <button
            onClick={() => refresh()}
            disabled={isLoading}
            className="p-2 rounded-xl bg-gray-900/60 border border-white/5 text-gray-400 hover:text-white hover:bg-gray-800 transition"
            title="Refresh Messages"
          >
            <RefreshIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
          <AlertTriangleIcon className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Top Stat Cards (Section 12.A) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl bg-gray-900/40 border border-white/5 backdrop-blur-xl">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total</span>
          <p className="text-2xl font-bold text-white mt-1">{stats?.totalMessages ?? 0}</p>
          <span className="text-[10px] text-gray-500">All ingested messages</span>
        </div>
        <div className="p-4 rounded-xl bg-gray-900/40 border border-white/5 backdrop-blur-xl">
          <span className="text-xs font-medium text-red-400 uppercase tracking-wider">
            High Priority
          </span>
          <p className="text-2xl font-bold text-red-400 mt-1">{stats?.highPriorityCount ?? 0}</p>
          <span className="text-[10px] text-gray-500">Critical & High</span>
        </div>
        <div className="p-4 rounded-xl bg-gray-900/40 border border-white/5 backdrop-blur-xl">
          <span className="text-xs font-medium text-amber-400 uppercase tracking-wider">
            Urgent
          </span>
          <p className="text-2xl font-bold text-amber-300 mt-1">{stats?.urgentCount ?? 0}</p>
          <span className="text-[10px] text-gray-500">Time-sensitive</span>
        </div>
        <div className="p-4 rounded-xl bg-gray-900/40 border border-white/5 backdrop-blur-xl">
          <span className="text-xs font-medium text-bhuvi-400 uppercase tracking-wider">
            Requires Action
          </span>
          <p className="text-2xl font-bold text-bhuvi-300 mt-1">
            {stats?.requiresActionCount ?? 0}
          </p>
          <span className="text-[10px] text-gray-500">Has actionable items</span>
        </div>
        <div className="p-4 rounded-xl bg-gray-900/40 border border-white/5 backdrop-blur-xl col-span-2 md:col-span-1">
          <span className="text-xs font-medium text-purple-400 uppercase tracking-wider">
            Requires Reply
          </span>
          <p className="text-2xl font-bold text-purple-300 mt-1">
            {stats?.requiresReplyCount ?? 0}
          </p>
          <span className="text-[10px] text-gray-500">Replies requested</span>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'playground' ? (
        /* Manual Message Analyzer Playground (Section 12.E) */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl bg-gray-900/40 border border-white/5 backdrop-blur-xl space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <SparklesIcon className="w-5 h-5 text-bhuvi-400" />
              Manual Message Submission & AI Testing
            </h2>
            <p className="text-xs text-gray-400">
              Submit or paste any email, chat message, or notification to test local AI intelligence
              extraction.
            </p>

            <form className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Sender Name *
                  </label>
                  <input
                    type="text"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full px-3 py-2 rounded-xl bg-gray-950/60 border border-white/10 text-white text-sm focus:border-bhuvi-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Sender Identifier
                  </label>
                  <input
                    type="text"
                    value={senderIdentifier}
                    onChange={(e) => setSenderIdentifier(e.target.value)}
                    placeholder="e.g. sarah@company.com"
                    className="w-full px-3 py-2 rounded-xl bg-gray-950/60 border border-white/10 text-white text-sm focus:border-bhuvi-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Subject (optional)
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Urgent review needed for Q4 Deliverable"
                  className="w-full px-3 py-2 rounded-xl bg-gray-950/60 border border-white/10 text-white text-sm focus:border-bhuvi-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Message Content *
                </label>
                <textarea
                  rows={5}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Paste untrusted message text here... Prompt injection defense is active."
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-950/60 border border-white/10 text-white text-sm focus:border-bhuvi-500 focus:outline-none resize-none font-mono text-xs"
                  required
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={isSubmitting || !content.trim()}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium border border-white/10 transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Analyzing...' : 'Preview Live Analysis'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndAnalyze}
                  disabled={isSubmitting || !content.trim() || !senderName.trim()}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-bhuvi-600 to-indigo-600 hover:from-bhuvi-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg transition disabled:opacity-50"
                >
                  Save & Ingest Message
                </button>
              </div>
            </form>
          </div>

          {/* Preview Panel */}
          <div className="p-6 rounded-2xl bg-gray-900/40 border border-white/5 backdrop-blur-xl">
            <h3 className="text-sm font-semibold text-white mb-3">Live Intelligence Preview</h3>
            {previewResult ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${getCategoryBadgeClass(previewResult.category)}`}
                  >
                    {previewResult.category}
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${getPriorityBadgeClass(previewResult.priority)}`}
                  >
                    Priority: {previewResult.priority}
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${getUrgencyBadgeClass(previewResult.urgency)}`}
                  >
                    Urgency: {previewResult.urgency}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-800 text-gray-300 border border-gray-700">
                    Intent: {previewResult.intent}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-[10px] font-mono uppercase text-gray-500 block mb-1">
                    AI Summary
                  </span>
                  <p className="text-xs text-gray-200 leading-relaxed">{previewResult.summary}</p>
                </div>

                {previewResult.priorityExplanation && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                    <strong>Priority Justification:</strong> {previewResult.priorityExplanation}
                  </div>
                )}

                {previewResult.actionItems.length > 0 && (
                  <div>
                    <span className="text-xs font-semibold text-white block mb-2">
                      Extracted Action Items ({previewResult.actionItems.length})
                    </span>
                    <div className="space-y-1.5">
                      {previewResult.actionItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg bg-gray-950/60 border border-white/5 text-xs text-gray-300 flex items-center justify-between"
                        >
                          <span>{item.title}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded ${getPriorityBadgeClass(item.priority)}`}
                          >
                            {item.priority}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {previewResult.entities.length > 0 && (
                  <div>
                    <span className="text-xs font-semibold text-white block mb-1.5">
                      Extracted Entities
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {previewResult.entities.map((ent, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded text-[11px] bg-gray-800 text-gray-300 border border-gray-700"
                        >
                          {ent.type}: {ent.value}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-white/10 rounded-xl">
                <SparklesIcon className="w-8 h-8 text-gray-600 mb-2" />
                <p className="text-xs text-gray-400">
                  Fill in the message form and click &quot;Preview Live Analysis&quot; to inspect
                  Ollama inference
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Message Feed & Split View (Section 12.B, C, D) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Filter Bar & Message List (Section 12.B & 12.D) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Filters */}
            <div className="p-3.5 rounded-2xl bg-gray-900/40 border border-white/5 space-y-3">
              <div className="relative">
                <SearchIcon className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
                <input
                  type="text"
                  value={filters.search || ''}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, search: e.target.value || undefined }))
                  }
                  placeholder="Search sender, subject, content..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-gray-950/60 border border-white/5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-bhuvi-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <select
                  value={filters.category || ''}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      category: (e.target.value as MessageCategory) || undefined,
                    }))
                  }
                  className="px-2 py-1 rounded-lg bg-gray-950/60 border border-white/5 text-xs text-gray-300 focus:outline-none"
                >
                  <option value="">All Categories</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <select
                  value={filters.priority || ''}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      priority: (e.target.value as MessagePriority) || undefined,
                    }))
                  }
                  className="px-2 py-1 rounded-lg bg-gray-950/60 border border-white/5 text-xs text-gray-300 focus:outline-none"
                >
                  <option value="">All Priorities</option>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>

                <select
                  value={filters.urgency || ''}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      urgency: (e.target.value as MessageUrgency) || undefined,
                    }))
                  }
                  className="px-2 py-1 rounded-lg bg-gray-950/60 border border-white/5 text-xs text-gray-300 focus:outline-none"
                >
                  <option value="">All Urgencies</option>
                  {URGENCIES.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* List */}
            <div className="space-y-2 max-h-[650px] overflow-y-auto pr-1">
              {messages.length === 0 ? (
                <div className="p-8 text-center bg-gray-900/20 border border-dashed border-white/10 rounded-2xl">
                  <MessagesIcon className="w-8 h-8 mx-auto text-gray-600 mb-2" />
                  <p className="text-xs text-gray-400">No messages match the current filter.</p>
                  <button
                    onClick={() => setActiveTab('playground')}
                    className="mt-3 text-xs text-bhuvi-400 hover:underline"
                  >
                    Submit a message in AI Analyzer
                  </button>
                </div>
              ) : (
                messages.map((msg) => {
                  const isSelected = activeMessage?.id === msg.id;
                  return (
                    <div
                      key={msg.id}
                      onClick={() => selectMessage(msg.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-bhuvi-500/10 border-bhuvi-500/40 shadow-lg'
                          : 'bg-gray-900/30 border-white/5 hover:border-white/20 hover:bg-gray-900/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="font-semibold text-xs text-white truncate max-w-[180px]">
                          {msg.senderName}
                        </span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {msg.analysis && (
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${getPriorityBadgeClass(msg.analysis.priority)}`}
                            >
                              {msg.analysis.priority}
                            </span>
                          )}
                          <span className="text-[10px] text-gray-500 font-mono">
                            {new Date(msg.receivedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>

                      <h4 className="text-xs font-medium text-gray-300 truncate mb-1">
                        {msg.subject || msg.content.slice(0, 50)}
                      </h4>

                      <div className="flex items-center gap-2 mt-2">
                        {msg.analysis && (
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded border ${getCategoryBadgeClass(msg.analysis.category)}`}
                          >
                            {msg.analysis.category}
                          </span>
                        )}
                        <span className="text-[9px] text-gray-400 font-mono">
                          Status: {msg.processingStatus}
                        </span>
                        {msg.isDuplicate && (
                          <span className="text-[9px] text-amber-400 bg-amber-500/10 px-1 rounded">
                            Duplicate
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Detailed View (Section 12.C) */}
          <div className="lg:col-span-7">
            {activeMessage ? (
              <div className="p-6 rounded-2xl bg-gray-900/40 border border-white/5 backdrop-blur-xl space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-white/5 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      {activeMessage.subject || 'Incoming Message'}
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      From:{' '}
                      <span className="text-white font-medium">{activeMessage.senderName}</span>
                      {activeMessage.senderIdentifier && (
                        <span className="text-gray-500"> ({activeMessage.senderIdentifier})</span>
                      )}
                      {' • '}
                      {new Date(activeMessage.receivedAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => analyzeExistingMessage(activeMessage.id)}
                      disabled={isSubmitting}
                      className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-medium text-gray-300 border border-white/10 transition"
                      title="Force Re-Analyze"
                    >
                      Re-Analyze
                    </button>
                    <button
                      onClick={() => deleteMessage(activeMessage.id)}
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition"
                      title="Delete Message"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Intelligence Badges */}
                {activeMessage.analysis && (
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${getCategoryBadgeClass(activeMessage.analysis.category)}`}
                    >
                      {activeMessage.analysis.category}
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${getPriorityBadgeClass(activeMessage.analysis.priority)}`}
                    >
                      Priority: {activeMessage.analysis.priority}
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${getUrgencyBadgeClass(activeMessage.analysis.urgency)}`}
                    >
                      Urgency: {activeMessage.analysis.urgency}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-800 text-gray-300 border border-gray-700">
                      Intent: {activeMessage.analysis.intent}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-800 text-gray-300 border border-gray-700">
                      Sentiment: {activeMessage.analysis.sentiment}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-mono bg-bhuvi-950 text-bhuvi-300 border border-bhuvi-800">
                      Confidence: {Math.round(activeMessage.analysis.confidence * 100)}%
                    </span>
                  </div>
                )}

                {/* Priority Justification */}
                {activeMessage.analysis?.priorityExplanation && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2">
                    <AlertTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong>Priority Assessment:</strong>{' '}
                      {activeMessage.analysis.priorityExplanation}
                    </div>
                  </div>
                )}

                {/* AI Summary */}
                {activeMessage.analysis?.summary && (
                  <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-1">
                    <span className="text-[10px] font-mono uppercase text-bhuvi-400 block tracking-wider">
                      Intelligence Summary
                    </span>
                    <p className="text-xs text-gray-200 leading-relaxed font-sans">
                      {activeMessage.analysis.summary}
                    </p>
                  </div>
                )}

                {/* Original Content Box */}
                <div>
                  <span className="text-xs font-semibold text-gray-400 block mb-1.5 uppercase tracking-wider text-[10px]">
                    Raw Message Content
                  </span>
                  <div className="p-3.5 rounded-xl bg-gray-950/80 border border-white/5 text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
                    {activeMessage.content}
                  </div>
                </div>

                {/* Action Items List */}
                {activeMessage.actionItems && activeMessage.actionItems.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-white/5">
                    <span className="text-xs font-semibold text-white block">
                      Extracted Action Items ({activeMessage.actionItems.length})
                    </span>
                    <div className="space-y-2">
                      {activeMessage.actionItems.map((item) => {
                        const isDone = item.status === 'COMPLETED';
                        return (
                          <div
                            key={item.id}
                            className={`p-3 rounded-xl border flex items-center justify-between transition ${
                              isDone
                                ? 'bg-emerald-950/20 border-emerald-500/20 text-gray-400'
                                : 'bg-gray-950/50 border-white/5 text-gray-200'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() =>
                                  updateActionItemStatus(item.id, isDone ? 'PENDING' : 'COMPLETED')
                                }
                                className={`w-5 h-5 rounded flex items-center justify-center border transition ${
                                  isDone
                                    ? 'bg-emerald-500 border-emerald-400 text-black'
                                    : 'border-gray-600 hover:border-bhuvi-400'
                                }`}
                              >
                                {isDone && <CheckCircleIcon className="w-3.5 h-3.5" />}
                              </button>
                              <div>
                                <p
                                  className={`text-xs font-medium ${isDone ? 'line-through text-gray-500' : ''}`}
                                >
                                  {item.title}
                                </p>
                                {item.description && (
                                  <p className="text-[11px] text-gray-500 mt-0.5">
                                    {item.description}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {item.dueDate && (
                                <span className="text-[10px] text-gray-400 flex items-center gap-1 font-mono">
                                  <ClockIcon className="w-3 h-3" />
                                  {new Date(item.dueDate).toLocaleDateString()}
                                </span>
                              )}
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getPriorityBadgeClass(item.priority)}`}
                              >
                                {item.priority}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Extracted Entities */}
                {activeMessage.analysis?.extractedEntities &&
                  activeMessage.analysis.extractedEntities.length > 0 && (
                    <div className="pt-2 border-t border-white/5">
                      <span className="text-xs font-semibold text-gray-400 block mb-2 uppercase tracking-wider text-[10px]">
                        Extracted Entities & Metadata
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {activeMessage.analysis.extractedEntities.map((ent, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-lg text-[11px] bg-gray-800/80 text-gray-300 border border-white/5 font-mono"
                          >
                            <span className="text-gray-500">{ent.type}:</span> {ent.value}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            ) : (
              <div className="h-96 flex flex-col items-center justify-center text-center p-8 border border-dashed border-white/10 rounded-2xl bg-gray-900/20">
                <MessagesIcon className="w-10 h-10 text-gray-600 mb-3" />
                <h3 className="text-sm font-semibold text-white">No Message Selected</h3>
                <p className="text-xs text-gray-400 mt-1 max-w-sm">
                  Select a message from the list on the left, or test message analysis using the AI
                  Analyzer tab.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
