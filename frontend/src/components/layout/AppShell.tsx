'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  BrainCircuit,
  CandlestickChart,
  ChevronRight,
  LayoutDashboard,
  Menu,
  ScrollText,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

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
    icon: BrainCircuit,
  },
  {
    href: '/technical-analysis',
    label: 'Technical Analysis',
    description: 'Charts and indicators',
    icon: CandlestickChart,
  },
  {
    label: 'ML Models',
    description: 'Model workflows',
    icon: ChevronRight,
  },
];

function isActivePath(pathname: string, href?: string) {
  if (!href) {
    return false;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Primary" className="space-y-2">
      {navigationItems.map((item) => {
        const active = isActivePath(pathname, item.href);
        const Icon = item.icon;
        const className = cn(
          'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors',
          active
            ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10'
            : 'text-slate-600 hover:bg-white hover:text-slate-900',
          !item.href && 'cursor-not-allowed text-slate-400 hover:bg-transparent hover:text-slate-400'
        );

        if (!item.href) {
          return (
            <div key={item.label} aria-disabled="true" className={className}>
              <Icon className="size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{item.label}</div>
                <div className="text-xs opacity-80">{item.description}</div>
              </div>
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
          >
            <Icon className="size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-medium">{item.label}</div>
              <div className={cn('text-xs', active ? 'text-slate-300' : 'text-slate-500')}>{item.description}</div>
            </div>
          </Link>
        );
      })}
    </nav>
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
  const pathname = usePathname() ?? '/';

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.14),_transparent_30%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-slate-200/70 bg-slate-100/85 px-6 py-8 backdrop-blur md:flex md:flex-col">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">algotrading 101</p>
          </div>

          <div className="mt-10 flex-1">
            <SidebarNav pathname={pathname} />
          </div>
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
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </header>

          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
