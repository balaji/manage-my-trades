import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    expect(screen.getByRole('combobox', { name: /strategy/i })).toHaveTextContent('Mean Reversion');
  });

  it('submits the selected strategy id instead of the strategy name', async () => {
    const user = userEvent.setup();

    getStrategiesMock.mockResolvedValue({
      strategies: [
        {
          id: 'strategy-1',
          name: 'Mean Reversion',
          description: null,
          strategy_type: 'technical',
          is_active: true,
          spec: { indicators: [] },
          config: {},
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 'strategy-2',
          name: 'Trend Following',
          description: null,
          strategy_type: 'technical',
          is_active: true,
          spec: { indicators: [] },
          config: {},
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ],
      total: 2,
    });

    render(<NewBacktestPage />);

    await waitFor(() => expect(screen.getByRole('button', { name: /run backtest/i })).toBeInTheDocument());

    await user.click(screen.getByRole('combobox', { name: /strategy/i }));
    await user.click(screen.getByRole('option', { name: 'Trend Following' }));
    await user.clear(screen.getByLabelText(/backtest name/i));
    await user.type(screen.getByLabelText(/backtest name/i), 'Trend Following Backtest');
    await user.type(screen.getByLabelText(/symbols/i), 'SPY');
    await user.click(screen.getByRole('button', { name: /run backtest/i }));

    await waitFor(() =>
      expect(createBacktestMock).toHaveBeenCalledWith(
        expect.objectContaining({
          strategy_id: 'strategy-2',
        })
      )
    );
  });

  it('exposes accessible names and input metadata for the form controls', async () => {
    render(<NewBacktestPage />);

    await waitFor(() => expect(screen.getByRole('combobox', { name: /strategy/i })).toBeInTheDocument());

    expect(screen.getByRole('combobox', { name: /strategy/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/backtest name/i)).toHaveAttribute('name', 'name');
    expect(screen.getByLabelText(/backtest name/i)).toHaveAttribute('autocomplete', 'off');
    expect(screen.getByLabelText(/symbols/i)).toHaveAttribute('name', 'symbols');
    expect(screen.getByLabelText(/symbols/i)).toHaveAttribute('spellcheck', 'false');
    expect(screen.getByLabelText(/initial capital/i)).toHaveAttribute('inputmode', 'decimal');
  });
});
