'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  ChessQueen,
  ChartNoAxesCombined,
  ChevronLeft,
  Flower2,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  ScrollText,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAuth, type UserInfo } from '@/lib/auth-context';
import PageCard from '@/components/layout/PageCard';

type NavItem = {
  href?: string;
  label: string;
  description: string;
  icon: typeof LayoutDashboard;
};

export const navigationItems: NavItem[] = [
  {
    label: 'Dashboard',
    description: 'Portfolio overview',
    icon: LayoutDashboard,
  },
  {
    label: 'Paper Trading',
    description: 'Simulated execution',
    icon: ScrollText,
  },
  {
    href: '/backtests',
    label: 'Backtesting',
    description: 'Historical performance',
    icon: BarChart3,
  },
  {
    href: '/strategies',
    label: 'Strategies',
    description: 'Build and manage setups',
    icon: ChessQueen,
  },
  {
    href: '/technical-analysis',
    label: 'Technical Analysis',
    description: 'Charts and indicators',
    icon: ChartNoAxesCombined,
  },
  {
    label: 'ML Models',
    description: 'Model workflows',
    icon: Flower2,
  },
];

function isActivePath(pathname: string, href?: string) {
  if (!href) {
    return false;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarNav({
  pathname,
  onNavigate,
  isMinimized,
}: {
  pathname: string;
  onNavigate?: () => void;
  isMinimized?: boolean;
}) {
  return (
    <nav aria-label="Primary" className="space-y-2">
      {navigationItems.map((item) => {
        const active = isActivePath(pathname, item.href);
        const Icon = item.icon;
        const className = cn(
          'flex w-full items-center rounded-2xl py-3 text-left transition-colors',
          isMinimized ? 'justify-center px-3' : 'gap-3 px-4',
          active
            ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10'
            : 'text-slate-600 hover:bg-white hover:text-slate-900',
          !item.href && 'cursor-not-allowed text-slate-400 hover:bg-transparent hover:text-slate-400'
        );

        if (!item.href) {
          return (
            <div key={item.label} aria-disabled="true" className={className} title={item.label}>
              <Icon className="size-4 shrink-0" />
              {!isMinimized && (
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{item.label}</div>
                  <div className="text-xs opacity-80">{item.description}</div>
                </div>
              )}
            </div>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={className}
            title={item.label}
          >
            <Icon className="size-4 shrink-0" />
            {!isMinimized && (
              <div className="min-w-0 flex-1">
                <div className="font-medium">{item.label}</div>
                <div className={cn('text-xs', active ? 'text-slate-300' : 'text-slate-500')}>{item.description}</div>
              </div>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.split(' ');
  return parts
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function SidebarFooter({
  isMinimized,
  user,
  authLoading,
  onLogin,
  onLogout,
}: {
  isMinimized?: boolean;
  user: UserInfo | null;
  authLoading: boolean;
  onLogin: () => void;
  onLogout: () => void;
}) {
  if (authLoading) {
    return <div className={cn('mt-auto pt-6', isMinimized ? 'flex justify-center' : '')} />;
  }

  if (user) {
    return (
      <div className={cn('mt-auto pt-6', isMinimized ? 'flex flex-col items-center gap-2' : 'space-y-2')}>
        <div className={cn('flex items-center', isMinimized ? 'flex-col gap-2' : 'gap-3 px-4')}>
          {user.picture ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={user.picture}
              alt={user.name ?? 'User'}
              className="size-8 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex size-8 items-center justify-center rounded-full bg-slate-300 text-xs font-semibold text-slate-700">
              {getInitials(user.name)}
            </div>
          )}
          {!isMinimized && <p className="min-w-0 truncate text-sm font-medium text-slate-900">{user.name ?? 'User'}</p>}
        </div>
        <button
          onClick={onLogout}
          className={cn(
            'flex w-full items-center rounded-2xl text-slate-600 transition-colors hover:bg-white hover:text-slate-900',
            isMinimized ? 'justify-center px-3 py-3' : 'gap-3 px-4 py-3'
          )}
          title="Sign out"
        >
          <LogOut className="size-4 shrink-0" />
          {!isMinimized && <span className="text-sm font-medium">Sign out</span>}
        </button>
      </div>
    );
  }

  return (
    <div className={cn('mt-auto pt-6', isMinimized ? 'flex justify-center' : '')}>
      <button
        onClick={onLogin}
        className={cn(
          'flex w-full items-center rounded-2xl text-slate-600 transition-colors hover:bg-white hover:text-slate-900',
          isMinimized ? 'justify-center px-3 py-3' : 'gap-3 px-4 py-3'
        )}
        title="Sign in with Google"
      >
        <LogIn className="size-4 shrink-0" />
        {!isMinimized && <span className="text-sm font-medium">Sign in with Google</span>}
      </button>
    </div>
  );
}

function CurrentSectionLabel({ pathname }: { pathname: string }) {
  const currentItem = navigationItems.find((item) => isActivePath(pathname, item.href));

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Workspace</p>
      <p className="text-sm font-semibold text-slate-900">{currentItem?.label ?? 'Algorithmic ETF Trading'}</p>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [isMinimized, setIsMinimized] = useState(false);
  const { user, authLoading, login, logout } = useAuth();
  const pathname = usePathname() ?? '/';

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.14),_transparent_30%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] text-slate-900">
      <div className="flex min-h-screen">
        <aside
          className={cn(
            'hidden shrink-0 border-r border-slate-200/70 bg-slate-100/85 backdrop-blur md:flex md:flex-col transition-all duration-300',
            isMinimized ? 'w-20' : 'w-64',
            isMinimized ? 'px-2' : 'px-6',
            'py-8'
          )}
        >
          <div className="flex items-center justify-between">
            {!isMinimized && (
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">algotrading 101</p>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMinimized(!isMinimized)}
              className="ml-auto"
              title={isMinimized ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <ChevronLeft className={cn('size-4 transition-transform duration-300', isMinimized && 'rotate-180')} />
            </Button>
          </div>

          <div className={cn('flex-1', isMinimized ? 'mt-8' : 'mt-10')}>
            <SidebarNav pathname={pathname} isMinimized={isMinimized} />
          </div>
          <SidebarFooter
            isMinimized={isMinimized}
            user={user}
            authLoading={authLoading}
            onLogin={login}
            onLogout={logout}
          />
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur md:hidden">
            <div className="flex items-center justify-between gap-3">
              <CurrentSectionLabel pathname={pathname} />
              <Dialog>
                <DialogTrigger render={<Button variant="outline" size="icon" aria-label="Open navigation" />}>
                  <Menu className="size-4" />
                </DialogTrigger>
                <DialogContent className="left-auto top-0 h-full max-w-sm translate-x-0 translate-y-0 rounded-none border-l border-slate-200 p-0">
                  <div className="flex h-full flex-col bg-slate-50 p-6">
                    <DialogTitle className="text-xl font-semibold text-slate-950">Navigation</DialogTitle>
                    <p className="mt-2 text-sm text-slate-600">Move between analysis, strategies, and backtests.</p>
                    <div className="mt-6">
                      <SidebarNav pathname={pathname} />
                    </div>
                    <SidebarFooter user={user} authLoading={authLoading} onLogin={login} onLogout={logout} />
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </header>

          <main className="min-w-0 flex-1">
            <PageCard>{children}</PageCard>
          </main>
        </div>
      </div>
    </div>
  );
}
