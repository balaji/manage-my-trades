'use client';

import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { IChartApi, SeriesMarker, Time } from 'lightweight-charts';
import type { OHLCVBar } from '@/lib/types/market-data';

import type { IndicatorConfig, OscillatorConfig } from './chart-utils';
import { preserveVisibleRange } from './chart-utils';
import { useLightweightChart } from './useLightweightChart';
import { useIndicatorSeries } from './useIndicatorSeries';
import { useOscillatorPanes } from './useOscillatorPanes';

export type { IndicatorConfig, OscillatorConfig };

interface PriceChartProps {
  data: OHLCVBar[];
  indicators?: IndicatorConfig[];
  oscillators?: OscillatorConfig[];
  markers?: SeriesMarker<Time>[];
  oscillatorHeight?: number;
  height?: number;
  timeRange?: {
    from: string;
    to: string;
  };
  onChartReady?: (chart: IChartApi) => void;
}

export function PriceChart({
  data,
  indicators = [],
  oscillators = [],
  markers = [],
  oscillatorHeight = 160,
  height,
  timeRange,
  onChartReady,
}: PriceChartProps) {
  const oscillatorPaneCount = new Set(oscillators.map((o) => o.selectionId ?? o.id ?? o.name)).size;
  const totalHeight = (height ?? 400) + oscillatorPaneCount * oscillatorHeight;

  const containerRef = useRef<HTMLDivElement>(null);

  const {
    chartRef,
    candlestickSeriesRef,
    markerSeriesRef,
    closeSeriesRef,
    indicatorSeriesRef,
    oscillatorPaneRef,
    shouldFitContentRef,
  } = useLightweightChart({ containerRef, totalHeight, onChartReady });

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
      const time = new Date(bar.timestamp).getTime() / 1000;
      candlestickMap.set(time, { time, open: bar.open, high: bar.high, low: bar.low, close: bar.close });
    });
    const candlestickData = Array.from(candlestickMap.values()).sort((a, b) => a.time - b.time);

    candlestickSeriesRef.current.setData(candlestickData as never);

    const closeData = candlestickData.map((bar) => ({ time: bar.time, value: bar.close }));
    closeSeriesRef.current?.setData(closeData as never);

    shouldFitContentRef.current = true;
    chartRef.current?.timeScale().fitContent();
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    markerSeriesRef.current?.setMarkers(markers);
  }, [markers]); // eslint-disable-line react-hooks/exhaustive-deps

  useIndicatorSeries(chartRef, indicatorSeriesRef, shouldFitContentRef, indicators);
  useOscillatorPanes(chartRef, oscillatorPaneRef, shouldFitContentRef, oscillators, oscillatorHeight, timeRange);

  return (
    <div className="w-full">
      <div ref={containerRef} className="h-full w-full" style={{ height: `${totalHeight}px` }} />
    </div>
  );
}
