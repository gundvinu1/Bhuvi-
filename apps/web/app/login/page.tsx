'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { APP_FULL_NAME, APP_NAME, ApiResponse, AuthResponseData, SafeUser } from '@bhuvi/shared';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifiedUser, setVerifiedUser] = useState<SafeUser | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validation
    if (!email.trim() || !password) {
      setError('Please provide both email and password.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

      // 1. Submit login request with credentials: 'include' for HttpOnly cookie
      const loginRes = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const loginData = (await loginRes.json()) as ApiResponse<AuthResponseData> & {
        error?: { message: string };
      };

      if (!loginRes.ok || !loginData.success) {
        throw new Error(loginData.error?.message || 'Invalid email or password.');
      }

      // 2. Direct frontend-backend verification: test authenticated access to /api/v1/auth/me
      const meRes = await fetch(`${apiBase}/auth/me`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${loginData.data.accessToken}`,
        },
      });

      const meData = (await meRes.json()) as ApiResponse<SafeUser> & {
        error?: { message: string };
      };

      if (!meRes.ok || !meData.success) {
        throw new Error('Authentication succeeded but failed to verify profile via /auth/me.');
      }

      // Set verified user state from the /auth/me profile
      setVerifiedUser(meData.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred during login.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
      await fetch(`${apiBase}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Ignore network errors on logout
    } finally {
      setVerifiedUser(null);
      setPassword('');
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden bg-gray-950 text-gray-100">
      {/* Background glow */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-bhuvi-700/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] bg-bhuvi-900/30 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bhuvi-gradient shadow-xl mb-2"
          >
            <span className="text-2xl font-black text-white">B</span>
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">{APP_NAME} Login</h1>
          <p className="text-xs text-bhuvi-300 font-medium tracking-wide uppercase">
            {APP_FULL_NAME}
          </p>
        </div>

        {/* Card */}
        <div className="glass-panel p-8 space-y-6 shadow-2xl">
          {verifiedUser ? (
            <div className="space-y-4 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mb-2">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white">Session Verified</h2>
              <p className="text-sm text-gray-300">
                Welcome back,{' '}
                <span className="font-semibold text-bhuvi-300">{verifiedUser.name}</span>!
              </p>
              <div className="p-3 bg-white/5 rounded-lg text-left text-xs font-mono text-gray-400 space-y-1">
                <div>
                  <span className="text-gray-500">Email:</span> {verifiedUser.email}
                </div>
                <div>
                  <span className="text-gray-500">User ID:</span> {verifiedUser.id}
                </div>
                <div>
                  <span className="text-gray-500">Storage:</span> Secure HttpOnly Cookie
                </div>
                <div>
                  <span className="text-gray-500">Profile Status:</span> Verified via
                  /api/v1/auth/me
                </div>
              </div>
              <p className="text-xs text-gray-400">
                Full dashboard and task center will be available in Module 04.
              </p>
              <div className="pt-2 flex flex-col gap-2">
                <button
                  onClick={handleLogout}
                  className="w-full py-2.5 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-semibold transition"
                >
                  Sign Out
                </button>
                <Link href="/" className="text-xs text-bhuvi-400 hover:text-bhuvi-300 transition">
                  Return to Home
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div
                  role="alert"
                  className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs leading-relaxed"
                >
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5" htmlFor="email">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-bhuvi-500 focus:border-transparent transition"
                />
              </div>

              <div>
                <label
                  className="block text-xs font-medium text-gray-300 mb-1.5"
                  htmlFor="password"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-bhuvi-500 focus:border-transparent transition"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bhuvi-gradient hover:opacity-95 text-white font-semibold text-sm shadow-lg shadow-bhuvi-600/30 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>

              <div className="pt-2 text-center">
                <p className="text-xs text-gray-400">
                  Don&apos;t have an account?{' '}
                  <Link
                    href="/register"
                    className="text-bhuvi-400 hover:text-bhuvi-300 font-medium transition"
                  >
                    Register here
                  </Link>
                </p>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-500 font-mono">
          BHUVI v1.0.0 · Local-First Security
        </p>
      </div>
    </main>
  );
}
