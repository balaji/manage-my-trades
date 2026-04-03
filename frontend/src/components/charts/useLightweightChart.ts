import { useEffect, useLayoutEffect, useRef } from 'react';
import {
  createChart,
  createSeriesMarkers,
  IChartApi,
  IPaneApi,
  ISeriesMarkersPluginApi,
  ISeriesApi,
  LineStyle,
  Time,
  LineWidth,
  CandlestickSeries,
  LineSeries,
} from 'lightweight-charts';

import type { OscillatorConfig } from './chart-utils';

export interface OscillatorPaneState {
  pane: IPaneApi<Time>;
  series: Map<string, ISeriesApi<'Line'>>;
  referenceLines: ISeriesApi<'Line'>[];
}

interface UseLightweightChartOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  totalHeight: number;
  onChartReady?: (chart: IChartApi) => void;
}

interface UseLightweightChartResult {
  chartRef: React.MutableRefObject<IChartApi | null>;
  candlestickSeriesRef: React.MutableRefObject<ISeriesApi<'Candlestick'> | null>;
  markerSeriesRef: React.MutableRefObject<ISeriesMarkersPluginApi<Time> | null>;
  closeSeriesRef: React.MutableRefObject<ISeriesApi<'Line'> | null>;
  indicatorSeriesRef: React.MutableRefObject<Map<string, ISeriesApi<'Line'>>>;
  oscillatorPaneRef: React.MutableRefObject<Map<string, OscillatorPaneState>>;
}

export function useLightweightChart({
  containerRef,
  totalHeight,
  onChartReady,
}: UseLightweightChartOptions): UseLightweightChartResult {
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const markerSeriesRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const closeSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  const oscillatorPaneRef = useRef<Map<string, OscillatorPaneState>>(new Map());
  const onChartReadyRef = useRef(onChartReady);

  useLayoutEffect(() => {
    onChartReadyRef.current = onChartReady;
  }, [onChartReady]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const initialHeight = container.clientHeight || totalHeight;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: initialHeight,
      layout: {
        background: { color: '#ffffff' },
        textColor: '#333',
      },
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: '#cccccc' },
      timeScale: {
        borderColor: '#cccccc',
        timeVisible: true,
      },
    });

    chartRef.current = chart;

    candlestickSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });
    markerSeriesRef.current = createSeriesMarkers(candlestickSeriesRef.current, []);

    closeSeriesRef.current = chart.addSeries(LineSeries, {
      color: 'rgba(100, 100, 100, 0.5)',
      lineWidth: 1 as LineWidth,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry || !chartRef.current) return;
            chartRef.current.applyOptions({
              width: Math.floor(entry.contentRect.width),
              height: Math.floor(entry.contentRect.height) || initialHeight,
            });
          })
        : null;
    resizeObserver?.observe(container);

    onChartReadyRef.current?.(chart);

    const indicatorSeries = indicatorSeriesRef.current;
    const oscillatorPanes = oscillatorPaneRef.current;

    return () => {
      resizeObserver?.disconnect();
      chart.remove();
      chartRef.current = null;
      candlestickSeriesRef.current = null;
      markerSeriesRef.current = null;
      closeSeriesRef.current = null;
      indicatorSeries.clear();
      oscillatorPanes.clear();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    chartRef,
    candlestickSeriesRef,
    markerSeriesRef,
    closeSeriesRef,
    indicatorSeriesRef,
    oscillatorPaneRef,
  };
}

// Re-export OscillatorConfig so consumers can import from one place
export type { OscillatorConfig };
