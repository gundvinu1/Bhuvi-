'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  MemoryDto,
  MemoryStatsDto,
  MemorySearchResult,
  MemoryAskResult,
  MemoryCategory,
  MemoryImportance,
  MemoryStatus,
} from '@bhuvi/shared';
import { apiFetch, ApiClientError } from './api';

export interface MemoryFilters {
  category?: MemoryCategory;
  importance?: MemoryImportance;
  status?: MemoryStatus;
  search?: string;
}

export interface UseMemoryReturn {
  memories: MemoryDto[];
  activeMemory: MemoryDto | null;
  stats: MemoryStatsDto | null;
  searchResults: MemorySearchResult[];
  askResult: MemoryAskResult | null;
  isLoading: boolean;
  isSearching: boolean;
  isAsking: boolean;
  isSaving: boolean;
  error: string | null;
  filters: MemoryFilters;
  setFilters: React.Dispatch<React.SetStateAction<MemoryFilters>>;
  createMemory: (payload: {
    title: string;
    content: string;
    category: MemoryCategory;
    importance?: MemoryImportance;
    tags?: string[];
  }) => Promise<MemoryDto | null>;
  updateMemory: (
    id: string,
    payload: {
      title?: string;
      content?: string;
      category?: MemoryCategory;
      importance?: MemoryImportance;
      tags?: string[];
    },
  ) => Promise<MemoryDto | null>;
  deleteMemory: (id: string) => Promise<boolean>;
  reprocessMemory: (id: string) => Promise<void>;
  selectMemory: (id: string) => Promise<void>;
  searchMemories: (
    query: string,
    options?: { limit?: number; threshold?: number; category?: MemoryCategory },
  ) => Promise<void>;
  askQuestion: (
    question: string,
    options?: { limit?: number; minSimilarity?: number },
  ) => Promise<void>;
  clearAskResult: () => void;
  clearSearchResults: () => void;
  refresh: () => Promise<void>;
}

export function useMemory(): UseMemoryReturn {
  const [memories, setMemories] = useState<MemoryDto[]>([]);
  const [activeMemory, setActiveMemory] = useState<MemoryDto | null>(null);
  const [stats, setStats] = useState<MemoryStatsDto | null>(null);
  const [searchResults, setSearchResults] = useState<MemorySearchResult[]>([]);
  const [askResult, setAskResult] = useState<MemoryAskResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isAsking, setIsAsking] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<MemoryFilters>({});

  const fetchStats = useCallback(async () => {
    try {
      const res = await apiFetch<MemoryStatsDto>('/memory/stats');
      if (res.success && res.data) {
        setStats(res.data);
      }
    } catch (err: unknown) {
      // Non-blocking error for stats
    }
  }, []);

  const fetchMemories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.category) params.set('category', filters.category);
      if (filters.importance) params.set('importance', filters.importance);
      if (filters.status) params.set('status', filters.status);
      if (filters.search) params.set('search', filters.search);
      params.set('limit', '50');

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const res = await apiFetch<{ memories: MemoryDto[]; total: number }>(`/memory${queryString}`);

      if (res.success && res.data) {
        setMemories(res.data.memories);
      }
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : 'Failed to load personal memories';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void fetchMemories();
    void fetchStats();
  }, [fetchMemories, fetchStats]);

  const selectMemory = async (id: string) => {
    setError(null);
    try {
      const res = await apiFetch<MemoryDto>(`/memory/${id}`);
      if (res.success && res.data) {
        setActiveMemory(res.data);
      }
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : 'Failed to retrieve memory details';
      setError(msg);
    }
  };

  const createMemory = async (payload: {
    title: string;
    content: string;
    category: MemoryCategory;
    importance?: MemoryImportance;
    tags?: string[];
  }): Promise<MemoryDto | null> => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await apiFetch<MemoryDto>('/memory', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success && res.data) {
        await fetchMemories();
        await fetchStats();
        setActiveMemory(res.data);
        return res.data;
      }
      return null;
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : 'Failed to create memory';
      setError(msg);
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const updateMemory = async (
    id: string,
    payload: {
      title?: string;
      content?: string;
      category?: MemoryCategory;
      importance?: MemoryImportance;
      tags?: string[];
    },
  ): Promise<MemoryDto | null> => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await apiFetch<MemoryDto>(`/memory/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      if (res.success && res.data) {
        await fetchMemories();
        await fetchStats();
        setActiveMemory(res.data);
        return res.data;
      }
      return null;
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : 'Failed to update memory';
      setError(msg);
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const deleteMemory = async (id: string): Promise<boolean> => {
    setError(null);
    try {
      const res = await apiFetch<{ deleted: boolean }>(`/memory/${id}`, {
        method: 'DELETE',
      });

      if (res.success) {
        if (activeMemory?.id === id) {
          setActiveMemory(null);
        }
        await fetchMemories();
        await fetchStats();
        return true;
      }
      return false;
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : 'Failed to delete memory';
      setError(msg);
      return false;
    }
  };

  const reprocessMemory = async (id: string): Promise<void> => {
    setError(null);
    try {
      const res = await apiFetch<MemoryDto>(`/memory/${id}/reprocess`, {
        method: 'POST',
      });

      if (res.success && res.data) {
        await fetchMemories();
        await fetchStats();
        if (activeMemory?.id === id) {
          setActiveMemory(res.data);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : 'Failed to reprocess memory';
      setError(msg);
    }
  };

  const searchMemories = async (
    query: string,
    options?: { limit?: number; threshold?: number; category?: MemoryCategory },
  ): Promise<void> => {
    if (!query.trim()) return;
    setIsSearching(true);
    setError(null);
    try {
      const res = await apiFetch<MemorySearchResult[]>('/memory/search', {
        method: 'POST',
        body: JSON.stringify({
          query: query.trim(),
          limit: options?.limit ?? 5,
          threshold: options?.threshold ?? 0.45,
          category: options?.category,
        }),
      });

      if (res.success && res.data) {
        setSearchResults(res.data);
      }
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : 'Semantic vector search failed';
      setError(msg);
    } finally {
      setIsSearching(false);
    }
  };

  const askQuestion = async (
    question: string,
    options?: { limit?: number; minSimilarity?: number },
  ): Promise<void> => {
    if (!question.trim()) return;
    setIsAsking(true);
    setError(null);
    try {
      const res = await apiFetch<MemoryAskResult>('/memory/ask', {
        method: 'POST',
        body: JSON.stringify({
          question: question.trim(),
          limit: options?.limit ?? 4,
          minSimilarity: options?.minSimilarity ?? 0.45,
        }),
      });

      if (res.success && res.data) {
        setAskResult(res.data);
      }
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : 'RAG question query failed';
      setError(msg);
    } finally {
      setIsAsking(false);
    }
  };

  const clearAskResult = () => setAskResult(null);
  const clearSearchResults = () => setSearchResults([]);

  const refresh = async () => {
    await Promise.all([fetchMemories(), fetchStats()]);
  };

  return {
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
  };
}
