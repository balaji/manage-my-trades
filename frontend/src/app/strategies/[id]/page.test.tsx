import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import StrategyDetailPage from './page';

const { getStrategyMock, activateStrategyMock, deactivateStrategyMock, deleteStrategyMock, pushMock } = vi.hoisted(
  () => ({
    getStrategyMock: vi.fn(),
    activateStrategyMock: vi.fn(),
    deactivateStrategyMock: vi.fn(),
    deleteStrategyMock: vi.fn(),
    pushMock: vi.fn(),
  })
);

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '7b3d8f5f-6c65-4b54-bbd5-3c8dd66dd8c0' }),
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('@/lib/api/strategies', () => ({
  getStrategy: getStrategyMock,
  activateStrategy: activateStrategyMock,
  deactivateStrategy: deactivateStrategyMock,
  deleteStrategy: deleteStrategyMock,
}));

describe('StrategyDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getStrategyMock.mockResolvedValue({
      id: '7b3d8f5f-6c65-4b54-bbd5-3c8dd66dd8c0',
      name: 'Mean Reversion',
      description: null,
      strategy_type: 'technical',
      is_active: false,
      spec: { indicators: [] },
      config: {},
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });
  });

  it('loads the strategy using the UUID route param', async () => {
    render(<StrategyDetailPage />);

    await waitFor(() => {
      expect(getStrategyMock).toHaveBeenCalledWith('7b3d8f5f-6c65-4b54-bbd5-3c8dd66dd8c0');
    });
  });
});
