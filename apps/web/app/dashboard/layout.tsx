'use client';

import React, { useState } from 'react';
import { AuthProvider, AuthGuard } from '../../lib/auth-context';
import { Sidebar } from '../../components/dashboard/sidebar';
import { MobileSidebar } from '../../components/dashboard/mobile-sidebar';
import { Topbar } from '../../components/dashboard/topbar';

function DashboardShell({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex overflow-hidden">
      {/* Desktop Sidebar */}
      <Sidebar isCollapsed={isCollapsed} onToggleCollapse={() => setIsCollapsed((prev) => !prev)} />

      {/* Mobile Drawer */}
      <MobileSidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Topbar onOpenMobileMenu={() => setIsMobileMenuOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          <div className="max-w-7xl mx-auto space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGuard>
        <DashboardShell>{children}</DashboardShell>
      </AuthGuard>
    </AuthProvider>
  );
}
