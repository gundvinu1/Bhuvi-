'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../lib/auth-context';
import { UserIcon, SettingsIcon, LogoutIcon } from '../ui/icons';

export function UserProfileMenu() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 p-1 rounded-full hover:bg-white/5 transition focus:outline-none focus:ring-2 focus:ring-bhuvi-500"
        aria-expanded={isOpen}
        aria-label="User profile menu"
      >
        <div className="w-8 h-8 rounded-full bhuvi-gradient flex items-center justify-center text-white text-xs font-bold shadow-md">
          {getInitials(user?.name)}
        </div>
        <span className="hidden md:inline text-xs font-medium text-gray-200 truncate max-w-[120px]">
          {user?.name || 'User'}
        </span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 mt-2 w-56 rounded-2xl glass-panel bg-gray-900/95 border border-white/10 p-2 shadow-2xl z-50 text-xs space-y-1">
            <div className="px-3 py-2 border-b border-white/10 mb-1">
              <p className="font-semibold text-gray-100 truncate">{user?.name || 'BHUVI User'}</p>
              <p className="text-[11px] text-gray-400 truncate">{user?.email}</p>
            </div>

            <Link
              href="/dashboard/settings"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-gray-300 hover:text-white hover:bg-white/5 transition"
            >
              <SettingsIcon className="w-4 h-4 text-gray-400" />
              <span>Account Settings</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                void logout();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition text-left"
            >
              <LogoutIcon className="w-4 h-4 text-rose-400" />
              <span>Sign Out</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
