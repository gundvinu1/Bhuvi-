'use client';

import { useState, useEffect, useCallback } from 'react';
import { AiStatusResponse, AiChatResponse } from '@bhuvi/shared';
import { apiFetch, ApiClientError } from './api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  durationMs?: number;
  timestamp: string;
}

export interface UseAiReturn {
  status: AiStatusResponse | null;
  isStatusLoading: boolean;
  statusError: string | null;
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (prompt: string) => Promise<void>;
  clearChat: () => void;
  refreshStatus: () => Promise<void>;
}

export function useAi(): UseAiReturn {
  const [status, setStatus] = useState<AiStatusResponse | null>(null);
  const [isStatusLoading, setIsStatusLoading] = useState<boolean>(true);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setIsStatusLoading(true);
    setStatusError(null);
    try {
      const res = await apiFetch<AiStatusResponse>('/ai/status');
      if (res && res.data) {
        setStatus(res.data);
      } else {
        setStatus({
          provider: 'ollama',
          status: 'unavailable',
          model: 'qwen2.5:3b',
          modelAvailable: false,
          error: 'Invalid status payload',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI server unavailable';
      setStatus({
        provider: 'ollama',
        status: 'unavailable',
        model: 'qwen2.5:3b',
        modelAvailable: false,
        error: msg,
      });
      setStatusError(msg);
    } finally {
      setIsStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const sendMessage = useCallback(
    async (prompt: string) => {
      const cleanPrompt = prompt.trim();
      if (!cleanPrompt || isLoading) return;

      setError(null);
      const userMessageId = `usr-${Date.now()}`;
      const userMessage: ChatMessage = {
        id: userMessageId,
        role: 'user',
        content: cleanPrompt,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        const res = await apiFetch<AiChatResponse>('/ai/chat', {
          method: 'POST',
          body: JSON.stringify({ message: cleanPrompt }),
        });

        const assistantMessage: ChatMessage = {
          id: `bot-${Date.now()}`,
          role: 'assistant',
          content: res.data.response,
          model: res.data.model,
          durationMs: res.data.durationMs,
          timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err: unknown) {
        let msg = 'Failed to generate response.';
        if (err instanceof ApiClientError) {
          msg = err.message;
        } else if (err instanceof Error) {
          msg = err.message;
        }
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading],
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    status,
    isStatusLoading,
    statusError,
    messages,
    isLoading,
    error,
    sendMessage,
    clearChat,
    refreshStatus: fetchStatus,
  };
}
