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
}

export function useGmail() {
  const [connection, setConnection] = useState<GmailConnectionDto | null>(null);
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

  const loadConnection = useCallback(async () => {
    try {
      const res = await apiFetch<GmailConnectionDto | null>('gmail/connection');
      if (res.success) {
        setConnection(res.data);
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.status === 401) {
        return;
      }
      setError((err as Error).message);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const res = await apiFetch<GmailSyncStatsDto>('gmail/sync/stats');
      if (res.success) {
        setStats(res.data);
      }
    } catch {
      // Non-fatal if connection is not present
    }
  }, []);

  const loadMessages = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (filters.search) queryParams.set('search', filters.search);
      if (filters.category) queryParams.set('category', filters.category);
      if (filters.priority) queryParams.set('priority', filters.priority);
      if (filters.unreadOnly) queryParams.set('unreadOnly', 'true');
      if (filters.importantOnly) queryParams.set('importantOnly', 'true');

      const url = `gmail/messages?${queryParams.toString()}`;
      const res = await apiFetch<PaginatedGmailMessagesResponse>(url);
      if (res.success) {
        setMessages(res.data.messages);
        if (res.data.messages.length > 0 && !activeMessage) {
          setActiveMessage(res.data.messages[0] || null);
        }
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [filters, activeMessage]);

  const selectMessage = useCallback(async (id: string) => {
    try {
      const res = await apiFetch<GmailMessageDto>(`gmail/messages/${id}`);
      if (res.success) {
        setActiveMessage(res.data);
      }
      // Load thread
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

  const disconnectGmail = useCallback(async () => {
    try {
      await apiFetch<{ disconnected: boolean }>('gmail/disconnect', { method: 'POST' });
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
    async (max = 50) => {
      setIsSyncing(true);
      setError(null);
      try {
        await apiFetch<{ syncedCount: number }>(`gmail/sync?max=${max}`, { method: 'POST' });
        await loadConnection();
        await loadStats();
        await loadMessages();
      } catch (err: unknown) {
        setError((err as Error).message);
      } finally {
        setIsSyncing(false);
      }
    },
    [loadConnection, loadStats, loadMessages],
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
      payload: { to: string; subject: string; body: string; threadId?: string },
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
    async (question: string): Promise<{ answer: string; references: any[] } | null> => {
      setIsAsking(true);
      try {
        const res = await apiFetch<{ answer: string; references: any[] }>('gmail/ask', {
          method: 'POST',
          body: JSON.stringify({ question }),
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
    [],
  );

  useEffect(() => {
    loadConnection();
    loadStats();
    loadMessages();
  }, [loadConnection, loadStats, loadMessages]);

  return {
    connection,
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
    loadConnection,
    connectGmail,
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
