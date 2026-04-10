import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import BacktestsPage from './page';

const { listBacktestsMock, useAuthMock } = vi.hoisted(() => ({
  listBacktestsMock: vi.fn(),
  useAuthMock: vi.fn(),
}));

vi.mock('@/lib/api/backtests', () => ({
  listBacktests: listBacktestsMock,
  deleteBacktest: vi.fn(),
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: useAuthMock,
}));

describe('BacktestsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listBacktestsMock.mockResolvedValue({ backtests: [], total: 0 });
  });

  it('does not flash a sign-in error while auth state is still loading', () => {
    useAuthMock.mockReturnValue({
      user: null,
      authLoading: true,
    });

    render(<BacktestsPage />);

    expect(screen.queryByText('Please sign in to view backtests.')).not.toBeInTheDocument();
    expect(listBacktestsMock).not.toHaveBeenCalled();
  });
});
