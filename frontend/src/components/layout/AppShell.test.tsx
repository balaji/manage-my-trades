import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AppShell } from './AppShell';
import { usePathname } from 'next/navigation';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}));

describe('AppShell', () => {
  it('renders the six homepage sections in the sidebar and highlights the active route', () => {
    vi.mocked(usePathname).mockReturnValue('/technical-analysis');

    render(
      <AppShell>
        <div>Page body</div>
      </AppShell>
    );

    expect(screen.getByRole('link', { name: /Technical Analysis/i })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Backtesting/i })).toHaveAttribute('href', '/backtests');
    expect(screen.getByRole('link', { name: /Strategies/i })).toHaveAttribute('href', '/strategies');
    expect(screen.getByText('Dashboard').closest('[aria-disabled="true"]')).toBeInTheDocument();
    expect(screen.getByText('Paper Trading').closest('[aria-disabled="true"]')).toBeInTheDocument();
    expect(screen.getByText('ML Models').closest('[aria-disabled="true"]')).toBeInTheDocument();
    expect(screen.getByText('Page body')).toBeInTheDocument();
  });
});
