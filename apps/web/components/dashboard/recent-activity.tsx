import React from 'react';
import { ActivityHistoryIcon } from '../ui/icons';

export function RecentActivity() {
  return (
    <div className="glass-panel p-6 rounded-3xl bg-gray-900/60 border border-white/5 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <ActivityHistoryIcon className="w-4 h-4 text-bhuvi-400" />
          <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
        </div>
        <span className="text-[10px] font-mono text-gray-500">Live Log</span>
      </div>

      {/* Proper Empty State */}
      <div className="py-8 px-4 text-center space-y-2 rounded-2xl bg-white/[0.01] border border-dashed border-white/10">
        <div className="w-10 h-10 rounded-full bg-white/5 mx-auto flex items-center justify-center text-gray-500">
          <ActivityHistoryIcon className="w-5 h-5 text-gray-400" />
        </div>
        <p className="text-xs sm:text-sm font-medium text-gray-300">
          No activity yet. Your activity will appear here when BHUVI starts working.
        </p>
        <p className="text-[11px] text-gray-400 max-w-sm mx-auto">
          Autonomous background tasks, monitoring notifications, and scheduled workflows will stream
          into this log.
        </p>
      </div>
    </div>
  );
}
