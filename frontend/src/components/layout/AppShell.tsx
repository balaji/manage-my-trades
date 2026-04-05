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
  Menu,
  ScrollText,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAuth, type UserInfo } from '@/lib/auth-context';
import PageCard from '@/components/layout/PageCard';
import { AccountSettingsDialog } from '@/components/layout/AccountSettingsDialog';

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
            ? 'bg-foreground text-background shadow-lg shadow-foreground/10'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          !item.href &&
            'cursor-not-allowed text-muted-foreground/50 hover:bg-transparent hover:text-muted-foreground/50'
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
                <div className={cn('text-xs', active ? 'text-background/70' : 'text-muted-foreground/70')}>
                  {item.description}
                </div>
              </div>
            )}
          </Link>
        );
      })}
    </nav>
  );
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
      <div className={cn('mt-auto pt-6', isMinimized ? 'flex flex-col items-center gap-2' : '')}>
        <AccountSettingsDialog user={user} isMinimized={isMinimized} onLogout={onLogout} />
      </div>
    );
  }

  return (
    <div className={cn('mt-auto pt-6', isMinimized ? 'flex justify-center' : '')}>
      <button
        onClick={onLogin}
        className={cn(
          'flex w-full items-center rounded-2xl text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
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
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Workspace</p>
      <p className="text-sm font-semibold text-foreground">{currentItem?.label ?? 'Algorithmic ETF Trading'}</p>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [isMinimized, setIsMinimized] = useState(false);
  const { user, authLoading, login, logout } = useAuth();
  const pathname = usePathname() ?? '/';

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.14),_transparent_30%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] dark:bg-none dark:bg-slate-900 text-foreground">
      <div className="flex min-h-screen">
        <aside
          className={cn(
            'hidden shrink-0 border-r border-border/70 bg-muted/85 backdrop-blur md:flex md:flex-col transition-all duration-300',
            isMinimized ? 'w-20' : 'w-64',
            isMinimized ? 'px-2' : 'px-6',
            'py-8'
          )}
        >
          <div className="flex items-center justify-between">
            {!isMinimized && (
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">algotrading 101</p>
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
          <header className="border-b border-border/70 bg-background/80 px-4 py-3 backdrop-blur md:hidden">
            <div className="flex items-center justify-between gap-3">
              <CurrentSectionLabel pathname={pathname} />
              <Dialog>
                <DialogTrigger render={<Button variant="outline" size="icon" aria-label="Open navigation" />}>
                  <Menu className="size-4" />
                </DialogTrigger>
                <DialogContent className="left-auto top-0 h-full max-w-sm translate-x-0 translate-y-0 rounded-none border-l border-border p-0">
                  <div className="flex h-full flex-col bg-muted p-6">
                    <DialogTitle className="text-xl font-semibold text-foreground">Navigation</DialogTitle>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Move between analysis, strategies, and backtests.
                    </p>
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
