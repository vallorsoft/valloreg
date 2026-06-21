'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';
import { cn } from '@/lib/cn';
import { isAuthenticated } from '@/lib/auth';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace(`/${locale}/login`);
    }
  }, [router, locale]);

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
