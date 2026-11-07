'use client';

import { useState, useEffect, useCallback } from 'react';
import { HealthCheckResponse } from '@bhuvi/shared';
import { apiFetch } from './api';

export type SystemStatusType = 'healthy' | 'degraded' | 'unavailable' | 'checking';

export interface UseHealthReturn {
  health: HealthCheckResponse | null;
  status: SystemStatusType;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useHealth(pollIntervalMs: number = 30000): UseHealthReturn {
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [status, setStatus] = useState<SystemStatusType>('checking');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      // Direct call to /health (health endpoint is public)
      const res = await apiFetch<HealthCheckResponse>('/health');
      if (res && res.data) {
        setHealth(res.data);
        if (res.data.status === 'healthy') {
          setStatus('healthy');
        } else if (res.data.status === 'degraded') {
          setStatus('degraded');
        } else {
          setStatus('unavailable');
        }
        setError(null);
      } else {
        setStatus('unavailable');
        setError('Invalid health payload');
      }
    } catch (err: unknown) {
      setHealth(null);
      setStatus('unavailable');
      setError(err instanceof Error ? err.message : 'Backend unreachable');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHealth();
    if (pollIntervalMs > 0) {
      const interval = setInterval(() => {
        void fetchHealth();
      }, pollIntervalMs);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [fetchHealth, pollIntervalMs]);

  return {
    health,
    status,
    isLoading,
    error,
    refresh: fetchHealth,
  };
}
