import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PriceChart } from './PriceChart';

const mocks = vi.hoisted(() => {
  return {
    createChartMock: vi.fn(),
    createSeriesMarkersMock: vi.fn(() => ({ setMarkers: vi.fn() })),
    addSeriesCalls: [] as Array<{ options: Record<string, unknown>; paneIndex: number }>,
  };
});

type MockPane = {
  paneIndex: () => number;
  setHeight: ReturnType<typeof vi.fn>;
  setStretchFactor: ReturnType<typeof vi.fn>;
};

type MockSeries = {
  setData: ReturnType<typeof vi.fn>;
  applyOptions: ReturnType<typeof vi.fn>;
};

type MockTimeScale = {
  fitContent: ReturnType<typeof vi.fn>;
  getVisibleRange: ReturnType<typeof vi.fn>;
  setVisibleRange: ReturnType<typeof vi.fn>;
  getVisibleLogicalRange: ReturnType<typeof vi.fn>;
  setVisibleLogicalRange: ReturnType<typeof vi.fn>;
};

type MockChart = {
  addPane: ReturnType<typeof vi.fn>;
  addSeries: ReturnType<typeof vi.fn>;
  removePane: ReturnType<typeof vi.fn>;
  removeSeries: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  applyOptions: ReturnType<typeof vi.fn>;
  panes: ReturnType<typeof vi.fn>;
  timeScale: ReturnType<typeof vi.fn>;
};

vi.mock('lightweight-charts', () => {
  const LineStyle = {
    Solid: 0,
    Dashed: 2,
  };

  return {
    createChart: mocks.createChartMock,
    createSeriesMarkers: mocks.createSeriesMarkersMock,
    CandlestickSeries: Symbol('CandlestickSeries'),
    LineSeries: Symbol('LineSeries'),
    LineStyle,
  };
});

describe('PriceChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.addSeriesCalls.length = 0;
    mocks.createChartMock.mockImplementation(() => {
      const panes: MockPane[] = [
        {
          paneIndex: () => 0,
          setHeight: vi.fn(),
          setStretchFactor: vi.fn(),
        },
      ];
      const seriesByPane = new Map<number, Set<MockSeries>>();
      const timeScale: MockTimeScale = {
        fitContent: vi.fn(),
        getVisibleRange: vi.fn(() => null),
        setVisibleRange: vi.fn(),
        getVisibleLogicalRange: vi.fn(() => null),
        setVisibleLogicalRange: vi.fn(),
      };

      const chart: MockChart = {
        addPane: vi.fn(() => {
          const paneIndex = panes.length;
          const pane: MockPane = {
            paneIndex: () => paneIndex,
            setHeight: vi.fn(),
            setStretchFactor: vi.fn(),
          };
          panes.push(pane);
          return pane;
        }),
        addSeries: vi.fn((_, options: Record<string, unknown> = {}, paneIndex = 0) => {
          mocks.addSeriesCalls.push({ options, paneIndex });
          const series = { setData: vi.fn(), applyOptions: vi.fn() } satisfies MockSeries;
          const paneSeries = seriesByPane.get(paneIndex) ?? new Set<MockSeries>();
          paneSeries.add(series);
          seriesByPane.set(paneIndex, paneSeries);
          return series;
        }),
        removePane: vi.fn((index: number) => {
          panes.splice(index, 1);
          seriesByPane.delete(index);
        }),
        removeSeries: vi.fn((series: MockSeries) => {
          for (const [paneIndex, paneSeries] of seriesByPane.entries()) {
            if (!paneSeries.has(series)) {
              continue;
            }

            paneSeries.delete(series);
            if (paneSeries.size === 0 && paneIndex > 0) {
              seriesByPane.delete(paneIndex);
              panes.splice(paneIndex, 1);
            }
            break;
          }
        }),
        remove: vi.fn(),
        applyOptions: vi.fn(),
        panes: vi.fn(() => panes),
        timeScale: vi.fn(() => timeScale),
      };

      return chart;
    });
  });

  it('creates a separate pane for each oscillator', async () => {
    const data = [
      {
        timestamp: '2024-01-01T00:00:00Z',
        open: 100,
        high: 102,
        low: 99,
        close: 101,
        volume: 1000,
      },
    ];

    render(
      <PriceChart
        data={data}
        oscillators={[
          {
            id: 'rsi:real',
            selectionId: 'rsi-14',
            name: 'RSI 14',
            color: '#f59e0b',
            data: [{ timestamp: '2024-01-01T00:00:00Z', value: 44 }],
            referenceLines: [
              { value: 30, color: '#f59e0b' },
              { value: 70, color: '#ef4444' },
            ],
          },
          {
            id: 'macd:macd',
            selectionId: 'macd-12-26-9',
            name: 'MACD (MACD)',
            color: '#2196F3',
            data: [{ timestamp: '2024-01-01T00:00:00Z', value: 1.2 }],
          },
          {
            id: 'macd:signal',
            selectionId: 'macd-12-26-9',
            name: 'MACD (Signal)',
            color: '#2196F3',
            data: [{ timestamp: '2024-01-01T00:00:00Z', value: 0.9 }],
          },
        ]}
      />
    );

    await waitFor(() => expect(mocks.createChartMock).toHaveBeenCalledTimes(1));
    expect(mocks.createChartMock.mock.calls[0]?.[1]).toMatchObject({
      height: 720,
    });

    const chart = mocks.createChartMock.mock.results[0]?.value as MockChart;

    await waitFor(() => expect(chart.addPane).toHaveBeenCalledTimes(2));

    const oscillatorSeriesCalls = mocks.addSeriesCalls.filter(
      ({ options, paneIndex }) => paneIndex > 0 && options.title
    );
    expect(oscillatorSeriesCalls).toHaveLength(3);
    expect(oscillatorSeriesCalls.map((call) => call.paneIndex)).toEqual([1, 2, 2]);
  });

  it('restores the visible time range after adding oscillators', async () => {
    const data = [
      {
        timestamp: '2024-01-01T00:00:00Z',
        open: 100,
        high: 102,
        low: 99,
        close: 101,
        volume: 1000,
      },
      {
        timestamp: '2024-01-02T00:00:00Z',
        open: 101,
        high: 103,
        low: 100,
        close: 102,
        volume: 1200,
      },
    ];
    const visibleRange = { from: '2024-01-01T00:00:00Z', to: '2024-01-02T00:00:00Z' };

    const { rerender } = render(<PriceChart data={data} />);

    await waitFor(() => expect(mocks.createChartMock).toHaveBeenCalledTimes(1));
    const chart = mocks.createChartMock.mock.results[0]?.value as MockChart;
    const timeScale = chart.timeScale.mock.results[0]?.value as MockTimeScale;

    timeScale.getVisibleRange.mockReturnValue(visibleRange);

    rerender(
      <PriceChart
        data={data}
        oscillators={[
          {
            id: 'rsi:real',
            selectionId: 'rsi-14',
            name: 'RSI 14',
            color: '#f59e0b',
            data: [
              { timestamp: '2024-01-01T00:00:00Z', value: 44 },
              { timestamp: '2024-01-02T00:00:00Z', value: 46 },
            ],
            referenceLines: [
              { value: 30, color: '#f59e0b' },
              { value: 70, color: '#ef4444' },
            ],
          },
        ]}
      />
    );

    await waitFor(() => expect(chart.addPane).toHaveBeenCalledTimes(1));
    expect(timeScale.setVisibleRange).toHaveBeenCalledWith(visibleRange);
  });

  it('fits the chart to newly loaded price data', async () => {
    const data = [
      {
        timestamp: '2024-01-01T00:00:00Z',
        open: 100,
        high: 102,
        low: 99,
        close: 101,
        volume: 1000,
      },
    ];

    const { rerender } = render(<PriceChart data={data} />);

    await waitFor(() => expect(mocks.createChartMock).toHaveBeenCalledTimes(1));
    const chart = mocks.createChartMock.mock.results[0]?.value as MockChart;
    const timeScale = chart.timeScale.mock.results[0]?.value as MockTimeScale;
    const candlestickSeries = chart.addSeries.mock.results[0]?.value as MockSeries;

    timeScale.fitContent.mockClear();
    candlestickSeries.setData.mockClear();

    rerender(
      <PriceChart
        data={[
          ...data,
          {
            timestamp: '2024-01-02T00:00:00Z',
            open: 101,
            high: 103,
            low: 100,
            close: 102,
            volume: 1200,
          },
          {
            timestamp: '2024-01-03T00:00:00Z',
            open: 102,
            high: 104,
            low: 101,
            close: 103,
            volume: 1300,
          },
        ]}
      />
    );

    await waitFor(() =>
      expect(candlestickSeries.setData).toHaveBeenLastCalledWith([
        {
          time: (new Date('2024-01-01T00:00:00Z').getTime() / 1000) as number,
          open: 100,
          high: 102,
          low: 99,
          close: 101,
        },
        {
          time: (new Date('2024-01-02T00:00:00Z').getTime() / 1000) as number,
          open: 101,
          high: 103,
          low: 100,
          close: 102,
        },
        {
          time: (new Date('2024-01-03T00:00:00Z').getTime() / 1000) as number,
          open: 102,
          high: 104,
          low: 101,
          close: 103,
        },
      ])
    );
    expect(timeScale.fitContent).toHaveBeenCalled();
  });

  it('clips oscillator data to the supplied time range', async () => {
    const data = [
      {
        timestamp: '2024-01-01T00:00:00Z',
        open: 100,
        high: 102,
        low: 99,
        close: 101,
        volume: 1000,
      },
      {
        timestamp: '2024-01-02T00:00:00Z',
        open: 101,
        high: 103,
        low: 100,
        close: 102,
        volume: 1200,
      },
    ];

    const { rerender } = render(
      <PriceChart
        data={data}
        oscillators={[
          {
            id: 'rsi:real',
            selectionId: 'rsi-14',
            name: 'RSI 14',
            color: '#f59e0b',
            data: [
              { timestamp: '2024-01-01T00:00:00Z', value: 44 },
              { timestamp: '2024-01-02T00:00:00Z', value: 46 },
              { timestamp: '2024-01-03T00:00:00Z', value: 48 },
            ],
          },
        ]}
        timeRange={{
          from: '2024-01-02T00:00:00Z',
          to: '2024-01-02T23:59:59Z',
        }}
      />
    );

    await waitFor(() => expect(mocks.createChartMock).toHaveBeenCalledTimes(1));
    const chart = mocks.createChartMock.mock.results[0]?.value as MockChart;

    await waitFor(() => expect(chart.addSeries).toHaveBeenCalledTimes(3));

    const oscillatorSeries = chart.addSeries.mock.results[2]?.value as MockSeries;
    expect(oscillatorSeries.setData).toHaveBeenCalledWith([
      {
        time: (new Date('2024-01-02T00:00:00Z').getTime() / 1000) as number,
        value: 46,
      },
    ]);

    rerender(
      <PriceChart
        data={data}
        oscillators={[
          {
            id: 'rsi:real',
            selectionId: 'rsi-14',
            name: 'RSI 14',
            color: '#f59e0b',
            data: [
              { timestamp: '2024-01-01T00:00:00Z', value: 44 },
              { timestamp: '2024-01-02T00:00:00Z', value: 46 },
              { timestamp: '2024-01-03T00:00:00Z', value: 48 },
            ],
          },
        ]}
        timeRange={{
          from: '2024-01-01T00:00:00Z',
          to: '2024-01-03T23:59:59Z',
        }}
      />
    );

    await waitFor(() =>
      expect(oscillatorSeries.setData).toHaveBeenLastCalledWith([
        { time: (new Date('2024-01-01T00:00:00Z').getTime() / 1000) as number, value: 44 },
        { time: (new Date('2024-01-02T00:00:00Z').getTime() / 1000) as number, value: 46 },
        { time: (new Date('2024-01-03T00:00:00Z').getTime() / 1000) as number, value: 48 },
      ])
    );
  });

  it('removes oscillator panes without calling removePane on an already collapsed pane', async () => {
    const data = [
      {
        timestamp: '2024-01-01T00:00:00Z',
        open: 100,
        high: 102,
        low: 99,
        close: 101,
        volume: 1000,
      },
    ];

    const { rerender } = render(
      <PriceChart
        data={data}
        oscillators={[
          {
            id: 'rsi:real',
            selectionId: 'rsi-14',
            name: 'RSI 14',
            color: '#f59e0b',
            data: [{ timestamp: '2024-01-01T00:00:00Z', value: 44 }],
          },
        ]}
      />
    );

    await waitFor(() => expect(mocks.createChartMock).toHaveBeenCalledTimes(1));
    const chart = mocks.createChartMock.mock.results[0]?.value as MockChart;

    rerender(<PriceChart data={data} oscillators={[]} />);

    await waitFor(() => expect(chart.removeSeries).toHaveBeenCalled());
    expect(chart.removePane).not.toHaveBeenCalled();
  });
});
