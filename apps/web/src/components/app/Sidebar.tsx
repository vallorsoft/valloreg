'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import { Logo } from '@/components/Logo';
import { cn } from '@/lib/cn';
import { authApi } from '@/lib/api';

const NAV = [
  { href: '/dashboard', key: 'dashboard' },
  { href: '/vehicles', key: 'vehicles' },
  { href: '/documents', key: 'documents' },
  { href: '/reminders', key: 'reminders' },
  { href: '/reports', key: 'reports' },
  { href: '/insights', key: 'insights' },
  { href: '/rankings', key: 'rankings' },
  { href: '/team', key: 'team' },
  { href: '/billing', key: 'billing' },
  { href: '/account', key: 'account' },
] as const;

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations('app.nav');
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    authApi
      .me()
      .then((me) => setIsAdmin(me.user.isPlatformAdmin))
      .catch(() => setIsAdmin(false));
  }, []);

  const items = isAdmin
    ? [...NAV, { href: '/admin', key: 'admin' } as const]
    : NAV;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-6">
        <Link href="/" aria-label="Valloreg" onClick={onNavigate}>
          <Logo />
        </Link>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4" aria-label={t('dashboard')}>
        {items.map((item) => {
          // Active when the current path ends with this section (locale-stripped).
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary-50 text-primary-800'
                  : 'text-anthracite-600 hover:bg-anthracite-50 hover:text-anthracite-900',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'h-2 w-2 rounded-full',
                  active ? 'bg-primary-600' : 'bg-anthracite-300',
                )}
              />
              {t(item.key)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
