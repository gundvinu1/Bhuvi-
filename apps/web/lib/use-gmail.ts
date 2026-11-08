'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  GmailConnectionDto,
  GmailSyncStatsDto,
  GmailMessageDto,
  GmailSuggestedReplyDto,
  GmailDraftCreatedResult,
  GmailSummaryResponse,
  PaginatedGmailMessagesResponse,
  GmailConnectUrlResponse,
} from '@bhuvi/shared';
import { apiFetch, ApiClientError } from './api';

export interface GmailFilters {
  search?: string;
  category?: string;
  priority?: string;
  unreadOnly?: boolean;
  importantOnly?: boolean;
  connectionId?: string;
}

export function useGmail() {
  const [connections, setConnections] = useState<GmailConnectionDto[]>([]);
  const [connection, setConnection] = useState<GmailConnectionDto | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);

  const [stats, setStats] = useState<GmailSyncStatsDto | null>(null);
  const [messages, setMessages] = useState<GmailMessageDto[]>([]);
  const [activeMessage, setActiveMessage] = useState<GmailMessageDto | null>(null);
  const [threadMessages, setThreadMessages] = useState<GmailMessageDto[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [isGeneratingReply, setIsGeneratingReply] = useState<boolean>(false);
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);
  const [isAsking, setIsAsking] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<GmailFilters>({});

  const loadConnections = useCallback(async () => {
    try {
      const res = await apiFetch<GmailConnectionDto[]>('gmail/connections');
      if (res.success && Array.isArray(res.data)) {
        setConnections(res.data);
        setConnection(res.data[0] || null);
      } else {
        // Fallback to single connection endpoint
        const singleRes = await apiFetch<GmailConnectionDto | null>('gmail/connection');
        if (singleRes.success) {
          const list = singleRes.data ? [singleRes.data] : [];
          setConnections(list);
          setConnection(singleRes.data);
        }
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.status === 401) {
        return;
      }
      setError((err as Error).message);
    }
  }, []);

  const loadConnection = useCallback(async () => {
    return loadConnections();
  }, [loadConnections]);

  const loadStats = useCallback(
    async (connId?: string | null) => {
      try {
        const targetId = connId !== undefined ? connId : selectedConnectionId;
        const query = targetId ? `?connectionId=${encodeURIComponent(targetId)}` : '';
        const res = await apiFetch<GmailSyncStatsDto>(`gmail/sync/stats${query}`);
        if (res.success) {
          setStats(res.data);
        }
      } catch {
        // Non-fatal if connection is not present
      }
    },
    [selectedConnectionId],
  );

  const loadMessages = useCallback(
    async (connId?: string | null) => {
      setIsLoading(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams();
        const activeConn = connId !== undefined ? connId : selectedConnectionId;
        if (activeConn) queryParams.set('connectionId', activeConn);
        if (filters.search) queryParams.set('search', filters.search);
        if (filters.category) queryParams.set('category', filters.category);
        if (filters.priority) queryParams.set('priority', filters.priority);
        if (filters.unreadOnly) queryParams.set('unreadOnly', 'true');
        if (filters.importantOnly) queryParams.set('importantOnly', 'true');

        const url = `gmail/messages?${queryParams.toString()}`;
        const res = await apiFetch<PaginatedGmailMessagesResponse>(url);
        if (res.success) {
          setMessages(res.data.messages);
          if (res.data.messages.length > 0) {
            setActiveMessage(res.data.messages[0] || null);
          } else {
            setActiveMessage(null);
          }
        }
      } catch (err: unknown) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    },
    [filters, selectedConnectionId],
  );

  const selectMessage = useCallback(async (id: string) => {
    try {
      const res = await apiFetch<GmailMessageDto>(`gmail/messages/${id}`);
      if (res.success) {
        setActiveMessage(res.data);
      }
      const threadRes = await apiFetch<GmailMessageDto[]>(`gmail/messages/${id}/thread`);
      if (threadRes.success) {
        setThreadMessages(threadRes.data);
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  }, []);

  const connectGmail = useCallback(async () => {
    try {
      const res = await apiFetch<GmailConnectUrlResponse>('gmail/oauth/connect');
      if (res.success && res.data.url) {
        window.location.href = res.data.url;
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  }, []);

  const disconnectConnection = useCallback(
    async (connectionId: string) => {
      try {
        await apiFetch<{ disconnected: boolean }>(`gmail/connections/${connectionId}/disconnect`, {
          method: 'POST',
        });
        await loadConnections();
        await loadStats();
        await loadMessages();
      } catch (err: unknown) {
        setError((err as Error).message);
      }
    },
    [loadConnections, loadStats, loadMessages],
  );

  const disconnectGmail = useCallback(async () => {
    try {
      await apiFetch<{ disconnected: boolean }>('gmail/disconnect', { method: 'POST' });
      setConnections([]);
      setConnection(null);
      setMessages([]);
      setActiveMessage(null);
      setThreadMessages([]);
      await loadStats();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  }, [loadStats]);

  const triggerSync = useCallback(
    async (max = 50, connectionId?: string | null) => {
      setIsSyncing(true);
      setError(null);
      try {
        const targetId = connectionId !== undefined ? connectionId : selectedConnectionId;
        const endpoint = targetId
          ? `gmail/connections/${encodeURIComponent(targetId)}/sync?max=${max}`
          : `gmail/sync-all?max=${max}`;

        await apiFetch<{ syncedCount: number }>(endpoint, { method: 'POST' });
        await loadConnections();
        await loadStats(targetId);
        await loadMessages(targetId);
      } catch (err: unknown) {
        setError((err as Error).message);
      } finally {
        setIsSyncing(false);
      }
    },
    [loadConnections, loadStats, loadMessages, selectedConnectionId],
  );

  const summarizeMessage = useCallback(async (id: string): Promise<GmailSummaryResponse | null> => {
    setIsSummarizing(true);
    try {
      const res = await apiFetch<GmailSummaryResponse>(`gmail/messages/${id}/summarize`, {
        method: 'POST',
      });
      if (res.success) {
        return res.data;
      }
      return null;
    } catch (err: unknown) {
      setError((err as Error).message);
      return null;
    } finally {
      setIsSummarizing(false);
    }
  }, []);

  const suggestReply = useCallback(
    async (id: string, instruction?: string): Promise<GmailSuggestedReplyDto | null> => {
      setIsGeneratingReply(true);
      try {
        const res = await apiFetch<GmailSuggestedReplyDto>(`gmail/messages/${id}/suggest-reply`, {
          method: 'POST',
          body: JSON.stringify({ instruction }),
        });
        if (res.success) {
          return res.data;
        }
        return null;
      } catch (err: unknown) {
        setError((err as Error).message);
        return null;
      } finally {
        setIsGeneratingReply(false);
      }
    },
    [],
  );

  const createDraft = useCallback(
    async (
      id: string,
      payload: {
        to: string;
        subject: string;
        body: string;
        threadId?: string;
        connectionId?: string;
      },
    ): Promise<GmailDraftCreatedResult | null> => {
      setIsSavingDraft(true);
      try {
        const res = await apiFetch<GmailDraftCreatedResult>(`gmail/messages/${id}/create-draft`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (res.success) {
          return res.data;
        }
        return null;
      } catch (err: unknown) {
        setError((err as Error).message);
        return null;
      } finally {
        setIsSavingDraft(false);
      }
    },
    [],
  );

  const askAboutEmails = useCallback(
    async (
      question: string,
      connectionId?: string | null,
    ): Promise<{ answer: string; references: any[] } | null> => {
      setIsAsking(true);
      try {
        const targetId = connectionId !== undefined ? connectionId : selectedConnectionId;
        const res = await apiFetch<{ answer: string; references: any[] }>('gmail/ask', {
          method: 'POST',
          body: JSON.stringify({ question, connectionId: targetId || undefined }),
        });
        if (res.success) {
          return res.data;
        }
        return null;
      } catch (err: unknown) {
        setError((err as Error).message);
        return null;
      } finally {
        setIsAsking(false);
      }
    },
    [selectedConnectionId],
  );

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  useEffect(() => {
    loadStats(selectedConnectionId);
    loadMessages(selectedConnectionId);
  }, [loadStats, loadMessages, selectedConnectionId]);

  return {
    connections,
    connection,
    selectedConnectionId,
    setSelectedConnectionId,
    stats,
    messages,
    activeMessage,
    threadMessages,
    isLoading,
    isSyncing,
    isSummarizing,
    isGeneratingReply,
    isSavingDraft,
    isAsking,
    error,
    filters,
    setFilters,
    loadConnections,
    loadConnection,
    connectGmail,
    disconnectConnection,
    disconnectGmail,
    triggerSync,
    loadMessages,
    selectMessage,
    summarizeMessage,
    suggestReply,
    createDraft,
    askAboutEmails,
  };
}
