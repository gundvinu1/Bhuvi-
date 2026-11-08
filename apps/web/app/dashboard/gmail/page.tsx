'use client';

import React, { useState } from 'react';
import { useGmail } from '../../../lib/use-gmail';
import {
  EmailsIcon,
  SearchIcon,
  RefreshIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  CloseIcon,
  SparklesIcon,
} from '../../../components/ui/icons';
import { GmailConnectionDto, GmailMessageDto, GmailSummaryResponse } from '@bhuvi/shared';

export default function GmailDashboardPage() {
  const {
    connections,
    connection,
    selectedConnectionId,
    setSelectedConnectionId,
    stats,
    messages,
    activeMessage,
    isLoading,
    isSyncing,
    isSummarizing,
    isGeneratingReply,
    isSavingDraft,
    isAsking,
    error,
    filters,
    setFilters,
    connectGmail,
    disconnectConnection,
    triggerSync,
    selectMessage,
    summarizeMessage,
    suggestReply,
    createDraft,
    askAboutEmails,
  } = useGmail();

  const [activeTab, setActiveTab] = useState<'inbox' | 'ask'>('inbox');
  const [askQuestionText, setAskQuestionText] = useState('');
  const [askResult, setAskResult] = useState<{ answer: string; references: any[] } | null>(null);

  const [summaryData, setSummaryData] = useState<GmailSummaryResponse | null>(null);

  // Draft Reply Modal state
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
  const [draftTo, setDraftTo] = useState('');
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [draftSuccessMsg, setDraftSuccessMsg] = useState<string | null>(null);
  const [draftAccountEmail, setDraftAccountEmail] = useState<string>('');

  // Disconnect Confirmation Modal for specific account
  const [disconnectTarget, setDisconnectTarget] = useState<GmailConnectionDto | null>(null);

  const handleOpenDraftModal = async (msg: GmailMessageDto) => {
    setDraftSuccessMsg(null);
    setDraftTo(msg.senderEmail);
    setDraftSubject(
      msg.subject.toLowerCase().startsWith('re:') ? msg.subject : `Re: ${msg.subject}`,
    );
    setDraftBody('');
    setDraftAccountEmail(msg.accountEmail || connection?.googleAccountEmail || 'your account');
    setIsDraftModalOpen(true);

    const reply = await suggestReply(msg.id);
    if (reply) {
      setDraftBody(reply.suggestedBody);
      setDraftSubject(reply.subject);
    }
  };

  const handleSaveDraft = async () => {
    if (!activeMessage) return;
    const res = await createDraft(activeMessage.id, {
      to: draftTo,
      subject: draftSubject,
      body: draftBody,
      threadId: activeMessage.providerThreadId,
      connectionId: activeMessage.gmailConnectionId,
    });
    if (res) {
      setDraftSuccessMsg(
        `✓ Draft saved to ${res.accountEmail || 'Gmail'} (Draft ID: ${res.draftId})`,
      );
    }
  };

  const handleSummarize = async (msgId: string) => {
    const res = await summarizeMessage(msgId);
    if (res) {
      setSummaryData(res);
    }
  };

  const handleAskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!askQuestionText.trim()) return;
    const res = await askAboutEmails(askQuestionText, selectedConnectionId);
    if (res) {
      setAskResult(res);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const activeConnections = connections.filter((c) => c.connectionStatus !== 'DISCONNECTED');
  const hasConnectedAccounts =
    activeConnections.length > 0 || connection?.connectionStatus === 'CONNECTED';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
              <EmailsIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Gmail Integration</h1>
              <p className="text-xs text-gray-400">
                Official Google OAuth 2.0 • Multi-Account Management • Local AI Inbox Intelligence •
                Safe Drafts
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasConnectedAccounts ? (
            <>
              <button
                type="button"
                onClick={() => triggerSync(50, selectedConnectionId)}
                disabled={isSyncing}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 text-xs font-semibold transition disabled:opacity-50"
              >
                <RefreshIcon className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing
                  ? 'Syncing Inbox…'
                  : selectedConnectionId
                    ? 'Sync Account'
                    : 'Sync All Accounts'}
              </button>
              <button
                type="button"
                onClick={connectGmail}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 text-xs font-semibold transition"
              >
                <EmailsIcon className="w-3.5 h-3.5" />+ Connect Another Account
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={connectGmail}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/20 transition"
            >
              <EmailsIcon className="w-4 h-4" />
              Connect Gmail Account
            </button>
          )}
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangleIcon className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Connected Accounts Management Section */}
      {hasConnectedAccounts ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Connected Accounts ({activeConnections.length || (connection ? 1 : 0)})
            </h2>
            <div className="flex items-center gap-2 text-[11px] text-gray-500">
              <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5">
                gmail.readonly
              </span>
              <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5">
                gmail.compose (Drafts Only)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(activeConnections.length > 0
              ? activeConnections
              : connection
                ? [connection]
                : []
            ).map((conn) => {
              const isSelected = selectedConnectionId === conn.id;
              const isConnError =
                conn.connectionStatus === 'REQUIRES_REAUTH' || conn.connectionStatus === 'ERROR';

              return (
                <div
                  key={conn.id}
                  className={`p-3.5 rounded-2xl border transition flex flex-col justify-between ${
                    isSelected
                      ? 'bg-red-500/10 border-red-500/40 shadow-sm'
                      : 'bg-gray-900/60 border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          conn.connectionStatus === 'CONNECTED'
                            ? 'bg-emerald-400 animate-pulse'
                            : 'bg-amber-400'
                        }`}
                      />
                      <div className="min-w-0">
                        <p
                          className="text-xs font-bold text-white truncate"
                          title={conn.googleAccountEmail}
                        >
                          {conn.googleAccountEmail}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          Synced:{' '}
                          {conn.lastSyncedAt
                            ? new Date(conn.lastSyncedAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Pending'}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                        conn.connectionStatus === 'CONNECTED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {conn.connectionStatus}
                    </span>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedConnectionId(isSelected ? null : conn.id)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition ${
                        isSelected
                          ? 'bg-red-600 text-white'
                          : 'bg-white/5 hover:bg-white/10 text-gray-300'
                      }`}
                    >
                      {isSelected ? '✓ Filtering' : 'Filter Inbox'}
                    </button>

                    <div className="flex items-center gap-1.5">
                      {isConnError ? (
                        <button
                          type="button"
                          onClick={connectGmail}
                          className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-amber-500 text-black hover:bg-amber-400 transition"
                        >
                          Reconnect
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => triggerSync(50, conn.id)}
                          disabled={isSyncing}
                          className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition disabled:opacity-50"
                          title="Sync this account"
                        >
                          <RefreshIcon
                            className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`}
                          />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setDisconnectTarget(conn)}
                        className="px-2 py-1 rounded-lg text-[10px] font-semibold text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="p-8 rounded-2xl bg-gray-900/40 border border-white/10 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center border border-red-500/20">
            <EmailsIcon className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-white">Connect Your Gmail Accounts</h3>
            <p className="text-xs text-gray-400">
              Connect your personal, college, or work Gmail accounts to BHUVI. All emails are
              processed locally using Ollama with zero cloud leaks and zero auto-sending.
            </p>
          </div>
          <button
            type="button"
            onClick={connectGmail}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition shadow-lg shadow-red-600/20"
          >
            <EmailsIcon className="w-4 h-4" />
            Connect Google Account
          </button>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-gray-900/40 border border-white/5 space-y-1">
          <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
            Total Emails
          </p>
          <p className="text-2xl font-black text-white">{stats?.totalEmails ?? 0}</p>
          <p className="text-[10px] text-gray-500">
            {selectedConnectionId ? 'In selected account' : 'Across all connected accounts'}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-gray-900/40 border border-white/5 space-y-1">
          <p className="text-[11px] text-amber-400 uppercase tracking-wider font-semibold">
            Unread Messages
          </p>
          <p className="text-2xl font-black text-amber-400">{stats?.unreadEmails ?? 0}</p>
          <p className="text-[10px] text-gray-500">Needs attention</p>
        </div>
        <div className="p-4 rounded-2xl bg-gray-900/40 border border-white/5 space-y-1">
          <p className="text-[11px] text-red-400 uppercase tracking-wider font-semibold">
            Important
          </p>
          <p className="text-2xl font-black text-red-400">{stats?.importantEmails ?? 0}</p>
          <p className="text-[10px] text-gray-500">Critical / High priority</p>
        </div>
        <div className="p-4 rounded-2xl bg-gray-900/40 border border-white/5 space-y-1">
          <p className="text-[11px] text-emerald-400 uppercase tracking-wider font-semibold">
            Action Required
          </p>
          <p className="text-2xl font-black text-emerald-400">{stats?.requiresActionCount ?? 0}</p>
          <p className="text-[10px] text-gray-500">With extracted tasks</p>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex items-center gap-2 border-b border-white/5 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('inbox')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'inbox'
              ? 'bg-white/10 text-white'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Unified Inbox
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('ask')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'ask'
              ? 'bg-red-500/20 text-red-300 border border-red-500/30'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <SparklesIcon className="w-3.5 h-3.5 text-red-400" />
          Ask BHUVI
        </button>
      </div>

      {/* Tab: Unified Inbox */}
      {activeTab === 'inbox' && (
        <div className="space-y-4">
          {/* Filters & Account Selector */}
          <div className="p-3.5 rounded-2xl bg-gray-900/40 border border-white/5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              {/* Account Dropdown */}
              <select
                aria-label="Account Filter"
                value={selectedConnectionId || ''}
                onChange={(e) => setSelectedConnectionId(e.target.value ? e.target.value : null)}
                className="px-3 py-1.5 rounded-xl bg-gray-950 border border-white/10 text-xs text-white focus:outline-none focus:border-red-500/50"
              >
                <option value="">All Accounts</option>
                {activeConnections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.googleAccountEmail}
                  </option>
                ))}
              </select>

              {/* Search */}
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <SearchIcon className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search emails…"
                  value={filters.search || ''}
                  onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-gray-950 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50"
                />
              </div>

              {/* Category */}
              <select
                aria-label="Category Filter"
                value={filters.category || ''}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, category: e.target.value || undefined }))
                }
                className="px-2.5 py-1.5 rounded-xl bg-gray-950 border border-white/10 text-xs text-white focus:outline-none"
              >
                <option value="">All Categories</option>
                <option value="WORK">Work</option>
                <option value="EDUCATION">Education</option>
                <option value="PERSONAL">Personal</option>
                <option value="FINANCE">Finance</option>
                <option value="TRANSACTIONAL">Transactional</option>
                <option value="UPDATES">Updates</option>
              </select>

              {/* Priority */}
              <select
                aria-label="Priority Filter"
                value={filters.priority || ''}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, priority: e.target.value || undefined }))
                }
                className="px-2.5 py-1.5 rounded-xl bg-gray-950 border border-white/10 text-xs text-white focus:outline-none"
              >
                <option value="">All Priorities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, unreadOnly: !prev.unreadOnly }))}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  filters.unreadOnly
                    ? 'bg-amber-500 text-black'
                    : 'bg-white/5 text-gray-400 hover:text-white'
                }`}
              >
                Unread Only
              </button>
              <button
                type="button"
                onClick={() =>
                  setFilters((prev) => ({ ...prev, importantOnly: !prev.importantOnly }))
                }
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  filters.importantOnly
                    ? 'bg-red-600 text-white'
                    : 'bg-white/5 text-gray-400 hover:text-white'
                }`}
              >
                Important Only
              </button>
            </div>
          </div>

          {/* Master-Detail Split Pane */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Messages List (5 cols) */}
            <div className="lg:col-span-5 rounded-2xl bg-gray-900/40 border border-white/5 overflow-hidden">
              <div className="p-3 border-b border-white/5 bg-gray-950/40 flex items-center justify-between text-xs font-semibold text-gray-400">
                <span>Synchronized Emails ({messages.length})</span>
                {isLoading && <span className="text-[10px] text-gray-500">Loading…</span>}
              </div>

              <div className="divide-y divide-white/5 max-h-[640px] overflow-y-auto">
                {messages.length === 0 ? (
                  <div className="p-8 text-center text-xs text-gray-500">
                    No emails found. Trigger a sync or check your filters.
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isSelected = activeMessage?.id === msg.id;
                    const cat = msg.analysis?.category || 'GENERAL';
                    const pri = msg.analysis?.priority || 'NORMAL';
                    const hasAction = msg.actionItems && msg.actionItems.length > 0;

                    return (
                      <div
                        key={msg.id}
                        onClick={() => selectMessage(msg.id)}
                        className={`p-3.5 cursor-pointer transition flex flex-col gap-1.5 ${
                          isSelected
                            ? 'bg-red-500/10 border-l-2 border-red-500'
                            : 'hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {!msg.isRead && (
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                            )}
                            <span className="text-xs font-bold text-white truncate">
                              {msg.senderName || msg.senderEmail}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {msg.accountEmail && (
                              <span
                                className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-white/5 text-gray-400 border border-white/5 truncate max-w-[120px]"
                                title={`Received by: ${msg.accountEmail}`}
                              >
                                {msg.accountEmail.split('@')[0]}
                              </span>
                            )}
                            <span className="text-[10px] text-gray-500">
                              {new Date(msg.receivedAt).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                        </div>

                        <p className="text-xs font-medium text-gray-200 line-clamp-1">
                          {msg.subject || '(No Subject)'}
                        </p>
                        <p className="text-[11px] text-gray-400 line-clamp-1">
                          {msg.snippet || msg.bodyText}
                        </p>

                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-white/5 text-gray-400 border border-white/5">
                            {cat}
                          </span>
                          {(pri === 'CRITICAL' || pri === 'HIGH') && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                              {pri}
                            </span>
                          )}
                          {hasAction && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Action Required
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Reading Pane (7 cols) */}
            <div className="lg:col-span-7 rounded-2xl bg-gray-900/40 border border-white/5 overflow-hidden">
              {activeMessage ? (
                <div className="p-6 space-y-6">
                  {/* Subject & Actions */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                    <div>
                      <h2 className="text-base font-bold text-white">
                        {activeMessage.subject || '(No Subject)'}
                      </h2>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 flex-wrap">
                        <span>
                          From:{' '}
                          <strong className="text-gray-300">
                            {activeMessage.senderName || activeMessage.senderEmail}
                          </strong>
                        </span>
                        <span>•</span>
                        <p>
                          <span className="text-gray-500">To:</span>{' '}
                          {activeMessage.recipientEmails.join(', ')}
                        </p>
                        {activeMessage.accountEmail && (
                          <>
                            <span>•</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                              Received in: {activeMessage.accountEmail}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSummarize(activeMessage.id)}
                        disabled={isSummarizing}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-200 border border-white/10 transition disabled:opacity-50"
                      >
                        <SparklesIcon className="w-3.5 h-3.5 text-amber-400" />
                        {isSummarizing ? 'Summarizing…' : 'Summarize'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenDraftModal(activeMessage)}
                        disabled={isGeneratingReply}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white transition shadow-sm"
                      >
                        <EmailsIcon className="w-3.5 h-3.5" />
                        Suggest Reply
                      </button>
                    </div>
                  </div>

                  {/* AI Intelligence Summary Banner */}
                  {(summaryData || activeMessage.analysis) && (
                    <div className="p-4 rounded-xl bg-gray-950/60 border border-red-500/20 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-red-400">
                        <SparklesIcon className="w-4 h-4" />
                        <span>AI Executive Summary</span>
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed">
                        {summaryData?.summary || activeMessage.analysis?.summary}
                      </p>
                    </div>
                  )}

                  {/* Action Items */}
                  {activeMessage.actionItems && activeMessage.actionItems.length > 0 && (
                    <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                        <CheckCircleIcon className="w-4 h-4" />
                        <span>Detected Action Items</span>
                      </div>
                      <ul className="space-y-1.5">
                        {activeMessage.actionItems.map((item) => (
                          <li
                            key={item.id}
                            className="text-xs text-gray-300 flex items-start gap-2"
                          >
                            <span className="text-emerald-400 font-bold">•</span>
                            <span>{item.title}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Email Body */}
                  <div className="prose prose-invert max-w-none text-xs text-gray-300 leading-relaxed whitespace-pre-wrap font-sans bg-gray-950/40 p-4 rounded-xl border border-white/5">
                    {activeMessage.bodyText || activeMessage.snippet || '(Empty email body)'}
                  </div>

                  {/* Attachments */}
                  {activeMessage.attachments && activeMessage.attachments.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <p className="text-xs font-bold text-gray-400">
                        Attachments ({activeMessage.attachments.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {activeMessage.attachments.map((att) => (
                          <div
                            key={att.id}
                            className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-xs text-gray-300 flex items-center gap-2"
                          >
                            <span className="font-semibold">{att.filename}</span>
                            <span className="text-[10px] text-gray-500">
                              ({formatFileSize(att.size)})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-12 text-center text-xs text-gray-500">
                  Select an email from the inbox list to read its contents and view AI analysis.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Ask BHUVI */}
      {activeTab === 'ask' && (
        <div className="p-6 rounded-2xl bg-gray-900/40 border border-white/5 space-y-6">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <SparklesIcon className="w-5 h-5 text-red-400" />
              Ask BHUVI About Your Emails
            </h2>
            <p className="text-xs text-gray-400">
              Query your synchronized messages across connected Gmail accounts with grounded local
              AI intelligence.
              {selectedConnectionId ? (
                <span className="text-amber-400 font-semibold ml-1">
                  (Currently scoped to{' '}
                  {activeConnections.find((c) => c.id === selectedConnectionId)?.googleAccountEmail}
                  )
                </span>
              ) : (
                <span className="text-emerald-400 font-semibold ml-1">
                  (Searching across all accounts)
                </span>
              )}
            </p>
          </div>

          <form onSubmit={handleAskSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Which emails require an urgent reply? Or what tasks were assigned today?"
              value={askQuestionText}
              onChange={(e) => setAskQuestionText(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl bg-gray-950 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50"
            />
            <button
              type="submit"
              disabled={isAsking || !askQuestionText.trim()}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition disabled:opacity-50"
            >
              {isAsking ? 'Thinking…' : 'Ask'}
            </button>
          </form>

          {/* Quick Questions */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
            <span className="text-[11px] text-gray-500">Try asking:</span>
            {[
              'Summarize my college emails',
              'Show urgent emails from work',
              'What tasks do I have across all my Gmail accounts?',
              'Find emails about my project deadline',
            ].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setAskQuestionText(q)}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-gray-300 transition"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Answer Card */}
          {askResult && (
            <div className="p-5 rounded-2xl bg-gray-950 border border-red-500/20 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-red-400">
                <SparklesIcon className="w-4 h-4" />
                <span>BHUVI Grounded Response</span>
              </div>
              <p className="text-xs text-gray-200 leading-relaxed whitespace-pre-wrap">
                {askResult.answer}
              </p>

              {askResult.references && askResult.references.length > 0 && (
                <div className="pt-3 border-t border-white/5 space-y-1.5">
                  <p className="text-[11px] font-bold text-gray-400">Referenced Emails:</p>
                  <div className="flex flex-wrap gap-2">
                    {askResult.references.map((ref: any) => (
                      <div
                        key={ref.id}
                        className="p-2 rounded-lg bg-white/5 border border-white/5 text-[11px] text-gray-300"
                      >
                        <span className="font-semibold text-white">{ref.subject}</span>
                        {ref.accountEmail && (
                          <span className="ml-1 text-[10px] text-gray-400">
                            ({ref.accountEmail})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Draft Reply Modal */}
      {isDraftModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-gray-900 border border-white/10 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <EmailsIcon className="w-4 h-4 text-red-400" />
                  Save Draft to Gmail
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Creating draft in account:{' '}
                  <strong className="text-red-300">{draftAccountEmail}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDraftModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            {draftSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
                {draftSuccessMsg}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1">To:</label>
                <input
                  type="email"
                  value={draftTo}
                  onChange={(e) => setDraftTo(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-gray-950 border border-white/10 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                  Subject:
                </label>
                <input
                  type="text"
                  value={draftSubject}
                  onChange={(e) => setDraftSubject(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-gray-950 border border-white/10 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                  Reply Body:
                </label>
                <textarea
                  rows={8}
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  className="w-full p-3 rounded-xl bg-gray-950 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <span className="text-[11px] text-gray-500">
                BHUVI will save this draft into your official Gmail Drafts folder. It will never
                auto-send.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDraftModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={isSavingDraft || !draftBody.trim()}
                  className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white transition disabled:opacity-50"
                >
                  {isSavingDraft ? 'Saving Draft…' : 'Save as Draft to Gmail'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect Account Modal */}
      {disconnectTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-gray-900 border border-white/10 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-red-500/10 text-red-400">
                <AlertTriangleIcon className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Disconnect Gmail Account?</h3>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              Are you sure you want to disconnect{' '}
              <strong className="text-white">{disconnectTarget.googleAccountEmail}</strong>? This
              will remove authorized tokens for this account. Other connected accounts will remain
              active.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDisconnectTarget(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await disconnectConnection(disconnectTarget.id);
                  setDisconnectTarget(null);
                }}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white transition"
              >
                Disconnect This Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
