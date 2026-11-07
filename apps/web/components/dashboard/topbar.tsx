'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MenuIcon, SearchIcon, BellIcon } from '../ui/icons';
import { SystemStatus } from './system-status';
import { UserProfileMenu } from './user-profile-menu';

export interface TopbarProps {
  onOpenMobileMenu: () => void;
}

export function Topbar({ onOpenMobileMenu }: TopbarProps) {
  const pathname = usePathname();

  const getPageInfo = () => {
    if (pathname.includes('/settings')) {
      return { title: 'Settings', context: 'Overview / Settings' };
    }
    return { title: 'Overview', context: 'Dashboard / Overview' };
  };

  const { title, context } = getPageInfo();

  return (
    <header className="sticky top-0 z-30 h-16 w-full border-b border-white/5 bg-gray-950/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-4">
      {/* Left: Mobile menu button & breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition"
          aria-label="Open mobile navigation menu"
        >
          <MenuIcon className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-gray-400">
            <Link href="/dashboard" className="hover:text-bhuvi-300 transition">
              BHUVI
            </Link>
            <span>/</span>
            <span className="text-gray-300">{context}</span>
          </div>
          <h1 className="text-base sm:text-lg font-bold text-white tracking-tight leading-none mt-0.5">
            {title}
          </h1>
        </div>
      </div>

      {/* Middle: Visual Search Bar (Visual only, no fake search) */}
      <div className="hidden md:flex flex-1 max-w-md mx-4">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
            <SearchIcon className="w-4 h-4" />
          </div>
          <input
            type="text"
            disabled
            placeholder="Search commands, tasks, messages... (Upcoming)"
            className="w-full pl-9 pr-14 py-1.5 text-xs rounded-xl bg-white/5 border border-white/10 text-gray-400 placeholder-gray-500 cursor-not-allowed focus:outline-none"
            title="Search functionality will be available in Module 14: Command Center"
          />
          <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-gray-400 bg-white/5 border border-white/10 rounded">
              ⌘K
            </kbd>
          </div>
        </div>
      </div>

      {/* Right: Actions, System Status, Notifications, Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        <SystemStatus />

        {/* Notification Icon (Upcoming Feature) */}
        <div className="relative">
          <button
            type="button"
            disabled
            className="p-2 rounded-xl text-gray-400 hover:text-gray-200 hover:bg-white/5 transition cursor-not-allowed opacity-75"
            title="Notifications will be activated in Module 07: Message Intelligence"
            aria-label="Notifications (Upcoming)"
          >
            <BellIcon className="w-5 h-5" />
          </button>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-bhuvi-400/50" />
        </div>

        <div className="h-5 w-px bg-white/10 mx-1" />

        <UserProfileMenu />
      </div>
    </header>
  );
}
