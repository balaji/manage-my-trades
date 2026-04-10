import { render, screen } from '@testing-library/react';
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
});
