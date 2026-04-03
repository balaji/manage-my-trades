import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useOscillatorPanes } from './useOscillatorPanes';

vi.mock('lightweight-charts', () => ({
  LineSeries: Symbol('LineSeries'),
  LineStyle: { Solid: 0, Dashed: 2 },
}));

function makeChart() {
  const panes: Array<{ paneIndex: () => number; setHeight: ReturnType<typeof vi.fn> }> = [
    { paneIndex: () => 0, setHeight: vi.fn() },
  ];
  const seriesByPane = new Map<
    number,
    Set<{ setData: ReturnType<typeof vi.fn>; applyOptions: ReturnType<typeof vi.fn> }>
  >();
  const timeScale = {
    fitContent: vi.fn(),
    getVisibleRange: vi.fn(() => null),
    setVisibleRange: vi.fn(),
  };

  const chart = {
    addPane: vi.fn(() => {
      const idx = panes.length;
      const pane = { paneIndex: () => idx, setHeight: vi.fn() };
      panes.push(pane);
      return pane;
    }),
    addSeries: vi.fn((_, _opts = {}, paneIndex = 0) => {
      const series = { setData: vi.fn(), applyOptions: vi.fn() };
      const s = seriesByPane.get(paneIndex) ?? new Set();
      s.add(series);
      seriesByPane.set(paneIndex, s);
      return series;
    }),
    removePane: vi.fn((idx: number) => {
      panes.splice(idx, 1);
      seriesByPane.delete(idx);
    }),
    removeSeries: vi.fn(),
    panes: vi.fn(() => panes),
    timeScale: vi.fn(() => timeScale),
  };
  return chart;
}

describe('useOscillatorPanes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds one pane per unique selectionId', () => {
    const chart = makeChart();
    const chartRef = { current: chart as unknown as Parameters<typeof useOscillatorPanes>[0]['current'] };
    const oscillatorPaneRef = { current: new Map() };
    const shouldFitContentRef = { current: false };

    renderHook(() =>
      useOscillatorPanes(
        chartRef,
        oscillatorPaneRef,
        shouldFitContentRef,
        [
          { id: 'rsi:real', selectionId: 'rsi-14', name: 'RSI', color: '#f00', data: [] },
          { id: 'macd:macd', selectionId: 'macd', name: 'MACD', color: '#00f', data: [] },
        ],
        160,
        undefined
      )
    );

    expect(chart.addPane).toHaveBeenCalledTimes(2);
  });

  it('groups oscillators with the same selectionId into one pane', () => {
    const chart = makeChart();
    const chartRef = { current: chart as unknown as Parameters<typeof useOscillatorPanes>[0]['current'] };
    const oscillatorPaneRef = { current: new Map() };
    const shouldFitContentRef = { current: false };

    renderHook(() =>
      useOscillatorPanes(
        chartRef,
        oscillatorPaneRef,
        shouldFitContentRef,
        [
          { id: 'macd:macd', selectionId: 'macd', name: 'MACD (MACD)', color: '#00f', data: [] },
          { id: 'macd:signal', selectionId: 'macd', name: 'MACD (Signal)', color: '#f0f', data: [] },
        ],
        160,
        undefined
      )
    );

    expect(chart.addPane).toHaveBeenCalledTimes(1);
  });

  it('clips data outside the timeRange', () => {
    const chart = makeChart();
    const chartRef = { current: chart as unknown as Parameters<typeof useOscillatorPanes>[0]['current'] };
    const oscillatorPaneRef = { current: new Map() };
    const shouldFitContentRef = { current: false };

    renderHook(() =>
      useOscillatorPanes(
        chartRef,
        oscillatorPaneRef,
        shouldFitContentRef,
        [
          {
            id: 'rsi:real',
            selectionId: 'rsi-14',
            name: 'RSI',
            color: '#f00',
            data: [
              { timestamp: '2024-01-01T00:00:00Z', value: 44 },
              { timestamp: '2024-01-02T00:00:00Z', value: 46 },
              { timestamp: '2024-01-03T00:00:00Z', value: 48 },
            ],
          },
        ],
        160,
        { from: '2024-01-02T00:00:00Z', to: '2024-01-02T23:59:59Z' }
      )
    );

    const seriesInstance = chart.addSeries.mock.results[0]?.value;
    expect(seriesInstance.setData).toHaveBeenCalledWith([
      { time: new Date('2024-01-02T00:00:00Z').getTime() / 1000, value: 46 },
    ]);
  });

  it('removes stale panes when oscillators are removed', () => {
    const chart = makeChart();
    const chartRef = { current: chart as unknown as Parameters<typeof useOscillatorPanes>[0]['current'] };
    const oscillatorPaneRef = { current: new Map() };
    const shouldFitContentRef = { current: false };

    const { rerender } = renderHook(
      ({ oscillators }) =>
        useOscillatorPanes(chartRef, oscillatorPaneRef, shouldFitContentRef, oscillators, 160, undefined),
      {
        initialProps: {
          oscillators: [{ id: 'rsi:real', selectionId: 'rsi-14', name: 'RSI', color: '#f00', data: [] }],
        },
      }
    );

    rerender({ oscillators: [] });
    expect(chart.removeSeries).toHaveBeenCalled();
  });
});
