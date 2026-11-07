'use client';

import React, { useMemo } from 'react';
import { useAuth } from '../../lib/auth-context';
import { SparklesIcon } from '../ui/icons';

export function WelcomeSection() {
  const { user } = useAuth();

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const formattedDate = useMemo(() => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    return new Date().toLocaleDateString(undefined, options);
  }, []);

  const firstName = user?.name ? user.name.split(' ')[0] : 'there';

  return (
    <div className="relative overflow-hidden rounded-3xl glass-panel p-6 sm:p-8 bg-gradient-to-r from-bhuvi-950/40 via-gray-900/60 to-gray-900/40 border border-white/10 shadow-xl">
      {/* Subtle ambient lighting */}
      <div
        aria-hidden="true"
        className="absolute -right-16 -top-16 w-56 h-56 bg-bhuvi-600/15 rounded-full blur-3xl pointer-events-none"
      />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-bhuvi-500/10 border border-bhuvi-500/20 text-[11px] font-mono text-bhuvi-300">
            <SparklesIcon className="w-3.5 h-3.5 text-bhuvi-400" />
            <span>BHUVI Local AI OS · Ready</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {greeting}, <span className="text-bhuvi-300">{firstName}</span>
          </h2>

          <p className="text-xs sm:text-sm text-gray-400 leading-relaxed max-w-xl">
            Welcome to your personal AI command center. Systems are running locally with zero cloud
            dependency.
          </p>
        </div>

        <div className="flex flex-col sm:items-end justify-center self-start sm:self-auto bg-white/[0.03] sm:bg-transparent p-3 sm:p-0 rounded-2xl border border-white/5 sm:border-0">
          <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">Today</span>
          <span className="text-sm sm:text-base font-semibold text-gray-200 mt-0.5">
            {formattedDate}
          </span>
          <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            Local-First Mode Active
          </span>
        </div>
      </div>
    </div>
  );
}
