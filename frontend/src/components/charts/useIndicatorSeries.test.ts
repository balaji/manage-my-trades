import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useIndicatorSeries } from './useIndicatorSeries';

const mocks = vi.hoisted(() => ({
  addSeriesCalls: [] as Array<{ options: Record<string, unknown>; paneIndex: number }>,
}));

vi.mock('lightweight-charts', () => ({
  LineSeries: Symbol('LineSeries'),
  LineStyle: { Solid: 0, Dashed: 2 },
}));

function makeChart() {
  const timeScale = {
    fitContent: vi.fn(),
    getVisibleRange: vi.fn(() => null),
    setVisibleRange: vi.fn(),
  };
  return {
    addSeries: vi.fn((_, options: Record<string, unknown> = {}, paneIndex = 0) => {
      mocks.addSeriesCalls.push({ options, paneIndex });
      return { setData: vi.fn(), applyOptions: vi.fn() };
    }),
    timeScale: vi.fn(() => timeScale),
  };
}

describe('useIndicatorSeries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.addSeriesCalls.length = 0;
  });

  it('adds a line series for each indicator on pane 0', () => {
    const chart = makeChart();
    const chartRef = { current: chart as unknown as Parameters<typeof useIndicatorSeries>[0]['current'] };
    const indicatorSeriesRef = { current: new Map() };
    renderHook(() =>
      useIndicatorSeries(chartRef, indicatorSeriesRef, [
        { name: 'SMA 20', data: [{ timestamp: '2024-01-01T00:00:00Z', value: 100 }], color: '#f00' },
        { name: 'EMA 50', data: [{ timestamp: '2024-01-01T00:00:00Z', value: 98 }], color: '#0f0' },
      ])
    );

    const indicatorCalls = mocks.addSeriesCalls.filter((c) => c.paneIndex === 0);
    expect(indicatorCalls).toHaveLength(2);
  });

  it('hides a series when the indicator is removed', () => {
    const chart = makeChart();
    const chartRef = { current: chart as unknown as Parameters<typeof useIndicatorSeries>[0]['current'] };
    const indicatorSeriesRef = { current: new Map() };

    const { rerender } = renderHook(({ indicators }) => useIndicatorSeries(chartRef, indicatorSeriesRef, indicators), {
      initialProps: {
        indicators: [{ name: 'SMA 20', data: [{ timestamp: '2024-01-01T00:00:00Z', value: 100 }], color: '#f00' }],
      },
    });

    const series = indicatorSeriesRef.current.get('SMA 20');
    rerender({ indicators: [] });

    expect(series?.applyOptions).toHaveBeenCalledWith(expect.objectContaining({ visible: false }));
  });

  it('reuses existing series on re-render rather than creating new ones', () => {
    const chart = makeChart();
    const chartRef = { current: chart as unknown as Parameters<typeof useIndicatorSeries>[0]['current'] };
    const indicatorSeriesRef = { current: new Map() };

    const indicator = { name: 'SMA 20', data: [{ timestamp: '2024-01-01T00:00:00Z', value: 100 }], color: '#f00' };

    const { rerender } = renderHook(({ indicators }) => useIndicatorSeries(chartRef, indicatorSeriesRef, indicators), {
      initialProps: { indicators: [indicator] },
    });

    rerender({ indicators: [{ ...indicator, color: '#00f' }] });

    expect(chart.addSeries).toHaveBeenCalledTimes(1);
  });
});
