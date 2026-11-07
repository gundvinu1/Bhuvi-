'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { APP_NAME, APP_FULL_NAME } from '@bhuvi/shared';
import { CloseIcon, LogoutIcon } from '../ui/icons';
import { NAV_ITEMS } from './sidebar';
import { useAuth } from '../../lib/auth-context';

export interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileSidebar({ isOpen, onClose }: MobileSidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (!isOpen) return null;

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 w-72 bg-gray-950 border-r border-white/10 p-4 flex flex-col justify-between shadow-2xl z-50">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/5">
            <Link href="/dashboard" onClick={onClose} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bhuvi-gradient flex items-center justify-center text-white font-black text-lg shadow-lg">
                B
              </div>
              <div>
                <h2 className="font-extrabold text-sm text-white">{APP_NAME}</h2>
                <p className="text-[10px] text-bhuvi-300 font-mono">{APP_FULL_NAME}</p>
              </div>
            </Link>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition"
              aria-label="Close navigation menu"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="mt-4 space-y-1">
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
                    onClick={onClose}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition ${
                      isActive
                        ? 'bg-bhuvi-600/20 text-bhuvi-300 border border-bhuvi-500/30'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-bhuvi-400' : 'text-gray-400'}`}
                    />
                    <span>{item.name}</span>
                  </Link>
                );
              }

              return (
                <div
                  key={item.name}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium text-gray-500"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 flex-shrink-0 text-gray-600" />
                    <span>{item.name}</span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-gray-500">
                    {item.badge}
                  </span>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Profile & Logout */}
        <div className="pt-4 border-t border-white/5 space-y-3">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-white/[0.03]">
            <div className="w-8 h-8 rounded-full bhuvi-gradient flex items-center justify-center text-white text-xs font-bold">
              {getInitials(user?.name)}
            </div>
            <div className="flex-1 truncate">
              <p className="text-xs font-semibold text-gray-200 truncate">{user?.name || 'User'}</p>
              <p className="text-[10px] text-gray-400 truncate">{user?.email}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              onClose();
              void logout();
            }}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-rose-500/10 text-rose-400 text-xs font-semibold hover:bg-rose-500/20 transition"
          >
            <LogoutIcon className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
