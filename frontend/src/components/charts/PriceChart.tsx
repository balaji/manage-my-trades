'use client';

import React, { useEffect, useRef } from 'react';
import { IChartApi, SeriesMarker, Time } from 'lightweight-charts';
import type { OHLCVBar } from '@/lib/types/market-data';

import type { IndicatorConfig, OscillatorConfig } from './chart-utils';
import { preserveVisibleRange } from './chart-utils';
import { useLightweightChart } from './useLightweightChart';
import { useIndicatorSeries } from './useIndicatorSeries';
import { useOscillatorPanes } from './useOscillatorPanes';
import { useRegimeOverlay } from './useRegimeOverlay';
import type { RegimeSegmentData } from './useRegimeOverlay';
import { useChartLegend } from './useChartLegend';
import { toChartUnixSeconds } from '@/lib/chart-time';

export type { IndicatorConfig, OscillatorConfig, RegimeSegmentData };

interface PriceChartProps {
  data: OHLCVBar[];
  symbolDisplayName?: string;
  indicators?: IndicatorConfig[];
  oscillators?: OscillatorConfig[];
  markers?: SeriesMarker<Time>[];
  regimeSegments?: RegimeSegmentData[];
  showRegimes?: boolean;
  oscillatorHeight?: number;
  height?: number;
  timeRange?: {
    from: string;
    to: string;
  };
  onChartReady?: (chart: IChartApi) => void;
}

export const PriceChart = React.memo(function PriceChart({
  data,
  symbolDisplayName,
  indicators = [],
  oscillators = [],
  markers = [],
  regimeSegments = [],
  showRegimes = false,
  oscillatorHeight = 160,
  height,
  timeRange,
  onChartReady,
}: PriceChartProps) {
  const oscillatorPaneCount = new Set(oscillators.map((o) => o.selectionId ?? o.id ?? o.name)).size;
  const totalHeight = (height ?? 400) + oscillatorPaneCount * oscillatorHeight;

  const containerRef = useRef<HTMLDivElement>(null);
  const { chartRef, candlestickSeriesRef, markerSeriesRef, closeSeriesRef, indicatorSeriesRef, oscillatorPaneRef } =
    useLightweightChart({ containerRef, totalHeight, onChartReady });

  useEffect(() => {
    if (!chartRef.current) return;
    preserveVisibleRange(chartRef.current, () => {
      chartRef.current?.applyOptions({ height: totalHeight });
    });
  }, [totalHeight]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!candlestickSeriesRef.current || !data.length) return;

    const candlestickMap = new Map<number, { time: number; open: number; high: number; low: number; close: number }>();
    data.forEach((bar) => {
      const time = toChartUnixSeconds(bar.timestamp);
      candlestickMap.set(time, { time, open: bar.open, high: bar.high, low: bar.low, close: bar.close });
    });
    const candlestickData = Array.from(candlestickMap.values()).sort((a, b) => a.time - b.time);

    candlestickSeriesRef.current.setData(candlestickData as never);

    const closeData = candlestickData.map((bar) => ({ time: bar.time, value: bar.close }));
    closeSeriesRef.current?.setData(closeData as never);

    chartRef.current?.timeScale().fitContent();
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    markerSeriesRef.current?.setMarkers(markers);
  }, [markers]); // eslint-disable-line react-hooks/exhaustive-deps

  useIndicatorSeries(chartRef, indicatorSeriesRef, indicators);
  useOscillatorPanes(chartRef, oscillatorPaneRef, oscillators, oscillatorHeight, timeRange);
  useRegimeOverlay(chartRef, candlestickSeriesRef, regimeSegments, showRegimes);
  const legendRef = useChartLegend(
    chartRef,
    candlestickSeriesRef,
    indicatorSeriesRef,
    oscillatorPaneRef,
    regimeSegments,
    showRegimes,
    symbolDisplayName
  );

  return (
    <div className="relative w-full">
      <div ref={containerRef} className="h-full w-full" style={{ height: `${totalHeight}px` }} />
      <div
        ref={legendRef}
        className="pointer-events-none absolute left-2 top-2 z-10 rounded bg-white/80 px-2 py-1 font-mono text-xs text-gray-900 dark:bg-slate-900/80 dark:text-slate-100"
      />
    </div>
  );
});
