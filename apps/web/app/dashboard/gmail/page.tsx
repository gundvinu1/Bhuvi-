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
import { GmailMessageDto, GmailSummaryResponse } from '@bhuvi/shared';

export default function GmailDashboardPage() {
  const {
    connection,
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
    disconnectGmail,
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

  // Disconnect Confirmation Modal
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);

  const handleOpenDraftModal = async (msg: GmailMessageDto) => {
    setDraftSuccessMsg(null);
    setDraftTo(msg.senderEmail);
    setDraftSubject(
      msg.subject.toLowerCase().startsWith('re:') ? msg.subject : `Re: ${msg.subject}`,
    );
    setDraftBody('');
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
    });
    if (res) {
      setDraftSuccessMsg(`✓ Draft successfully created in Gmail (Draft ID: ${res.draftId})`);
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
    const res = await askAboutEmails(askQuestionText);
    if (res) {
      setAskResult(res);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

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
                Official Google OAuth 2.0 • Local AI Inbox Intelligence • Safe Drafts
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {connection?.connectionStatus === 'CONNECTED' ? (
            <>
              <button
                type="button"
                onClick={() => triggerSync(50)}
                disabled={isSyncing}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 text-xs font-semibold transition disabled:opacity-50"
              >
                <RefreshIcon className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing Inbox…' : 'Sync Inbox'}
              </button>
              <button
                type="button"
                onClick={() => setIsDisconnectModalOpen(true)}
                className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold transition"
              >
                Disconnect
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

      {/* Connection Banner */}
      {connection?.connectionStatus === 'CONNECTED' ? (
        <div className="p-4 rounded-2xl bg-gray-900/60 border border-emerald-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">
                  {connection.googleAccountEmail}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  CONNECTED
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Last synchronized:{' '}
                {connection.lastSyncedAt
                  ? new Date(connection.lastSyncedAt).toLocaleString()
                  : 'Pending first sync'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-gray-400">
            <span className="px-2 py-1 rounded-lg bg-white/5 border border-white/5">
              gmail.readonly
            </span>
            <span className="px-2 py-1 rounded-lg bg-white/5 border border-white/5">
              gmail.compose (Drafts Only)
            </span>
          </div>
        </div>
      ) : connection?.connectionStatus === 'REQUIRES_REAUTH' ? (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangleIcon className="w-5 h-5 text-amber-400" />
            <div>
              <p className="text-sm font-bold text-amber-300">Reauthorization Required</p>
              <p className="text-xs text-amber-400/80">
                Google revoked or expired the OAuth grant. Please reauthorize your Gmail account.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={connectGmail}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition"
          >
            Reauthorize Now
          </button>
        </div>
      ) : (
        <div className="p-6 rounded-2xl bg-gray-900/40 border border-white/10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center mx-auto">
            <EmailsIcon className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">No Gmail Account Connected</h3>
          <p className="text-xs text-gray-400 max-w-md mx-auto">
            Connect your personal Gmail account via Google OAuth 2.0 to securely synchronize your
            inbox, extract action items, and draft replies using local AI models.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={connectGmail}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/20 transition"
            >
              <EmailsIcon className="w-4 h-4" />
              Connect with Google OAuth
            </button>
          </div>
        </div>
      )}

      {/* 4 Stat Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-gray-900/40 border border-white/5 space-y-1">
          <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
            Total Emails
          </p>
          <p className="text-2xl font-black text-white">{stats?.totalEmails ?? 0}</p>
        </div>
        <div className="p-4 rounded-2xl bg-gray-900/40 border border-white/5 space-y-1">
          <p className="text-[11px] text-amber-400 uppercase tracking-wider font-semibold">
            Unread Messages
          </p>
          <p className="text-2xl font-black text-amber-400">{stats?.unreadEmails ?? 0}</p>
        </div>
        <div className="p-4 rounded-2xl bg-gray-900/40 border border-white/5 space-y-1">
          <p className="text-[11px] text-red-400 uppercase tracking-wider font-semibold">
            Important
          </p>
          <p className="text-2xl font-black text-red-400">{stats?.importantEmails ?? 0}</p>
        </div>
        <div className="p-4 rounded-2xl bg-gray-900/40 border border-white/5 space-y-1">
          <p className="text-[11px] text-blue-400 uppercase tracking-wider font-semibold">
            Action Required
          </p>
          <p className="text-2xl font-black text-blue-400">{stats?.requiresActionCount ?? 0}</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-white/10 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('inbox')}
          className={`pb-3 px-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
            activeTab === 'inbox'
              ? 'border-red-500 text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <EmailsIcon className="w-4 h-4" />
          Inbox & Conversations
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('ask')}
          className={`pb-3 px-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
            activeTab === 'ask'
              ? 'border-red-500 text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <SparklesIcon className="w-4 h-4 text-amber-400" />
          Ask BHUVI (Email Q&A)
        </button>
      </div>

      {/* Tab 1: Inbox */}
      {activeTab === 'inbox' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Email List Column */}
          <div className="lg:col-span-5 space-y-4">
            {/* Filter Bar */}
            <div className="p-3 rounded-2xl bg-gray-900/40 border border-white/5 space-y-3">
              <div className="relative">
                <SearchIcon className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search subject, body, or sender…"
                  value={filters.search || ''}
                  onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-gray-950/80 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() =>
                    setFilters((f) => ({ ...f, unreadOnly: undefined, importantOnly: undefined }))
                  }
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                    !filters.unreadOnly && !filters.importantOnly
                      ? 'bg-red-500 text-white'
                      : 'bg-white/5 text-gray-400 hover:text-white'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFilters((f) => ({ ...f, unreadOnly: true, importantOnly: undefined }))
                  }
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                    filters.unreadOnly
                      ? 'bg-amber-500 text-black'
                      : 'bg-white/5 text-gray-400 hover:text-white'
                  }`}
                >
                  Unread
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFilters((f) => ({ ...f, importantOnly: true, unreadOnly: undefined }))
                  }
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                    filters.importantOnly
                      ? 'bg-red-500 text-white'
                      : 'bg-white/5 text-gray-400 hover:text-white'
                  }`}
                >
                  Important
                </button>
              </div>
            </div>

            {/* Email List */}
            {isLoading ? (
              <div className="p-8 text-center text-xs text-gray-400">Loading emails…</div>
            ) : messages.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400 rounded-2xl bg-gray-900/20 border border-white/5">
                No emails match the current filters.
              </div>
            ) : (
              <div className="space-y-2 max-h-[680px] overflow-y-auto pr-1">
                {messages.map((msg) => {
                  const isSelected = activeMessage?.id === msg.id;
                  return (
                    <div
                      key={msg.id}
                      onClick={() => selectMessage(msg.id)}
                      className={`p-3.5 rounded-2xl border transition cursor-pointer ${
                        isSelected
                          ? 'bg-red-500/10 border-red-500/40 shadow-lg'
                          : 'bg-gray-900/40 border-white/5 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {!msg.isRead && (
                            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                          )}
                          <p className="text-xs font-bold text-white truncate">
                            {msg.senderName || msg.senderEmail}
                          </p>
                        </div>
                        <span className="text-[10px] text-gray-500 shrink-0 font-mono">
                          {new Date(msg.receivedAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>

                      <p className="text-xs font-semibold text-gray-200 mt-1 truncate">
                        {msg.subject || '(No Subject)'}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">
                        {msg.snippet || msg.bodyText}
                      </p>

                      <div className="flex items-center gap-1.5 mt-2.5">
                        {msg.analysis?.category && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-white/5 text-gray-300 border border-white/10 uppercase">
                            {msg.analysis.category}
                          </span>
                        )}
                        {msg.analysis?.priority && msg.analysis.priority !== 'LOW' && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                              msg.analysis.priority === 'CRITICAL'
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {msg.analysis.priority}
                          </span>
                        )}
                        {msg.hasAttachments && (
                          <span className="text-[10px] text-gray-400">📎</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Email Detail Column */}
          <div className="lg:col-span-7">
            {activeMessage ? (
              <div className="p-6 rounded-2xl bg-gray-900/40 border border-white/10 space-y-6">
                {/* Header & Meta */}
                <div className="space-y-3 border-b border-white/5 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="text-lg font-bold text-white tracking-tight">
                      {activeMessage.subject || '(No Subject)'}
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSummarize(activeMessage.id)}
                        disabled={isSummarizing}
                        className="px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 text-xs font-semibold transition disabled:opacity-50"
                      >
                        {isSummarizing ? 'Summarizing…' : 'Summarize'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenDraftModal(activeMessage)}
                        disabled={isGeneratingReply}
                        className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/20 transition disabled:opacity-50"
                      >
                        {isGeneratingReply ? 'Drafting…' : 'Suggest Reply'}
                      </button>
                    </div>
                  </div>

                  <div className="text-xs text-gray-400 space-y-1">
                    <p>
                      <span className="text-gray-500">From:</span>{' '}
                      <strong className="text-white">
                        {activeMessage.senderName
                          ? `${activeMessage.senderName} <${activeMessage.senderEmail}>`
                          : activeMessage.senderEmail}
                      </strong>
                    </p>
                    {activeMessage.recipientEmails.length > 0 && (
                      <p>
                        <span className="text-gray-500">To:</span>{' '}
                        {activeMessage.recipientEmails.join(', ')}
                      </p>
                    )}
                    <p>
                      <span className="text-gray-500">Date:</span>{' '}
                      {new Date(activeMessage.receivedAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* AI Summary Card (Real-time or Ingested) */}
                {(summaryData || activeMessage.analysis) && (
                  <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/20 space-y-3">
                    <div className="flex items-center gap-2 text-purple-300 font-bold text-xs">
                      <SparklesIcon className="w-4 h-4 text-purple-400" />
                      AI Intelligence Summary
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed">
                      {summaryData?.summary || activeMessage.analysis?.summary}
                    </p>

                    {/* Action Items */}
                    {activeMessage.actionItems && activeMessage.actionItems.length > 0 && (
                      <div className="pt-2 border-t border-purple-500/20 space-y-1.5">
                        <p className="text-[11px] font-bold text-purple-400 uppercase tracking-wider">
                          Detected Action Items
                        </p>
                        {activeMessage.actionItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-start gap-2 text-xs text-gray-300"
                          >
                            <span className="text-purple-400">•</span>
                            <span>{item.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Email Body */}
                <div className="prose prose-invert max-w-none text-xs text-gray-200 whitespace-pre-wrap leading-relaxed font-sans bg-gray-950/40 p-4 rounded-xl border border-white/5 max-h-[400px] overflow-y-auto">
                  {activeMessage.bodyText}
                </div>

                {/* Attachments Section */}
                {activeMessage.attachments && activeMessage.attachments.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-white/5">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Attachments ({activeMessage.attachments.length})
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {activeMessage.attachments.map((att) => (
                        <div
                          key={att.id}
                          className="p-2.5 rounded-xl bg-gray-950 border border-white/10 flex items-center justify-between text-xs"
                        >
                          <div className="truncate mr-2">
                            <p className="font-semibold text-white truncate">{att.filename}</p>
                            <p className="text-[10px] text-gray-500">{formatFileSize(att.size)}</p>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] bg-white/5 text-gray-400">
                            Metadata
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-12 text-center text-xs text-gray-400 rounded-2xl bg-gray-900/20 border border-white/5">
                Select an email from the left pane to view details.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Ask BHUVI (Email Q&A) */}
      {activeTab === 'ask' && (
        <div className="p-6 rounded-2xl bg-gray-900/40 border border-white/10 space-y-6 max-w-3xl">
          <div>
            <h3 className="text-base font-bold text-white">Ask BHUVI About Your Emails</h3>
            <p className="text-xs text-gray-400">
              Query your synchronized inbox using natural language. All answers are grounded
              strictly in your email records.
            </p>
          </div>

          <form onSubmit={handleAskSubmit} className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Which emails require an urgent reply today?"
                value={askQuestionText}
                onChange={(e) => setAskQuestionText(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gray-950 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50"
              />
              <button
                type="submit"
                disabled={isAsking || !askQuestionText.trim()}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {isAsking ? 'Thinking…' : 'Ask'}
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap text-[11px] text-gray-400">
              <span>Quick queries:</span>
              <button
                type="button"
                onClick={() => setAskQuestionText('Summarize my latest emails.')}
                className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300"
              >
                Summarize latest
              </button>
              <button
                type="button"
                onClick={() => setAskQuestionText('Which emails need my reply?')}
                className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300"
              >
                Requires reply
              </button>
              <button
                type="button"
                onClick={() => setAskQuestionText('Are there any payment or invoice emails?')}
                className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300"
              >
                Payments & invoices
              </button>
            </div>
          </form>

          {askResult && (
            <div className="p-4 rounded-xl bg-gray-950 border border-white/10 space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-bold text-red-400 uppercase tracking-wider">
                  BHUVI Answer
                </p>
                <p className="text-xs text-gray-200 leading-relaxed whitespace-pre-wrap">
                  {askResult.answer}
                </p>
              </div>

              {askResult.references.length > 0 && (
                <div className="pt-3 border-t border-white/5 space-y-1.5">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    Referenced Emails
                  </p>
                  {askResult.references.map((ref) => (
                    <div
                      key={ref.id}
                      className="text-[11px] text-gray-400 flex items-center justify-between"
                    >
                      <span className="text-white truncate mr-2">{ref.subject}</span>
                      <span className="text-gray-500 shrink-0 font-mono">
                        {new Date(ref.receivedAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Draft Reply Modal */}
      {isDraftModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-gray-900 border border-white/10 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <SparklesIcon className="w-4 h-4 text-red-400" />
                AI Suggested Reply (Save to Gmail Draft)
              </h3>
              <button
                type="button"
                onClick={() => setIsDraftModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            {draftSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircleIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{draftSuccessMsg}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-gray-400 block mb-1 font-semibold">Recipient (To):</label>
                <input
                  type="text"
                  value={draftTo}
                  onChange={(e) => setDraftTo(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-gray-950 border border-white/10 text-white focus:outline-none focus:border-red-500/50"
                />
              </div>

              <div>
                <label className="text-gray-400 block mb-1 font-semibold">Subject:</label>
                <input
                  type="text"
                  value={draftSubject}
                  onChange={(e) => setDraftSubject(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-gray-950 border border-white/10 text-white focus:outline-none focus:border-red-500/50"
                />
              </div>

              <div>
                <label className="text-gray-400 block mb-1 font-semibold">Draft Body:</label>
                <textarea
                  rows={8}
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-gray-950 border border-white/10 text-white focus:outline-none focus:border-red-500/50 resize-none"
                />
              </div>
            </div>

            <p className="text-[11px] text-gray-400 italic">
              ℹ️ BHUVI will save this as a draft in your Gmail account. No email is sent
              automatically.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => setIsDraftModalOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isSavingDraft || !draftBody.trim()}
                className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {isSavingDraft ? 'Saving Draft…' : 'Save Draft in Gmail'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect Confirmation Modal */}
      {isDisconnectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-gray-900 border border-white/10 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white">Disconnect Gmail Account?</h3>
            <p className="text-xs text-gray-300 leading-relaxed">
              Are you sure you want to disconnect your Gmail account? Stored OAuth tokens will be
              wiped from local storage. Your synchronized messages will remain in your local
              database until deleted.
            </p>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/5">
              <button
                type="button"
                onClick={() => setIsDisconnectModalOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await disconnectGmail();
                  setIsDisconnectModalOpen(false);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold"
              >
                Confirm Disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
