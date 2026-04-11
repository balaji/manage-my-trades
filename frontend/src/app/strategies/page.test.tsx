import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import StrategiesPage from './page';

const { getStrategiesMock, useAuthMock } = vi.hoisted(() => ({
  getStrategiesMock: vi.fn(),
  useAuthMock: vi.fn(),
}));

vi.mock('@/lib/api/strategies', () => ({
  getStrategies: getStrategiesMock,
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: useAuthMock,
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

describe('StrategiesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getStrategiesMock.mockResolvedValue({ strategies: [], total: 0 });
  });

  it('does not flash a sign-in error while auth state is still loading', () => {
    useAuthMock.mockReturnValue({
      user: null,
      authLoading: true,
    });

    render(<StrategiesPage />);

    expect(screen.queryByText('Please sign in to view strategies.')).not.toBeInTheDocument();
    expect(getStrategiesMock).not.toHaveBeenCalled();
  });

  it('keeps the current strategies visible while a filter refresh is pending', async () => {
    const user = userEvent.setup();
    const deferred = createDeferred<{ strategies: Array<Record<string, unknown>>; total: number }>();
    const initialResponse = {
      strategies: [
        {
          id: 'strategy-1',
          name: 'Mean Reversion',
          description: 'Fade short-term extremes',
          strategy_type: 'technical',
          is_active: true,
          spec: { indicators: [] },
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
      total: 1,
    };

    useAuthMock.mockReturnValue({
      user: { id: 'user-1' },
      authLoading: false,
    });

    getStrategiesMock.mockImplementation((params?: { is_active?: boolean }) => {
      if (params?.is_active === true) {
        return deferred.promise;
      }

      return Promise.resolve(initialResponse);
    });

    render(<StrategiesPage />);

    expect(await screen.findByText('Mean Reversion')).toBeInTheDocument();

    await user.click(screen.getAllByRole('combobox')[0]);
    await user.click(screen.getByRole('option', { name: 'Active Only' }));

    expect(screen.getByText('Mean Reversion')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Updating strategies…');

    deferred.resolve({
      strategies: [
        {
          id: 'strategy-2',
          name: 'Trend Following',
          description: 'Ride persistent momentum',
          strategy_type: 'technical',
          is_active: true,
          spec: { indicators: [] },
          created_at: '2026-02-01T00:00:00Z',
        },
      ],
      total: 1,
    });

    await waitFor(() => expect(screen.getByText('Trend Following')).toBeInTheDocument());
    expect(screen.queryByText('Mean Reversion')).not.toBeInTheDocument();
  });
});
