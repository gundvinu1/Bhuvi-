import React from 'react';
import { SparklesIcon } from '../ui/icons';

export function DailyIntelligence() {
  return (
    <div className="glass-panel p-6 rounded-3xl bg-gray-900/60 border border-white/5 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <SparklesIcon className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-white">Daily Intelligence Briefing</h3>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
          Module 13
        </span>
      </div>

      {/* Proper Empty / Placeholder State */}
      <div className="py-8 px-4 text-center space-y-2 rounded-2xl bg-white/[0.01] border border-dashed border-white/10">
        <div className="w-10 h-10 rounded-full bg-amber-500/10 mx-auto flex items-center justify-center text-amber-400">
          <SparklesIcon className="w-5 h-5" />
        </div>
        <p className="text-xs sm:text-sm font-medium text-gray-300">
          Your daily intelligence report will appear here.
        </p>
        <p className="text-[11px] text-gray-400 max-w-sm mx-auto">
          Every morning, BHUVI will synthesize high-priority messages, scheduled tasks, calendar
          events, and actionable suggestions into a single consolidated briefing.
        </p>
      </div>
    </div>
  );
}
