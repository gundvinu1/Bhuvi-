'use client';

import React, { useState } from 'react';
import { useAuth } from '../../../lib/auth-context';
import { UserIcon, ShieldCheckIcon, LogoutIcon } from '../../../components/ui/icons';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark');
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
          Settings & Preferences
        </h2>
        <p className="text-xs sm:text-sm text-gray-400 mt-1">
          Manage your local BHUVI identity, account security, and interface preferences.
        </p>
      </div>

      {/* 1. User Profile Information */}
      <section className="glass-panel p-6 sm:p-7 rounded-3xl bg-gray-900/60 border border-white/5 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-white/5">
          <div className="p-2.5 rounded-2xl bg-bhuvi-500/10 text-bhuvi-400">
            <UserIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-white">Profile Information</h3>
            <p className="text-xs text-gray-400">Data retrieved from your local profile record</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
            <span className="text-gray-400 font-medium">Full Name</span>
            <p className="text-sm font-semibold text-gray-100">{user?.name || 'N/A'}</p>
          </div>

          <div className="space-y-1 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
            <span className="text-gray-400 font-medium">Email Address</span>
            <p className="text-sm font-semibold text-gray-100">{user?.email || 'N/A'}</p>
          </div>

          <div className="space-y-1 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
            <span className="text-gray-400 font-medium">Local User ID</span>
            <p className="font-mono text-[11px] text-gray-300 truncate">{user?.id || 'N/A'}</p>
          </div>

          <div className="space-y-1 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
            <span className="text-gray-400 font-medium">Member Since</span>
            <p className="text-sm font-semibold text-gray-100">{formatDate(user?.createdAt)}</p>
          </div>
        </div>
      </section>

      {/* 2. Account & Infrastructure Details */}
      <section className="glass-panel p-6 sm:p-7 rounded-3xl bg-gray-900/60 border border-white/5 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-white/5">
          <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400">
            <ShieldCheckIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-white">
              Security & Infrastructure
            </h3>
            <p className="text-xs text-gray-400">
              Local-first architecture and credential management
            </p>
          </div>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
            <div>
              <p className="font-medium text-gray-200">Authentication Method</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                HttpOnly, SameSite=Lax Cookie (`bhuvi_token`)
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-mono text-[10px]">
              Active & Secure
            </span>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
            <div>
              <p className="font-medium text-gray-200">Database Engine</p>
              <p className="text-[11px] text-gray-400 mt-0.5">PostgreSQL 16 + Prisma ORM</p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-bhuvi-500/10 text-bhuvi-300 font-mono text-[10px]">
              Module 03 Persistent
            </span>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
            <div>
              <p className="font-medium text-gray-200">Background Worker & Queue</p>
              <p className="text-[11px] text-gray-400 mt-0.5">BullMQ 5 on Redis 7</p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-bhuvi-500/10 text-bhuvi-300 font-mono text-[10px]">
              Ready
            </span>
          </div>
        </div>
      </section>

      {/* 3. Appearance Preference UI */}
      <section className="glass-panel p-6 sm:p-7 rounded-3xl bg-gray-900/60 border border-white/5 space-y-6">
        <div>
          <h3 className="text-sm sm:text-base font-semibold text-white">Appearance & Theme</h3>
          <p className="text-xs text-gray-400 mt-0.5">Customize your BHUVI desktop visual theme</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { id: 'dark', label: 'Dark Mode', desc: 'Standard high-contrast dark theme (Default)' },
            { id: 'light', label: 'Light Mode', desc: 'Clean bright theme (Coming soon)' },
            {
              id: 'system',
              label: 'System Default',
              desc: 'Matches your Windows preference (Coming soon)',
            },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTheme(item.id as typeof theme)}
              className={`p-4 rounded-2xl text-left border transition ${
                theme === item.id
                  ? 'bg-bhuvi-600/20 border-bhuvi-500/50 text-white'
                  : 'bg-white/[0.02] border-white/5 text-gray-400 hover:border-white/10'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-gray-200">{item.label}</span>
                {theme === item.id && <span className="w-2 h-2 rounded-full bg-bhuvi-400" />}
              </div>
              <p className="text-[11px] text-gray-400">{item.desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* 4. Session & Logout Action */}
      <section className="glass-panel p-6 sm:p-7 rounded-3xl bg-rose-950/10 border border-rose-500/20 space-y-4">
        <div>
          <h3 className="text-sm sm:text-base font-semibold text-rose-300">Session Management</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Sign out of your current session on this device. Your local profile and stored tasks
            will remain intact.
          </p>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="inline-flex items-center gap-2 py-2.5 px-5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-900/30 transition disabled:opacity-50"
        >
          <LogoutIcon className="w-4 h-4" />
          <span>{isLoggingOut ? 'Signing out...' : 'Sign Out of BHUVI'}</span>
        </button>
      </section>
    </div>
  );
}
