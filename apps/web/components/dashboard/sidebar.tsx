'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { APP_NAME, APP_FULL_NAME } from '@bhuvi/shared';
import {
  OverviewIcon,
  AssistantIcon,
  MessagesIcon,
  EmailsIcon,
  TasksIcon,
  CalendarIcon,
  SocialAccountsIcon,
  ActivityHistoryIcon,
  SettingsIcon,
  LogoutIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  OrchestratorIcon,
} from '../ui/icons';
import { useAuth } from '../../lib/auth-context';

export interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const NAV_ITEMS = [
  { name: 'Overview', href: '/dashboard', icon: OverviewIcon, functional: true },
  {
    name: 'AI Orchestrator',
    href: '/dashboard/orchestrator',
    icon: OrchestratorIcon,
    functional: true,
  },
  {
    name: 'AI Assistant',
    href: '#',
    icon: AssistantIcon,
    functional: false,
    badge: 'Soon',
    note: 'Module 05',
  },
  {
    name: 'Messages',
    href: '#',
    icon: MessagesIcon,
    functional: false,
    badge: 'Soon',
    note: 'Module 07',
  },
  {
    name: 'Emails',
    href: '#',
    icon: EmailsIcon,
    functional: false,
    badge: 'Soon',
    note: 'Module 09',
  },
  {
    name: 'Tasks',
    href: '#',
    icon: TasksIcon,
    functional: false,
    badge: 'Soon',
    note: 'Module 12',
  },
  {
    name: 'Calendar',
    href: '#',
    icon: CalendarIcon,
    functional: false,
    badge: 'Soon',
    note: 'Module 12',
  },
  {
    name: 'Social Accounts',
    href: '#',
    icon: SocialAccountsIcon,
    functional: false,
    badge: 'Soon',
    note: 'Module 11',
  },
  {
    name: 'Activity History',
    href: '#',
    icon: ActivityHistoryIcon,
    functional: false,
    badge: 'Soon',
    note: 'Module 06',
  },
  { name: 'Settings', href: '/dashboard/settings', icon: SettingsIcon, functional: true },
];

export function Sidebar({ isCollapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <aside
      className={`hidden lg:flex flex-col justify-between border-r border-white/5 bg-gray-950 transition-all duration-300 relative ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Top: Logo & Collapse Button */}
      <div>
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/5">
          <Link href="/dashboard" className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 min-w-[36px] rounded-xl bhuvi-gradient flex items-center justify-center text-white font-black text-lg shadow-lg">
              B
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <span className="font-extrabold text-sm tracking-tight text-white leading-tight">
                  {APP_NAME}
                </span>
                <span className="text-[10px] text-bhuvi-300 font-mono tracking-wider truncate max-w-[140px]">
                  {APP_FULL_NAME}
                </span>
              </div>
            )}
          </Link>

          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRightIcon className="w-4 h-4" />
            ) : (
              <ChevronLeftIcon className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation list */}
        <nav className="p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.functional &&
              (item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href));

            if (item.functional) {
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition ${
                    isActive
                      ? 'bg-bhuvi-600/20 text-bhuvi-300 border border-bhuvi-500/30'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                  }`}
                  title={isCollapsed ? item.name : undefined}
                >
                  <Icon
                    className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-bhuvi-400' : 'text-gray-400'}`}
                  />
                  {!isCollapsed && <span className="truncate">{item.name}</span>}
                </Link>
              );
            }

            // Upcoming / Placeholder item
            return (
              <div
                key={item.name}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium text-gray-500 hover:bg-white/[0.02] cursor-not-allowed group transition"
                title={`${item.name} (${item.note}) - Upcoming feature`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <Icon className="w-5 h-5 flex-shrink-0 text-gray-600 group-hover:text-gray-500 transition" />
                  {!isCollapsed && <span className="truncate text-gray-500">{item.name}</span>}
                </div>
                {!isCollapsed && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-gray-500">
                    {item.badge}
                  </span>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Bottom: User Profile Section & Logout */}
      <div className="p-3 border-t border-white/5 space-y-2">
        <div
          className={`flex items-center ${
            isCollapsed ? 'justify-center' : 'justify-between'
          } p-2 rounded-xl bg-white/[0.02]`}
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 min-w-[32px] rounded-full bhuvi-gradient flex items-center justify-center text-white text-xs font-bold shadow">
              {getInitials(user?.name)}
            </div>
            {!isCollapsed && (
              <div className="flex flex-col truncate">
                <span className="text-xs font-semibold text-gray-200 truncate">{user?.name}</span>
                <span className="text-[10px] text-gray-400 truncate">{user?.email}</span>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <button
              type="button"
              onClick={() => void logout()}
              className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogoutIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {isCollapsed && (
          <button
            type="button"
            onClick={() => void logout()}
            className="w-full flex items-center justify-center p-2 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition"
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogoutIcon className="w-5 h-5" />
          </button>
        )}
      </div>
    </aside>
  );
}
