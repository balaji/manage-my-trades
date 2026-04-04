import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import NewBacktestPage from './page';

const { createBacktestMock, runBacktestMock, getStrategiesMock, pushMock } = vi.hoisted(() => ({
  createBacktestMock: vi.fn(),
  runBacktestMock: vi.fn(),
  getStrategiesMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams({ strategyId: '7b3d8f5f-6c65-4b54-bbd5-3c8dd66dd8c0' }),
}));

vi.mock('@/lib/api/backtests', () => ({
  createBacktest: createBacktestMock,
  runBacktest: runBacktestMock,
}));

vi.mock('@/lib/api/strategies', () => ({
  getStrategies: getStrategiesMock,
}));

describe('NewBacktestPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getStrategiesMock.mockResolvedValue({
      strategies: [
        {
          id: '7b3d8f5f-6c65-4b54-bbd5-3c8dd66dd8c0',
          name: 'Mean Reversion',
          description: null,
          strategy_type: 'technical',
          is_active: true,
          spec: { indicators: [] },
          config: {},
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ],
      total: 1,
    });
    createBacktestMock.mockResolvedValue({ id: 'bt-uuid', strategy_id: 'strategy-uuid' });
    runBacktestMock.mockResolvedValue({ id: 'bt-uuid', strategy_id: 'strategy-uuid' });
  });

  it('prefills the strategy UUID from the query string without parsing it', async () => {
    render(<NewBacktestPage />);

    await waitFor(() => expect(screen.getByDisplayValue('Mean Reversion Backtest')).toBeInTheDocument());
    expect(screen.getAllByRole('combobox')[0]).toHaveTextContent('7b3d8f5f-6c65-4b54-bbd5-3c8dd66dd8c0');
    expect(screen.getByDisplayValue('7b3d8f5f-6c65-4b54-bbd5-3c8dd66dd8c0')).toBeInTheDocument();
  });
});
