import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TechnicalAnalysisPage from './page';
import { marketDataApi, technicalAnalysisApi } from '@/lib/api';

const priceChartMock = vi.fn(
  ({ oscillators = [] }: { oscillators?: Array<{ selectionId?: string; data: Array<{ value: number }> }> }) => (
    <div data-testid="price-chart">
      {oscillators.map((oscillator) => (
        <div key={oscillator.selectionId ?? 'oscillator'} data-testid={`oscillator-${oscillator.selectionId}`}>
          {oscillator.data.map((point) => point.value).join(',')}
        </div>
      ))}
    </div>
  )
);

function getRecentTimestamp() {
  const date = new Date();
  date.setDate(date.getDate() - 2);
  return `${date.toISOString().split('T')[0]}T00:00:00Z`;
}

vi.mock('@/components/charts/PriceChart', () => ({
  PriceChart: (props: any) => priceChartMock(props),
}));

vi.mock('@/lib/api', () => ({
  marketDataApi: {
    getBars: vi.fn(),
  },
  technicalAnalysisApi: {
    getSupportedIndicators: vi.fn(),
    calculateIndicators: vi.fn(),
  },
}));

describe('TechnicalAnalysisPage', () => {
  const rsiSelectionId = 'RSI:{"timeperiod":14}';

  function renderPage() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
          retry: false,
        },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <TechnicalAnalysisPage />
      </QueryClientProvider>
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    priceChartMock.mockClear();
    const recentTimestamp = getRecentTimestamp();

    vi.mocked(technicalAnalysisApi.getSupportedIndicators).mockResolvedValue({
      indicators: [
        {
          name: 'RSI',
          display_name: 'Relative Strength Index',
          description: 'Momentum oscillator',
          group: 'Momentum Indicators',
          inputs: ['close'],
          parameters: [{ name: 'timeperiod', default: 14 }],
          output_names: ['real'],
          chart: {
            pane: 'oscillator',
            default_enabled: true,
            reference_lines: [
              { value: 30, color: '#f59e0b' },
              { value: 70, color: '#ef4444' },
            ],
          },
        },
      ],
    });

    vi.mocked(marketDataApi.getBars).mockResolvedValue([
      {
        symbol: 'SPY',
        timeframe: '1d',
        bars: [
          {
            timestamp: recentTimestamp,
            open: 100,
            high: 101,
            low: 99,
            close: 100.5,
            volume: 1000000,
          },
        ],
      },
    ]);

    vi.mocked(technicalAnalysisApi.calculateIndicators).mockResolvedValue({
      symbol: 'SPY',
      timeframe: '1d',
      indicators: [],
    });
  });

  it('loads bars without preloading indicator values and omits the home header', async () => {
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Load Chart' })).toBeEnabled());

    expect(screen.queryByRole('link', { name: /home/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /technical analysis/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Load Chart' }));

    expect(technicalAnalysisApi.calculateIndicators).not.toHaveBeenCalled();

    expect(await screen.findByTestId('price-chart')).toBeInTheDocument();
  });

  it('preserves selected oscillators when switching ranges', async () => {
    const user = userEvent.setup();
    const recentTimestamp = getRecentTimestamp();

    vi.mocked(technicalAnalysisApi.calculateIndicators)
      .mockResolvedValueOnce({
        symbol: 'SPY',
        timeframe: '1d',
        indicators: [
          {
            name: 'RSI',
            params: { timeperiod: 14 },
            outputs: {
              real: [{ timestamp: recentTimestamp, value: 55 }],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        symbol: 'SPY',
        timeframe: '1d',
        indicators: [
          {
            name: 'RSI',
            params: { timeperiod: 14 },
            outputs: {
              real: [{ timestamp: recentTimestamp, value: 56 }],
            },
          },
        ],
      });

    renderPage();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Load Chart' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Load Chart' }));

    await screen.findByTestId('price-chart');

    await user.click(screen.getByRole('button', { name: 'Oscillators' }));
    await user.click(screen.getByRole('checkbox', { name: /Relative Strength Index 14/i }));

    await waitFor(() =>
      expect(technicalAnalysisApi.calculateIndicators).toHaveBeenCalledWith(
        expect.objectContaining({
          indicators: [{ name: 'RSI', params: { timeperiod: 14 } }],
        })
      )
    );

    await user.click(screen.getByRole('button', { name: '6 months' }));

    await waitFor(() =>
      expect(technicalAnalysisApi.calculateIndicators).toHaveBeenLastCalledWith(
        expect.objectContaining({
          indicators: [{ name: 'RSI', params: { timeperiod: 14 } }],
        })
      )
    );

    await user.click(screen.getByRole('button', { name: 'Oscillators' }));
    expect(screen.getByRole('checkbox', { name: /Relative Strength Index 14/i })).toBeChecked();
  });

  it('resets all page state when Clear is clicked', async () => {
    const user = userEvent.setup();
    const recentTimestamp = getRecentTimestamp();

    vi.mocked(technicalAnalysisApi.calculateIndicators).mockResolvedValue({
      symbol: 'SPY',
      timeframe: '1d',
      indicators: [
        {
          name: 'RSI',
          params: { timeperiod: 14 },
          outputs: {
            real: [{ timestamp: recentTimestamp, value: 55 }],
          },
        },
      ],
    });

    renderPage();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Load Chart' })).toBeEnabled());

    const symbolInput = screen.getByPlaceholderText(/enter symbol/i);
    await user.clear(symbolInput);
    await user.type(symbolInput, 'AAPL');

    await user.click(screen.getByRole('button', { name: '6 months' }));
    await screen.findByTestId('price-chart');

    await user.click(screen.getByRole('button', { name: 'Oscillators' }));
    await user.click(screen.getByRole('checkbox', { name: /Relative Strength Index 14/i }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /Relative Strength Index 14/i })).toBeChecked());

    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(symbolInput).toHaveValue('SPY');
    expect(screen.queryByTestId('price-chart')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '90 days' })).toHaveClass('bg-slate-900');
  });

  it('shows other-pane indicators in Others dropdown, not Oscillators', async () => {
    const user = userEvent.setup();

    vi.mocked(technicalAnalysisApi.getSupportedIndicators).mockResolvedValue({
      indicators: [
        {
          name: 'RSI',
          display_name: 'Relative Strength Index',
          description: 'Momentum oscillator',
          group: 'Momentum Indicators',
          inputs: ['close'],
          parameters: [{ name: 'timeperiod', default: 14 }],
          output_names: ['real'],
          chart: { pane: 'oscillator', default_enabled: false, reference_lines: [] },
        },
        {
          name: 'FLOOR',
          display_name: 'Vector Floor',
          description: 'Math Transform',
          group: 'Math Transform',
          inputs: ['close'],
          parameters: [],
          output_names: ['real'],
          chart: { pane: 'other', default_enabled: false, reference_lines: [] },
        },
      ],
    });

    renderPage();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Load Chart' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Load Chart' }));
    await screen.findByTestId('price-chart');

    await user.click(screen.getByRole('button', { name: 'Oscillators' }));
    expect(screen.queryByRole('checkbox', { name: /Vector Floor/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Oscillators' }));

    await user.click(screen.getByRole('button', { name: 'Others' }));
    expect(screen.getByRole('checkbox', { name: /Vector Floor/i })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Relative Strength Index/i })).not.toBeInTheDocument();
  });

  it('renders other-pane indicator series as sub-pane chart when toggled', async () => {
    const user = userEvent.setup();
    const recentTimestamp = getRecentTimestamp();

    vi.mocked(technicalAnalysisApi.getSupportedIndicators).mockResolvedValue({
      indicators: [
        {
          name: 'FLOOR',
          display_name: 'Vector Floor',
          description: 'Math Transform',
          group: 'Math Transform',
          inputs: ['close'],
          parameters: [],
          output_names: ['real'],
          chart: { pane: 'other', default_enabled: false, reference_lines: [] },
        },
      ],
    });

    vi.mocked(technicalAnalysisApi.calculateIndicators).mockResolvedValue({
      symbol: 'SPY',
      timeframe: '1d',
      indicators: [
        {
          name: 'FLOOR',
          params: {},
          outputs: {
            real: [{ timestamp: recentTimestamp, value: 99 }],
          },
        },
      ],
    });

    renderPage();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Load Chart' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Load Chart' }));
    await screen.findByTestId('price-chart');

    await user.click(screen.getByRole('button', { name: 'Others' }));
    await user.click(screen.getByRole('checkbox', { name: /Vector Floor/i }));

    const floorSelectionId = 'FLOOR:{}';
    await waitFor(() => expect(screen.getByTestId(`oscillator-${floorSelectionId}`)).toHaveTextContent('99'));
  });

  it('filters dropdown options by text and resets filter on close', async () => {
    const user = userEvent.setup();

    vi.mocked(technicalAnalysisApi.getSupportedIndicators).mockResolvedValue({
      indicators: [
        {
          name: 'RSI',
          display_name: 'Relative Strength Index',
          description: 'Momentum oscillator',
          group: 'Momentum Indicators',
          inputs: ['close'],
          parameters: [{ name: 'timeperiod', default: 14 }],
          output_names: ['real'],
          chart: { pane: 'oscillator', default_enabled: true, reference_lines: [] },
        },
        {
          name: 'MACD',
          display_name: 'Moving Average Convergence/Divergence',
          description: 'Trend-following momentum indicator',
          group: 'Momentum Indicators',
          inputs: ['close'],
          parameters: [
            { name: 'fastperiod', default: 12 },
            { name: 'slowperiod', default: 26 },
            { name: 'signalperiod', default: 9 },
          ],
          output_names: ['macd', 'macdsignal', 'macdhist'],
          chart: { pane: 'oscillator', default_enabled: true, reference_lines: [] },
        },
      ],
    });

    renderPage();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Load Chart' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Load Chart' }));
    await screen.findByTestId('price-chart');

    await user.click(screen.getByRole('button', { name: 'Oscillators' }));

    expect(screen.getByRole('checkbox', { name: /Relative Strength Index 14/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Moving Average Convergence/i })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Filter...'), 'relative');

    expect(screen.getByRole('checkbox', { name: /Relative Strength Index 14/i })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Moving Average Convergence/i })).not.toBeInTheDocument();

    // Close and reopen — filter should reset
    await user.click(screen.getByRole('button', { name: 'Oscillators' }));
    await user.click(screen.getByRole('button', { name: 'Oscillators' }));

    expect(screen.getByRole('checkbox', { name: /Relative Strength Index 14/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Moving Average Convergence/i })).toBeInTheDocument();
  });

  it('ignores stale indicator toggle responses after loading a new range', async () => {
    const user = userEvent.setup();
    const recentTimestamp = getRecentTimestamp();
    let resolveStaleIndicatorRequest:
      | ((value: { symbol: string; timeframe: string; indicators: Array<any> }) => void)
      | null = null;

    vi.mocked(technicalAnalysisApi.calculateIndicators)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveStaleIndicatorRequest = resolve;
          })
      )
      .mockResolvedValueOnce({
        symbol: 'SPY',
        timeframe: '1d',
        indicators: [
          {
            name: 'RSI',
            params: { timeperiod: 14 },
            outputs: {
              real: [{ timestamp: recentTimestamp, value: 56 }],
            },
          },
        ],
      });

    renderPage();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Load Chart' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Load Chart' }));
    await screen.findByTestId('price-chart');

    await user.click(screen.getByRole('button', { name: 'Oscillators' }));
    await user.click(screen.getByRole('checkbox', { name: /Relative Strength Index 14/i }));

    await waitFor(() => expect(technicalAnalysisApi.calculateIndicators).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /Relative Strength Index 14/i })).toBeChecked());

    await user.click(screen.getByRole('button', { name: '6 months' }));

    await waitFor(() => expect(technicalAnalysisApi.calculateIndicators).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId(`oscillator-${rsiSelectionId}`)).toHaveTextContent('56'));

    await act(async () => {
      resolveStaleIndicatorRequest?.({
        symbol: 'SPY',
        timeframe: '1d',
        indicators: [
          {
            name: 'RSI',
            params: { timeperiod: 14 },
            outputs: {
              real: [{ timestamp: recentTimestamp, value: 55 }],
            },
          },
        ],
      });
    });

    await waitFor(() => expect(screen.getByTestId(`oscillator-${rsiSelectionId}`)).toHaveTextContent('56'));
  });
});
