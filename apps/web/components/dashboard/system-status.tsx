'use client';

import React, { useState } from 'react';
import { useHealth } from '../../lib/use-health';

export function SystemStatus() {
  const { health, status, isLoading, refresh } = useHealth();
  const [isOpen, setIsOpen] = useState(false);

  const getStatusConfig = () => {
    switch (status) {
      case 'healthy':
        return {
          label: 'System Healthy',
          dotColor: 'bg-emerald-400',
          textColor: 'text-emerald-400',
          badgeBg: 'bg-emerald-500/10 border-emerald-500/30',
        };
      case 'degraded':
        return {
          label: 'System Degraded',
          dotColor: 'bg-amber-400',
          textColor: 'text-amber-400',
          badgeBg: 'bg-amber-500/10 border-amber-500/30',
        };
      case 'unavailable':
        return {
          label: 'API Unavailable',
          dotColor: 'bg-rose-400',
          textColor: 'text-rose-400',
          badgeBg: 'bg-rose-500/10 border-rose-500/30',
        };
      case 'checking':
      default:
        return {
          label: 'Checking System...',
          dotColor: 'bg-blue-400 animate-pulse',
          textColor: 'text-blue-400',
          badgeBg: 'bg-blue-500/10 border-blue-500/30',
        };
    }
  };

  const config = getStatusConfig();

  const formatUptime = (seconds?: number) => {
    if (seconds === undefined) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition ${config.badgeBg}`}
        aria-expanded={isOpen}
        title="Click to view infrastructure status"
      >
        <span className={`w-2 h-2 rounded-full ${config.dotColor}`} />
        <span className={`hidden sm:inline ${config.textColor}`}>{config.label}</span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 mt-2 w-72 rounded-2xl glass-panel bg-gray-900/95 border border-white/10 p-4 shadow-2xl z-50 text-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="font-semibold text-gray-200">System Infrastructure</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${config.badgeBg} ${config.textColor}`}
              >
                {status}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Core API Service:</span>
                <span className="text-gray-200 font-mono">
                  {health ? `v${health.version}` : 'Offline'}
                </span>
              </div>

              {health?.dependencies?.postgres && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">PostgreSQL 16:</span>
                  <span
                    className={`font-mono capitalize ${
                      health.dependencies.postgres === 'connected'
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {health.dependencies.postgres}
                  </span>
                </div>
              )}

              {health?.dependencies?.redis && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Redis 7:</span>
                  <span
                    className={`font-mono capitalize ${
                      health.dependencies.redis === 'connected'
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {health.dependencies.redis}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-gray-400">API Uptime:</span>
                <span className="text-gray-300 font-mono">{formatUptime(health?.uptime)}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-white/10 flex items-center justify-between">
              <span className="text-[10px] text-gray-500 font-mono">BHUVI v1.0.0</span>
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={isLoading}
                className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-300 text-[10px] transition disabled:opacity-50"
              >
                {isLoading ? 'Checking...' : 'Refresh'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
