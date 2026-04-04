import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from './AppShell';
import { usePathname } from 'next/navigation';

const { useAuthMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: useAuthMock,
}));

describe('AppShell', () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({ user: null, authLoading: false, login: vi.fn(), logout: vi.fn() });
  });

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
    expect(screen.getByRole('button', { name: /Sign in with Google/i })).toBeInTheDocument();
    expect(screen.getByText('Page body')).toBeInTheDocument();
  });

  it('shows the signed-in user avatar and name on the same row', () => {
    vi.mocked(usePathname).mockReturnValue('/');

    useAuthMock.mockReturnValue({
      user: {
        id: '7b3d8f5f-6c65-4b54-bbd5-3c8dd66dd8c0',
        name: 'Ada Lovelace',
        picture: 'https://example.com/avatar.jpg',
      },
      authLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <AppShell>
        <div>Page body</div>
      </AppShell>
    );

    expect(screen.getByAltText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByAltText('Ada Lovelace').nextElementSibling).toHaveTextContent('Ada Lovelace');
  });
});
