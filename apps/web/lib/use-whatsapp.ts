'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  WhatsAppConnectionDto,
  WhatsAppConversationDto,
  WhatsAppMessageDto,
  WhatsAppDraftDto,
  WhatsAppSummaryDto,
  WhatsAppReplySuggestionDto,
  WhatsAppAskResponseDto,
  WhatsAppStatsDto,
  CreateWhatsAppConnectionDto,
  CreateWhatsAppDraftDto,
} from '@bhuvi/shared';
import { apiFetch, ApiClientError } from './api';

export interface WhatsAppFilters {
  search?: string;
  unreadOnly?: boolean;
  urgentOnly?: boolean;
  connectionId?: string;
  status?: string;
}

export function useWhatsApp() {
  const [connections, setConnections] = useState<WhatsAppConnectionDto[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);

  const [conversations, setConversations] = useState<WhatsAppConversationDto[]>([]);
  const [activeConversation, setActiveConversation] = useState<WhatsAppConversationDto | null>(
    null,
  );
  const [messages, setMessages] = useState<WhatsAppMessageDto[]>([]);
  const [drafts, setDrafts] = useState<WhatsAppDraftDto[]>([]);
  const [stats, setStats] = useState<WhatsAppStatsDto | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [isSuggestingReply, setIsSuggestingReply] = useState<boolean>(false);
  const [isSubmittingDraft, setIsSubmittingDraft] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isAsking, setIsAsking] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<WhatsAppSummaryDto | null>(null);
  const [replySuggestions, setReplySuggestions] = useState<WhatsAppReplySuggestionDto | null>(null);
  const [askResult, setAskResult] = useState<WhatsAppAskResponseDto | null>(null);

  const [filters, setFilters] = useState<WhatsAppFilters>({});

  // ------------------------------------------------------------
  // Connections
  // ------------------------------------------------------------
  const loadConnections = useCallback(async () => {
    try {
      const res = await apiFetch<WhatsAppConnectionDto[]>('whatsapp/connections');
      if (res.success && Array.isArray(res.data)) {
        setConnections(res.data);
      }
    } catch (err: unknown) {
      setError((err as ApiClientError).message);
    }
  }, []);

  const connectAccount = async (dto: CreateWhatsAppConnectionDto) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch<WhatsAppConnectionDto>('whatsapp/connections', {
        method: 'POST',
        body: JSON.stringify(dto),
      });
      if (res.success && res.data) {
        await loadConnections();
        return res.data;
      }
      return null;
    } catch (err: unknown) {
      setError((err as ApiClientError).message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectAccount = async (connectionId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await apiFetch<{ disconnected: boolean }>(`whatsapp/connections/${connectionId}/disconnect`, {
        method: 'POST',
      });
      await loadConnections();
      if (selectedConnectionId === connectionId) {
        setSelectedConnectionId(null);
      }
    } catch (err: unknown) {
      setError((err as ApiClientError).message);
    } finally {
      setIsLoading(false);
    }
  };

  // ------------------------------------------------------------
  // Conversations & Messages
  // ------------------------------------------------------------
  const loadConversations = useCallback(async () => {
    try {
      const queryParams = new URLSearchParams();
      if (selectedConnectionId) queryParams.set('connectionId', selectedConnectionId);
      if (filters.search) queryParams.set('search', filters.search);
      if (filters.unreadOnly) queryParams.set('unread', 'true');
      if (filters.urgentOnly) queryParams.set('urgent', 'true');
      if (filters.status) queryParams.set('status', filters.status);

      const url = `whatsapp/conversations?${queryParams.toString()}`;
      const res = await apiFetch<{ items: WhatsAppConversationDto[]; total: number }>(url);
      if (res.success && res.data) {
        setConversations(res.data.items);
      }
    } catch (err: unknown) {
      setError((err as ApiClientError).message);
    }
  }, [selectedConnectionId, filters]);

  const selectConversation = async (conv: WhatsAppConversationDto) => {
    setActiveConversation(conv);
    setSummary(null);
    setReplySuggestions(null);
    try {
      const res = await apiFetch<{ items: WhatsAppMessageDto[]; total: number }>(
        `whatsapp/conversations/${conv.id}/messages`,
      );
      if (res.success && res.data) {
        setMessages(res.data.items);
      }
    } catch (err: unknown) {
      setError((err as ApiClientError).message);
    }
  };

  // ------------------------------------------------------------
  // Drafts & Human Approval
  // ------------------------------------------------------------
  const loadDrafts = useCallback(async () => {
    try {
      const res = await apiFetch<WhatsAppDraftDto[]>('whatsapp/drafts');
      if (res.success && Array.isArray(res.data)) {
        setDrafts(res.data);
      }
    } catch (err: unknown) {
      setError((err as ApiClientError).message);
    }
  }, []);

  const createDraft = async (dto: CreateWhatsAppDraftDto) => {
    setIsSubmittingDraft(true);
    setError(null);
    try {
      const res = await apiFetch<WhatsAppDraftDto>('whatsapp/drafts', {
        method: 'POST',
        body: JSON.stringify(dto),
      });
      if (res.success && res.data) {
        await loadDrafts();
        return res.data;
      }
      return null;
    } catch (err: unknown) {
      setError((err as ApiClientError).message);
      throw err;
    } finally {
      setIsSubmittingDraft(false);
    }
  };

  const approveDraft = async (draftId: string) => {
    setError(null);
    try {
      const res = await apiFetch<WhatsAppDraftDto>(`whatsapp/drafts/${draftId}/approve`, {
        method: 'POST',
      });
      if (res.success && res.data) {
        await loadDrafts();
        return res.data;
      }
      return null;
    } catch (err: unknown) {
      setError((err as ApiClientError).message);
      throw err;
    }
  };

  const sendDraft = async (draftId: string) => {
    setIsSending(true);
    setError(null);
    try {
      const res = await apiFetch<{ status: string; draftId: string; externalMessageId: string }>(
        `whatsapp/drafts/${draftId}/send`,
        { method: 'POST' },
      );
      if (res.success && res.data) {
        await loadDrafts();
        if (activeConversation) {
          await selectConversation(activeConversation);
        }
        return res.data;
      }
      return null;
    } catch (err: unknown) {
      setError((err as ApiClientError).message);
      throw err;
    } finally {
      setIsSending(false);
    }
  };

  // ------------------------------------------------------------
  // AI Operations
  // ------------------------------------------------------------
  const summarizeConversation = async (conversationId: string) => {
    setIsSummarizing(true);
    setError(null);
    try {
      const res = await apiFetch<WhatsAppSummaryDto>(
        `whatsapp/conversations/${conversationId}/summarize`,
        { method: 'POST' },
      );
      if (res.success && res.data) {
        setSummary(res.data);
      }
    } catch (err: unknown) {
      setError((err as ApiClientError).message);
    } finally {
      setIsSummarizing(false);
    }
  };

  const suggestReply = async (conversationId: string, tone?: string) => {
    setIsSuggestingReply(true);
    setError(null);
    try {
      const res = await apiFetch<WhatsAppReplySuggestionDto>(
        `whatsapp/conversations/${conversationId}/suggest-reply`,
        {
          method: 'POST',
          body: JSON.stringify({ tone }),
        },
      );
      if (res.success && res.data) {
        setReplySuggestions(res.data);
      }
    } catch (err: unknown) {
      setError((err as ApiClientError).message);
    } finally {
      setIsSuggestingReply(false);
    }
  };

  const askWhatsApp = async (question: string) => {
    setIsAsking(true);
    setError(null);
    try {
      const res = await apiFetch<WhatsAppAskResponseDto>('whatsapp/ask', {
        method: 'POST',
        body: JSON.stringify({
          question,
          connectionId: selectedConnectionId || undefined,
          conversationId: activeConversation?.id || undefined,
        }),
      });
      if (res.success && res.data) {
        setAskResult(res.data);
      }
    } catch (err: unknown) {
      setError((err as ApiClientError).message);
    } finally {
      setIsAsking(false);
    }
  };

  const loadStats = useCallback(async () => {
    try {
      const res = await apiFetch<WhatsAppStatsDto>('whatsapp/stats');
      if (res.success && res.data) {
        setStats(res.data);
      }
    } catch {
      // Non-critical stats error
    }
  }, []);

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      await Promise.all([loadConnections(), loadConversations(), loadDrafts(), loadStats()]);
      setIsLoading(false);
    })();
  }, [loadConnections, loadConversations, loadDrafts, loadStats]);

  return {
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
    refreshConversations: loadConversations,
  };
}
