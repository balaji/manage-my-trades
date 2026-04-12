import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TechnicalAnalysisPage from './page';
import { marketDataApi } from '@/lib/api/market-data';
import { technicalAnalysisApi } from '@/lib/api/technical-analysis';

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

async function advanceAutocompleteDebounce() {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 250));
  });
}

vi.mock('@/components/charts/PriceChart', () => ({
  PriceChart: (props: any) => priceChartMock(props),
}));

vi.mock('@/lib/api/market-data', () => ({
  marketDataApi: {
    getBars: vi.fn(),
    searchSymbols: vi.fn(),
  },
}));

vi.mock('@/lib/api/technical-analysis', () => ({
  technicalAnalysisApi: {
    getSupportedIndicators: vi.fn(),
    calculateIndicators: vi.fn(),
  },
}));

describe('TechnicalAnalysisPage', () => {
  const rsiSelectionId = 'RSI:{"timeperiod":14}';

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
    vi.mocked(marketDataApi.searchSymbols).mockResolvedValue({ symbols: [] });

    vi.mocked(technicalAnalysisApi.calculateIndicators).mockResolvedValue({
      symbol: 'SPY',
      timeframe: '1d',
      indicators: [],
    });
  });

  it('loads bars without preloading indicator values and omits the home header', async () => {
    const user = userEvent.setup();

    render(<TechnicalAnalysisPage />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Load Chart' })).toBeEnabled());

    expect(screen.queryByRole('link', { name: /home/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /technical analysis/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Load Chart' }));

    expect(technicalAnalysisApi.calculateIndicators).not.toHaveBeenCalled();

    expect(await screen.findByTestId('price-chart')).toBeInTheDocument();
  });

  it('passes the resolved symbol display name to the chart for direct loads', async () => {
    const user = userEvent.setup();

    vi.mocked(marketDataApi.searchSymbols).mockResolvedValueOnce({
      symbols: [{ symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust' }],
    });

    render(<TechnicalAnalysisPage />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Load Chart' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Load Chart' }));

    await screen.findByTestId('price-chart');

    await waitFor(() =>
      expect(priceChartMock.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({
          symbolDisplayName: 'SPDR S&P 500 ETF Trust',
        })
      )
    );
  });

  it('keeps the controls header above the chart layer for overlays like autocomplete', async () => {
    render(<TechnicalAnalysisPage />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Load Chart' })).toBeEnabled());

    const controlsHeader = screen.getByRole('button', { name: 'Load Chart' }).closest('.border-b');
    const chartRegion = screen.getByText('Enter a symbol and load a chart').closest('.overflow-y-auto');

    expect(controlsHeader).toHaveClass('relative', 'z-10');
    expect(chartRegion).toHaveClass('relative', 'z-0');
  });

  it('loads the chart immediately when an autocomplete suggestion is selected', async () => {
    const user = userEvent.setup();

    vi.mocked(marketDataApi.searchSymbols).mockResolvedValueOnce({
      symbols: [{ symbol: 'QQQ', name: 'Invesco QQQ Trust' }],
    });
    vi.mocked(marketDataApi.getBars).mockResolvedValueOnce([
      {
        symbol: 'QQQ',
        timeframe: '1d',
        bars: [
          {
            timestamp: getRecentTimestamp(),
            open: 100,
            high: 101,
            low: 99,
            close: 100.5,
            volume: 1000000,
          },
        ],
      },
    ]);

    render(<TechnicalAnalysisPage />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Load Chart' })).toBeEnabled());

    const symbolInput = screen.getByLabelText(/symbol/i);
    await user.clear(symbolInput);
    await user.type(symbolInput, 'QQQ');
    await advanceAutocompleteDebounce();

    await user.click(await screen.findByRole('option', { name: /QQQ.*Invesco QQQ Trust/i }));

    await screen.findByTestId('price-chart');

    await waitFor(() =>
      expect(marketDataApi.getBars).toHaveBeenCalledWith(
        expect.objectContaining({
          symbols: ['QQQ'],
        })
      )
    );
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

    render(<TechnicalAnalysisPage />);

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

    render(<TechnicalAnalysisPage />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Load Chart' })).toBeEnabled());

    const symbolInput = screen.getByLabelText(/symbol/i);
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
    expect(screen.getByRole('button', { name: '6 months' })).toHaveClass('bg-blue-500');
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

    render(<TechnicalAnalysisPage />);

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

    render(<TechnicalAnalysisPage />);

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

    render(<TechnicalAnalysisPage />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Load Chart' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Load Chart' }));
    await screen.findByTestId('price-chart');

    await user.click(screen.getByRole('button', { name: 'Oscillators' }));

    expect(screen.getByRole('checkbox', { name: /Relative Strength Index 14/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Moving Average Convergence/i })).toBeInTheDocument();

    await user.type(screen.getByLabelText(/filter indicators/i), 'relative');

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

    vi.mocked(technicalAnalysisApi.calculateIndicators).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStaleIndicatorRequest = resolve;
        })
    );

    render(<TechnicalAnalysisPage />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Load Chart' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Load Chart' }));
    await screen.findByTestId('price-chart');

    await user.click(screen.getByRole('button', { name: 'Oscillators' }));
    await user.click(screen.getByRole('checkbox', { name: /Relative Strength Index 14/i }));

    await waitFor(() => expect(technicalAnalysisApi.calculateIndicators).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /Relative Strength Index 14/i })).toBeChecked());

    await user.click(screen.getByRole('button', { name: '6 months' }));

    // Range change reuses cached results and does not trigger another calculateIndicators call
    await waitFor(() => expect(marketDataApi.getBars).toHaveBeenCalledTimes(2));
    expect(technicalAnalysisApi.calculateIndicators).toHaveBeenCalledTimes(1);

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

    // Stale response is ignored - oscillator should not appear
    await waitFor(() => expect(screen.queryByTestId(`oscillator-${rsiSelectionId}`)).not.toBeInTheDocument());
  });
});
