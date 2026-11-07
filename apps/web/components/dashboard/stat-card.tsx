import React from 'react';
import { MessagesIcon, BellIcon, TasksIcon, SocialAccountsIcon } from '../ui/icons';

export interface StatItem {
  id: string;
  title: string;
  placeholderValue: string;
  badgeText: string;
  note: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const STAT_CARDS_DATA: StatItem[] = [
  {
    id: 'total-messages',
    title: 'Total Messages',
    placeholderValue: 'Coming soon',
    badgeText: 'Module 07',
    note: 'Message Intelligence Engine',
    icon: MessagesIcon,
  },
  {
    id: 'unread-messages',
    title: 'Unread Messages',
    placeholderValue: 'Coming soon',
    badgeText: 'Module 07',
    note: 'Priority & Urgency Detection',
    icon: BellIcon,
  },
  {
    id: 'pending-tasks',
    title: 'Pending Tasks',
    placeholderValue: 'Coming soon',
    badgeText: 'Module 12',
    note: 'Task & Calendar Management',
    icon: TasksIcon,
  },
  {
    id: 'connected-accounts',
    title: 'Connected Accounts',
    placeholderValue: 'Coming soon',
    badgeText: 'Modules 09-11',
    note: 'Gmail, WhatsApp & Socials',
    icon: SocialAccountsIcon,
  },
];

export function StatCard({ item }: { item: StatItem }) {
  const Icon = item.icon;

  return (
    <div className="glass-panel p-5 rounded-2xl bg-gray-900/60 border border-white/5 hover:border-white/10 transition flex flex-col justify-between space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-400">{item.title}</span>
        <div className="p-2 rounded-xl bg-white/5 text-gray-400">
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl sm:text-2xl font-bold text-gray-300 font-mono tracking-tight">
            {item.placeholderValue}
          </span>
        </div>
        <p className="text-[11px] text-gray-400 mt-1 truncate">{item.note}</p>
      </div>

      <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px]">
        <span className="text-gray-400">Status</span>
        <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-bhuvi-500/10 text-bhuvi-300 border border-bhuvi-500/20">
          {item.badgeText}
        </span>
      </div>
    </div>
  );
}

export function StatCardsGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {STAT_CARDS_DATA.map((item) => (
        <StatCard key={item.id} item={item} />
      ))}
    </div>
  );
}
