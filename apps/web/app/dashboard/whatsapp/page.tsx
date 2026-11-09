'use client';

import React, { useState } from 'react';
import { useWhatsApp } from '../../../lib/use-whatsapp';
import {
  MessagesIcon,
  SearchIcon,
  RefreshIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  CloseIcon,
  SparklesIcon,
} from '../../../components/ui/icons';
import { WhatsAppConversationDto, WhatsAppConnectionDto } from '@bhuvi/shared';

export default function WhatsAppDashboardPage() {
  const {
    connections,
    selectedConnectionId,
    setSelectedConnectionId,
    connectAccount,
    disconnectAccount,
    conversations,
    activeConversation,
    selectConversation,
    messages,
    drafts,
    stats,
    summary,
    replySuggestions,
    askResult,
    filters,
    setFilters,
    isLoading,
    isSummarizing,
    isSuggestingReply,
    isSubmittingDraft,
    isSending,
    isAsking,
    error,
    createDraft,
    approveDraft,
    sendDraft,
    summarizeConversation,
    suggestReply,
    askWhatsApp,
    refreshConversations,
  } = useWhatsApp();

  const [activeTab, setActiveTab] = useState<'inbox' | 'ask'>('inbox');
  const [askQuestionText, setAskQuestionText] = useState('');

  // Connect Modal state
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [businessAccountId, setBusinessAccountId] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [displayPhoneNumber, setDisplayPhoneNumber] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [connectError, setConnectError] = useState<string | null>(null);

  // Disconnect Modal state
  const [disconnectTarget, setDisconnectTarget] = useState<WhatsAppConnectionDto | null>(null);

  // Reply Draft box state
  const [replyText, setReplyText] = useState('');

  // Strict Human Approval Modal state
  const [approvalModalDraftId, setApprovalModalDraftId] = useState<string | null>(null);
  const [approvalModalData, setApprovalModalData] = useState<{
    recipient: string;
    content: string;
    sendingPhone: string;
  } | null>(null);
  const [sendSuccessMessage, setSendSuccessMessage] = useState<string | null>(null);

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnectError(null);
    try {
      await connectAccount({
        businessAccountId,
        phoneNumberId,
        displayPhoneNumber,
        displayName,
        accessToken,
      });
      setIsConnectModalOpen(false);
      setBusinessAccountId('');
      setPhoneNumberId('');
      setDisplayPhoneNumber('');
      setDisplayName('');
      setAccessToken('');
    } catch (err: any) {
      setConnectError(err.message || 'Failed to connect WhatsApp account.');
    }
  };

  const handleSaveDraft = async () => {
    if (!activeConversation || !replyText.trim()) return;
    try {
      await createDraft({
        connectionId: activeConversation.connectionId,
        conversationId: activeConversation.id,
        recipientPhone: activeConversation.contact?.waId || '',
        content: replyText,
      });
      setSendSuccessMessage('✓ Reply draft saved in PENDING_APPROVAL status.');
      setTimeout(() => setSendSuccessMessage(null), 4000);
    } catch {
      // error handled in hook
    }
  };

  const handleOpenApprovalModal = async () => {
    if (!activeConversation || !replyText.trim()) return;

    // 1. Create or ensure draft exists
    try {
      const draft = await createDraft({
        connectionId: activeConversation.connectionId,
        conversationId: activeConversation.id,
        recipientPhone: activeConversation.contact?.waId || '',
        content: replyText,
      });

      if (draft) {
        setApprovalModalDraftId(draft.id);
        setApprovalModalData({
          recipient: activeConversation.contact?.name
            ? `${activeConversation.contact.name} (${activeConversation.contact.waId})`
            : activeConversation.contact?.waId || '',
          content: replyText,
          sendingPhone:
            activeConversation.connection?.displayPhoneNumber || 'Connected Business Account',
        });
      }
    } catch {
      // error handled in hook
    }
  };

  const handleConfirmApproveAndSend = async () => {
    if (!approvalModalDraftId) return;
    try {
      // Step A: Explicit Human Approval
      await approveDraft(approvalModalDraftId);

      // Step B: Dispatch via Official Meta Cloud API
      const res = await sendDraft(approvalModalDraftId);
      if (res) {
        setSendSuccessMessage(`✓ Message sent via Meta Cloud API (ID: ${res.externalMessageId})`);
        setApprovalModalDraftId(null);
        setApprovalModalData(null);
        setReplyText('');
        setTimeout(() => setSendSuccessMessage(null), 5000);
      }
    } catch {
      // error handled in hook
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
            <MessagesIcon className="w-7 h-7 text-emerald-500" />
            WhatsApp Business Integration
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Official Meta WhatsApp Business Cloud API &bull; Multi-Account Support &bull; AI
            Intelligence &bull; Strict Human Approval
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refreshConversations()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            <RefreshIcon className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => setIsConnectModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow hover:bg-emerald-700 transition"
          >
            + Connect Phone Number
          </button>
        </div>
      </div>

      {/* Global Status/Error Alert */}
      {error && (
        <div className="rounded-lg bg-red-50 p-4 border border-red-200 dark:bg-red-950/30 dark:border-red-900/40 text-red-700 dark:text-red-400 text-sm flex items-start gap-2">
          <AlertTriangleIcon className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {sendSuccessMessage && (
        <div className="rounded-lg bg-emerald-50 p-4 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-sm flex items-center gap-2">
          <CheckCircleIcon className="w-5 h-5 shrink-0" />
          <span>{sendSuccessMessage}</span>
        </div>
      )}

      {/* Statistics Banner */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
            Phone Numbers
          </div>
          <div className="mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {stats?.totalConnections ?? connections.length}
          </div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
            Conversations
          </div>
          <div className="mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {stats?.activeConversations ?? conversations.length}
          </div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
            Total Messages
          </div>
          <div className="mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {stats?.totalMessages ?? 0}
          </div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
            Unread
          </div>
          <div className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {stats?.unreadMessages ?? 0}
          </div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
            Pending Drafts
          </div>
          <div className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {stats?.pendingDrafts ??
              drafts.filter((d) => d.approvalStatus === 'PENDING_APPROVAL').length}
          </div>
        </div>
      </div>

      {/* Connected Accounts Bar */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-3">
          Connected WhatsApp Business Accounts ({connections.length})
        </h2>
        {connections.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            No WhatsApp accounts connected yet. Click &quot;+ Connect Phone Number&quot; above to
            connect your Meta WhatsApp Cloud API credentials.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {connections.map((conn) => (
              <div
                key={conn.id}
                className="flex items-center justify-between rounded-lg border border-neutral-200 p-3 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/50"
              >
                <div>
                  <div className="font-medium text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                    {conn.displayPhoneNumber}
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        conn.status === 'CONNECTED' ? 'bg-emerald-500' : 'bg-neutral-400'
                      }`}
                    />
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">
                    {conn.displayName} &bull; ID: {conn.phoneNumberId}
                  </div>
                </div>
                {conn.status === 'CONNECTED' ? (
                  <button
                    onClick={() => setDisconnectTarget(conn)}
                    className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 font-medium px-2 py-1 border border-red-200 dark:border-red-900/40 rounded hover:bg-red-50 dark:hover:bg-red-950/20"
                  >
                    Disconnect
                  </button>
                ) : (
                  <span className="text-xs text-neutral-400">Disconnected</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Content Tabs */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800">
        <button
          onClick={() => setActiveTab('inbox')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === 'inbox'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400'
          }`}
        >
          Unified Inbox
        </button>
        <button
          onClick={() => setActiveTab('ask')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'ask'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400'
          }`}
        >
          <SparklesIcon className="w-4 h-4" />
          Ask BHUVI
        </button>
      </div>

      {activeTab === 'ask' ? (
        /* Ask BHUVI Panel */
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <SparklesIcon className="w-5 h-5 text-emerald-500" />
              Ask BHUVI about your WhatsApp Conversations
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Grounded, private Q&A powered by local Ollama AI. Citations reference your actual
              messages.
            </p>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={askQuestionText}
              onChange={(e) => setAskQuestionText(e.target.value)}
              placeholder="e.g. Which conversations have urgent unanswered requests?"
              className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && askQuestionText.trim()) {
                  void askWhatsApp(askQuestionText);
                }
              }}
            />
            <button
              onClick={() => void askWhatsApp(askQuestionText)}
              disabled={isAsking || !askQuestionText.trim()}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {isAsking ? 'Thinking…' : 'Ask'}
            </button>
          </div>

          {askResult && (
            <div className="mt-4 rounded-lg bg-neutral-50 p-4 border border-neutral-200 dark:bg-neutral-800/40 dark:border-neutral-700 space-y-3">
              <div className="text-sm text-neutral-900 dark:text-neutral-100 whitespace-pre-wrap">
                {askResult.answer}
              </div>
              {askResult.references.length > 0 && (
                <div className="border-t border-neutral-200 pt-3 dark:border-neutral-700">
                  <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                    Source Citations ({askResult.references.length})
                  </div>
                  <div className="space-y-1.5">
                    {askResult.references.map((ref) => (
                      <div
                        key={ref.messageId}
                        className="text-xs text-neutral-600 dark:text-neutral-300"
                      >
                        &bull; <span className="font-medium">{ref.sender}</span> (
                        {new Date(ref.timestamp).toLocaleString()}): &quot;{ref.snippet}&quot;
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Unified Inbox & Conversation View Split */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Inbox List (Left: 5 columns) */}
          <div className="lg:col-span-5 rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900 flex flex-col h-[700px]">
            {/* Filter controls */}
            <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 space-y-2">
              <div className="flex gap-2">
                <select
                  value={selectedConnectionId || ''}
                  onChange={(e) => setSelectedConnectionId(e.target.value || null)}
                  className="flex-1 rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                >
                  <option value="">All Accounts ({connections.length})</option>
                  {connections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.displayPhoneNumber} ({c.displayName})
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setFilters((prev) => ({ ...prev, unreadOnly: !prev.unreadOnly }))}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition ${
                    filters.unreadOnly
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                      : 'border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  Unread
                </button>
              </div>

              <div className="relative">
                <SearchIcon className="w-4 h-4 absolute left-2.5 top-2.5 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search contacts or messages…"
                  value={filters.search || ''}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, search: e.target.value || undefined }))
                  }
                  className="w-full rounded-lg border border-neutral-300 pl-8 pr-3 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                />
              </div>
            </div>

            {/* Conversation Items List */}
            <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800">
              {isLoading && conversations.length === 0 ? (
                <div className="p-8 text-center text-sm text-neutral-400">
                  Loading conversations…
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-8 text-center text-sm text-neutral-400">
                  No conversations match your filter.
                </div>
              ) : (
                conversations.map((conv) => {
                  const isSelected = activeConversation?.id === conv.id;
                  return (
                    <div
                      key={conv.id}
                      onClick={() => void selectConversation(conv)}
                      className={`p-3.5 cursor-pointer transition flex items-start gap-3 ${
                        isSelected
                          ? 'bg-emerald-50/70 dark:bg-emerald-950/20'
                          : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-xs font-semibold text-neutral-700 dark:text-neutral-300 shrink-0">
                        {(conv.contact?.name || conv.contact?.waId || '?')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 truncate">
                            {conv.contact?.name || conv.contact?.waId}
                          </span>
                          <span className="text-[10px] text-neutral-400 shrink-0">
                            {conv.lastMessageAt
                              ? new Date(conv.lastMessageAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : ''}
                          </span>
                        </div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                          {conv.lastMessagePreview || 'No messages yet'}
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                            {conv.connection?.displayPhoneNumber || 'WhatsApp'}
                          </span>
                          {conv.unreadCount > 0 && (
                            <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-600 text-white">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Active Conversation View & AI Panel (Right: 7 columns) */}
          <div className="lg:col-span-7 flex flex-col h-[700px] rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900 overflow-hidden">
            {activeConversation ? (
              <>
                {/* Conversation Header */}
                <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-800/40">
                  <div>
                    <h3 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                      {activeConversation.contact?.name || activeConversation.contact?.waId}
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {activeConversation.contact?.waId} &bull; Received on{' '}
                      {activeConversation.connection?.displayPhoneNumber}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => void summarizeConversation(activeConversation.id)}
                      disabled={isSummarizing}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50"
                    >
                      <SparklesIcon className="w-3.5 h-3.5 text-emerald-500" />
                      {isSummarizing ? 'Summarizing…' : 'Summarize'}
                    </button>
                    <button
                      onClick={() => void suggestReply(activeConversation.id)}
                      disabled={isSuggestingReply}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300"
                    >
                      <SparklesIcon className="w-3.5 h-3.5 text-emerald-600" />
                      {isSuggestingReply ? 'Generating…' : 'Suggest Reply'}
                    </button>
                  </div>
                </div>

                {/* AI Summary Banner (if generated) */}
                {summary && (
                  <div className="p-3 bg-emerald-50/60 border-b border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/40 text-xs text-neutral-800 dark:text-neutral-200 space-y-1.5">
                    <div className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                      <span>AI Conversation Summary</span>
                      <button
                        onClick={() => {}}
                        className="text-neutral-400 hover:text-neutral-600"
                      >
                        <CloseIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p>{summary.summary}</p>
                    {summary.urgentItems.length > 0 && (
                      <div className="text-red-700 dark:text-red-400 font-medium">
                        🚨 Urgent: {summary.urgentItems.join(', ')}
                      </div>
                    )}
                    {summary.actionItems.length > 0 && (
                      <div className="text-neutral-600 dark:text-neutral-300">
                        ✓ Tasks: {summary.actionItems.join(' &bull; ')}
                      </div>
                    )}
                  </div>
                )}

                {/* AI Suggested Replies Pill Carousel (if generated) */}
                {replySuggestions && (
                  <div className="p-3 bg-neutral-100 border-b border-neutral-200 dark:bg-neutral-800/80 dark:border-neutral-700 text-xs space-y-2">
                    <div className="font-semibold text-neutral-700 dark:text-neutral-300">
                      Suggested Replies (Click to Load):
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {replySuggestions.suggestions.map((s, idx) => (
                        <div
                          key={idx}
                          onClick={() => setReplyText(s.text)}
                          className="p-2 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 cursor-pointer hover:border-emerald-500 transition"
                        >
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400 block mb-1">
                            {s.tone}
                          </span>
                          <span className="text-[11px] text-neutral-700 dark:text-neutral-300 line-clamp-3">
                            {s.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Message Timeline */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-neutral-50/30 dark:bg-neutral-950/20">
                  {messages.length === 0 ? (
                    <div className="text-center text-xs text-neutral-400 mt-10">
                      No messages recorded yet in this conversation.
                    </div>
                  ) : (
                    messages.map((m) => {
                      const isIncoming = m.direction === 'INCOMING';
                      return (
                        <div
                          key={m.id}
                          className={`flex flex-col ${isIncoming ? 'items-start' : 'items-end'}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-xs shadow-sm ${
                              isIncoming
                                ? 'bg-white border border-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-100 rounded-bl-none'
                                : 'bg-emerald-600 text-white rounded-br-none'
                            }`}
                          >
                            <div>{m.textContent || `[${m.messageType}]`}</div>
                            <div
                              className={`mt-1 flex items-center justify-end gap-1 text-[9px] ${
                                isIncoming ? 'text-neutral-400' : 'text-emerald-100'
                              }`}
                            >
                              <span>
                                {new Date(m.timestamp).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              {!isIncoming && (
                                <span className="font-medium uppercase">{m.deliveryStatus}</span>
                              )}
                            </div>
                          </div>
                          {m.analysis && (
                            <div className="mt-0.5 text-[9px] text-neutral-400 flex items-center gap-1 px-1">
                              {(m.analysis.urgency === 'URGENT' ||
                                m.analysis.priority === 'HIGH') && (
                                <span className="text-red-500 font-semibold">URGENT</span>
                              )}
                              <span>Category: {m.analysis.category}</span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Reply Composer Interface */}
                <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-2">
                  <div className="text-[11px] text-neutral-500 flex items-center justify-between">
                    <span>
                      Sending from:{' '}
                      <strong className="text-neutral-800 dark:text-neutral-200">
                        {activeConversation.connection?.displayPhoneNumber}
                      </strong>
                    </span>
                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                      🔒 Human Approval Enforced
                    </span>
                  </div>

                  <textarea
                    rows={2}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your WhatsApp reply here…"
                    className="w-full rounded-lg border border-neutral-300 p-2.5 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSaveDraft()}
                      disabled={isSubmittingDraft || !replyText.trim()}
                      className="px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 disabled:opacity-50"
                    >
                      Save as Draft
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleOpenApprovalModal()}
                      disabled={!replyText.trim()}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-xs font-medium text-white shadow hover:bg-emerald-700 disabled:opacity-50 transition"
                    >
                      Approve &amp; Send…
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-neutral-400 text-center">
                <MessagesIcon className="w-12 h-12 mb-3 text-neutral-300 dark:text-neutral-600" />
                <h4 className="font-semibold text-neutral-700 dark:text-neutral-300 text-sm">
                  No Conversation Selected
                </h4>
                <p className="text-xs text-neutral-500 mt-1 max-w-sm">
                  Select a conversation thread from the inbox on the left to read messages, run AI
                  summaries, or prepare replies.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Connect Account Modal */}
      {isConnectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                Connect WhatsApp Business Account
              </h3>
              <button
                onClick={() => setIsConnectModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            {connectError && (
              <div className="mt-3 p-2.5 text-xs rounded bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400">
                {connectError}
              </div>
            )}

            <form onSubmit={handleConnectSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Meta Business Account ID (WABA ID)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 109283746592817"
                  value={businessAccountId}
                  onChange={(e) => setBusinessAccountId(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Phone Number ID
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 102938475610293"
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Display Phone Number
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. +1 555-0100"
                  value={displayPhoneNumber}
                  onChange={(e) => setDisplayPhoneNumber(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Display / Channel Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Customer Support"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Permanent System User Access Token
                </label>
                <input
                  type="password"
                  required
                  placeholder="EAABwzLIX564BAO..."
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                />
                <p className="text-[10px] text-neutral-400 mt-1">
                  Tokens are encrypted locally with AES-256-GCM. Never logged or exposed.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsConnectModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow disabled:opacity-50"
                >
                  {isLoading ? 'Connecting…' : 'Save Connection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Disconnect Confirmation Modal */}
      {disconnectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
            <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              Disconnect WhatsApp Account?
            </h3>
            <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
              Are you sure you want to disconnect{' '}
              <strong>{disconnectTarget.displayPhoneNumber}</strong>? Stored conversation history
              and AI analysis will be preserved.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDisconnectTarget(null)}
                className="px-3 py-1.5 text-xs font-medium text-neutral-600 border border-neutral-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await disconnectAccount(disconnectTarget.id);
                  setDisconnectTarget(null);
                }}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Explicit Human Approval & Send Modal */}
      {approvalModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
                Explicit Human Approval Required
              </h3>
              <button
                onClick={() => {
                  setApprovalModalData(null);
                  setApprovalModalDraftId(null);
                }}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-lg bg-amber-50 p-3 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
              <strong>Strict Security Policy:</strong> BHUVI never sends WhatsApp messages
              automatically. Review the recipient, content, and sending channel before approving
              dispatch.
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <span className="font-semibold text-neutral-500">Recipient: </span>
                <span className="text-neutral-900 dark:text-neutral-100 font-medium">
                  {approvalModalData.recipient}
                </span>
              </div>
              <div>
                <span className="font-semibold text-neutral-500">Sending Channel: </span>
                <span className="text-neutral-900 dark:text-neutral-100 font-medium">
                  {approvalModalData.sendingPhone}
                </span>
              </div>
              <div className="border border-neutral-200 rounded-lg p-3 bg-neutral-50 dark:bg-neutral-800 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 whitespace-pre-wrap">
                {approvalModalData.content}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setApprovalModalData(null);
                  setApprovalModalDraftId(null);
                }}
                className="px-3.5 py-2 text-xs font-medium text-neutral-600 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-50"
              >
                Cancel / Edit
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmApproveAndSend()}
                disabled={isSending}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSending ? 'Sending via Meta API…' : 'Confirm Approval & Send Message'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
