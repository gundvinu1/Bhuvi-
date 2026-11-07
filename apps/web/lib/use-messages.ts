'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  MessageDto,
  MessageStatsDto,
  MessageActionItemDto,
  MessageAnalysisResult,
  ActionItemStatus,
  MessageCategory,
  MessagePriority,
  MessageUrgency,
  MessageProcessingStatus,
} from '@bhuvi/shared';
import { apiFetch } from './api';

export interface MessageFilters {
  category?: MessageCategory;
  priority?: MessagePriority;
  urgency?: MessageUrgency;
  status?: MessageProcessingStatus;
  search?: string;
}

export interface UseMessagesReturn {
  messages: MessageDto[];
  activeMessage: MessageDto | null;
  stats: MessageStatsDto | null;
  actionItems: MessageActionItemDto[];
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  filters: MessageFilters;
  setFilters: React.Dispatch<React.SetStateAction<MessageFilters>>;
  createMessage: (payload: {
    senderName: string;
    senderIdentifier?: string;
    subject?: string;
    content: string;
    autoAnalyze?: boolean;
  }) => Promise<MessageDto | null>;
  analyzePreview: (payload: {
    content: string;
    senderName?: string;
    subject?: string;
  }) => Promise<MessageAnalysisResult | null>;
  analyzeExistingMessage: (id: string) => Promise<void>;
  updateActionItemStatus: (id: string, status: ActionItemStatus) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  selectMessage: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useMessages(): UseMessagesReturn {
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [activeMessage, setActiveMessage] = useState<MessageDto | null>(null);
  const [stats, setStats] = useState<MessageStatsDto | null>(null);
  const [actionItems, setActionItems] = useState<MessageActionItemDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<MessageFilters>({});

  const fetchMessagesAndStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (filters.category) queryParams.set('category', filters.category);
      if (filters.priority) queryParams.set('priority', filters.priority);
      if (filters.urgency) queryParams.set('urgency', filters.urgency);
      if (filters.status) queryParams.set('status', filters.status);
      if (filters.search) queryParams.set('search', filters.search);

      const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

      const [msgRes, statsRes, actionsRes] = await Promise.all([
        apiFetch<{ messages: MessageDto[]; total: number }>(`/messages${queryString}`).catch(
          () => null,
        ),
        apiFetch<MessageStatsDto>('/messages/stats').catch(() => null),
        apiFetch<MessageActionItemDto[]>('/messages/actions').catch(() => null),
      ]);

      if (msgRes && msgRes.data) {
        setMessages(msgRes.data.messages);
        if (msgRes.data.messages.length > 0 && !activeMessage) {
          setActiveMessage(msgRes.data.messages[0] || null);
        }
      }

      if (statsRes && statsRes.data) {
        setStats(statsRes.data);
      }

      if (actionsRes && actionsRes.data) {
        setActionItems(actionsRes.data);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch messages');
    } finally {
      setIsLoading(false);
    }
  }, [filters, activeMessage]);

  useEffect(() => {
    void fetchMessagesAndStats();
  }, [fetchMessagesAndStats]);

  const selectMessage = async (id: string) => {
    try {
      const res = await apiFetch<MessageDto>(`/messages/${id}`);
      if (res && res.data) {
        setActiveMessage(res.data);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to select message');
    }
  };

  const createMessage = async (payload: {
    senderName: string;
    senderIdentifier?: string;
    subject?: string;
    content: string;
    autoAnalyze?: boolean;
  }): Promise<MessageDto | null> => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch<MessageDto>('/messages', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res && res.data) {
        setMessages((prev) => [res.data, ...prev]);
        setActiveMessage(res.data);
        void fetchMessagesAndStats();
        return res.data;
      }
      return null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit message';
      setError(msg);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  const analyzePreview = async (payload: {
    content: string;
    senderName?: string;
    subject?: string;
  }): Promise<MessageAnalysisResult | null> => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch<MessageAnalysisResult>('/messages/analyze-preview', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res?.data || null;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Preview analysis failed');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  const analyzeExistingMessage = async (id: string) => {
    setIsSubmitting(true);
    try {
      const res = await apiFetch<MessageDto>(`/messages/${id}/analyze`, {
        method: 'POST',
      });
      if (res && res.data) {
        setActiveMessage(res.data);
        setMessages((prev) => prev.map((m) => (m.id === id ? res.data : m)));
        void fetchMessagesAndStats();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to re-analyze message');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateActionItemStatus = async (id: string, status: ActionItemStatus) => {
    try {
      const res = await apiFetch<MessageActionItemDto>(`/messages/actions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      if (res && res.data) {
        setActionItems((prev) => prev.map((item) => (item.id === id ? res.data : item)));
        if (activeMessage && activeMessage.actionItems) {
          setActiveMessage({
            ...activeMessage,
            actionItems: activeMessage.actionItems.map((item) =>
              item.id === id ? res.data : item,
            ),
          });
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update action item');
    }
  };

  const deleteMessage = async (id: string) => {
    try {
      await apiFetch<{ deleted: boolean }>(`/messages/${id}`, {
        method: 'DELETE',
      });
      setMessages((prev) => prev.filter((m) => m.id !== id));
      if (activeMessage?.id === id) {
        setActiveMessage(null);
      }
      void fetchMessagesAndStats();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete message');
    }
  };

  return {
    messages,
    activeMessage,
    stats,
    actionItems,
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
    refresh: fetchMessagesAndStats,
  };
}
