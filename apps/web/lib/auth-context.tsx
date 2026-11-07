'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { SafeUser } from '@bhuvi/shared';
import { apiFetch, ApiClientError } from './api';

export interface AuthContextValue {
  user: SafeUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchCurrentUser = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiFetch<SafeUser>('/auth/me');
      if (response && response.data) {
        setUser(response.data);
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
      if (err instanceof ApiClientError && err.status !== 401) {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCurrentUser();
  }, [fetchCurrentUser]);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await apiFetch<{ message: string }>('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors during logout
    } finally {
      setUser(null);
      setIsLoading(false);
      try {
        router.push('/login');
      } catch {
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    }
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      error,
      logout,
      refreshUser: fetchCurrentUser,
    }),
    [user, isLoading, error, logout, fetchCurrentUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Route protection guard for dashboard views.
 * Displays a branded loading state while verifying session,
 * and redirects unauthenticated visitors to /login.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      try {
        router.replace('/login');
      } catch {
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-gray-200">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bhuvi-gradient flex items-center justify-center shadow-2xl animate-pulse">
            <span className="text-2xl font-black text-white">B</span>
          </div>
          <div className="absolute -inset-2 rounded-3xl border border-bhuvi-500/20 animate-spin" />
        </div>
        <p className="mt-4 text-xs font-mono uppercase tracking-widest text-bhuvi-300">
          Loading BHUVI OS...
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-gray-400">
        <p className="text-sm font-medium">Redirecting to login...</p>
      </div>
    );
  }

  return <>{children}</>;
}
