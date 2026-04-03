import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useLightweightChart } from './useLightweightChart';

const mocks = vi.hoisted(() => ({
  createChartMock: vi.fn(),
  createSeriesMarkersMock: vi.fn(() => ({ setMarkers: vi.fn() })),
}));

vi.mock('lightweight-charts', () => ({
  createChart: mocks.createChartMock,
  createSeriesMarkers: mocks.createSeriesMarkersMock,
  CandlestickSeries: Symbol('CandlestickSeries'),
  LineSeries: Symbol('LineSeries'),
  LineStyle: { Solid: 0, Dashed: 2 },
}));

function makeChart() {
  const timeScale = {
    fitContent: vi.fn(),
    getVisibleRange: vi.fn(() => null),
    setVisibleRange: vi.fn(),
  };
  const chart = {
    addSeries: vi.fn(() => ({ setData: vi.fn(), applyOptions: vi.fn() })),
    remove: vi.fn(),
    applyOptions: vi.fn(),
    panes: vi.fn(() => []),
    timeScale: vi.fn(() => timeScale),
  };
  return chart;
}

describe('useLightweightChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createChartMock.mockImplementation(makeChart);
  });

  it('creates the chart with the given totalHeight', () => {
    const div = document.createElement('div');
    renderHook(() => useLightweightChart({ containerRef: { current: div }, totalHeight: 560 }));

    expect(mocks.createChartMock).toHaveBeenCalledTimes(1);
    expect(mocks.createChartMock.mock.calls[0]?.[1]).toMatchObject({ height: 560 });
  });

  it('fires onChartReady with the chart instance', () => {
    const div = document.createElement('div');
    const onChartReady = vi.fn();
    renderHook(() => useLightweightChart({ containerRef: { current: div }, totalHeight: 400, onChartReady }));

    expect(onChartReady).toHaveBeenCalledWith(mocks.createChartMock.mock.results[0]?.value);
  });

  it('adds candlestick and close line series on mount', () => {
    const div = document.createElement('div');
    renderHook(() => useLightweightChart({ containerRef: { current: div }, totalHeight: 400 }));

    const chart = mocks.createChartMock.mock.results[0]?.value;
    expect(chart.addSeries).toHaveBeenCalledTimes(2);
  });

  it('calls chart.remove on unmount', () => {
    const div = document.createElement('div');
    const { unmount } = renderHook(() => useLightweightChart({ containerRef: { current: div }, totalHeight: 400 }));

    const chart = mocks.createChartMock.mock.results[0]?.value;
    unmount();
    expect(chart.remove).toHaveBeenCalledTimes(1);
  });
});
