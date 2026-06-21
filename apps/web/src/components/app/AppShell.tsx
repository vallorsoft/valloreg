'use client';

import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';
import { cn } from '@/lib/cn';

/**
 * Authenticated app shell: fixed sidebar on desktop, a slide-over drawer on
 * mobile, and a sticky top bar.
 *
 * NOTE (Phase 1): this does not yet enforce authentication. A route guard /
 * server-side session check lands in a later phase; for now the shell renders
 * the demo UI regardless of token state.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-light">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-anthracite-100 bg-white lg:block">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      <div
        className={cn(
          'fixed inset-0 z-40 lg:hidden',
          mobileOpen ? 'block' : 'hidden',
        )}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="absolute inset-0 bg-anthracite-900/40"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
        <aside className="absolute inset-y-0 left-0 w-64 border-r border-anthracite-100 bg-white shadow-card-hover">
          <Sidebar onNavigate={() => setMobileOpen(false)} />
        </aside>
      </div>

      <div className="lg:pl-64">
        <TopNav onMenuClick={() => setMobileOpen(true)} />
        <main className="container-page py-8">{children}</main>
      </div>
    </div>
  );
}
