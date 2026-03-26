'use client';

/**
 * Price chart component with indicator overlays and oscillator sub-pane.
 */
import React, { useEffect, useLayoutEffect, useRef } from 'react';
import {
  createChart,
  createSeriesMarkers,
  IChartApi,
  ISeriesMarkersPluginApi,
  ISeriesApi,
  CandlestickData,
  LineData,
  LineStyle,
  SeriesMarker,
  Time,
  UTCTimestamp,
  LineWidth,
  CandlestickSeries,
  LineSeries,
} from 'lightweight-charts';
import type { OHLCVBar } from '@/lib/types/market-data';
import { getRemovedSeriesNames } from './seriesCleanup.js';

interface IndicatorConfig {
  name: string;
  data: Array<{ timestamp: string; value: number }>;
  color?: string;
  lineStyle?: LineStyle;
  lineWidth?: number;
}

interface OscillatorConfig {
  name: string;
  data: Array<{ timestamp: string; value: number }>;
  color: string;
  referenceLines?: Array<{ value: number; color: string }>;
}

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
  height = 400,
  timeRange,
  onChartReady,
}: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const markerSeriesRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const closeSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  // Oscillator pane (pane index 1) series and reference lines
  const oscillatorSeriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  const refLineSeriesRef = useRef<Map<string, ISeriesApi<'Line'>[]>>(new Map());
  const onChartReadyRef = useRef(onChartReady);
  const timeRangeRef = useRef(timeRange);
  useLayoutEffect(() => {
    onChartReadyRef.current = onChartReady;
    timeRangeRef.current = timeRange;
  }, [onChartReady, timeRange]);
  const prevDataRef = useRef(data);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height + oscillatorHeight,
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

    // Pane 0: candlestick + close line
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

    // Pane 1: oscillator sub-pane
    const oscPane = chart.addPane();
    oscPane.setHeight(oscillatorHeight);

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };
    window.addEventListener('resize', handleResize);

    onChartReadyRef.current?.(chart);

    const indicatorSeries = indicatorSeriesRef.current;
    const oscillatorSeries = oscillatorSeriesRef.current;
    const refLineSeries = refLineSeriesRef.current;

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      candlestickSeriesRef.current = null;
      markerSeriesRef.current = null;
      closeSeriesRef.current = null;
      indicatorSeries.clear();
      oscillatorSeries.clear();
      refLineSeries.clear();
    };
  }, [height, oscillatorHeight]);

  useEffect(() => {
    if (!candlestickSeriesRef.current || !data.length) return;

    const candlestickMap = new Map<UTCTimestamp, CandlestickData>();
    data.forEach((bar) => {
      const time = (new Date(bar.timestamp).getTime() / 1000) as UTCTimestamp;
      candlestickMap.set(time, {
        time,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      });
    });
    const candlestickData: CandlestickData[] = Array.from(candlestickMap.values()).sort(
      (a, b) => (a.time as number) - (b.time as number)
    );

    candlestickSeriesRef.current.setData(candlestickData);

    const closeData: LineData[] = candlestickData.map((bar) => ({ time: bar.time, value: bar.close }));
    closeSeriesRef.current?.setData(closeData);

    const dataChanged = prevDataRef.current !== data;
    const savedRange = !dataChanged ? chartRef.current?.timeScale().getVisibleLogicalRange() : null;

    if (dataChanged) {
      prevDataRef.current = data;
    } else if (timeRangeRef.current) {
      chartRef.current?.timeScale().fitContent();
    } else if (savedRange) {
      chartRef.current?.timeScale().setVisibleLogicalRange(savedRange);
    }
  }, [data]);

  useEffect(() => {
    markerSeriesRef.current?.setMarkers(markers);
  }, [markers]);

  useEffect(() => {
    if (!chartRef.current) return;

    const savedRange = chartRef.current.timeScale().getVisibleLogicalRange();
    const activeIndicatorNames = new Set(indicators.map((indicator) => indicator.name));

    indicatorSeriesRef.current.forEach((series, name) => {
      if (!activeIndicatorNames.has(name)) {
        series.applyOptions({ visible: false });
      }
    });

    indicators.forEach((indicator) => {
      if (!chartRef.current) return;

      let lineSeries = indicatorSeriesRef.current.get(indicator.name);
      if (!lineSeries) {
        lineSeries = chartRef.current.addSeries(
          LineSeries,
          {
            color: indicator.color || '#2196F3',
            lineWidth: (indicator.lineWidth ?? 2) as LineWidth,
            lineStyle: indicator.lineStyle ?? LineStyle.Solid,
            title: indicator.name,
            priceLineVisible: false,
            lastValueVisible: indicator.lineStyle === undefined,
            visible: true,
          },
          0 // pane 0
        );
        indicatorSeriesRef.current.set(indicator.name, lineSeries);
      } else {
        lineSeries.applyOptions({
          color: indicator.color || '#2196F3',
          lineWidth: (indicator.lineWidth ?? 2) as LineWidth,
          lineStyle: indicator.lineStyle ?? LineStyle.Solid,
          title: indicator.name,
          priceLineVisible: false,
          lastValueVisible: indicator.lineStyle === undefined,
          visible: true,
        });
      }

      const lineMap = new Map<UTCTimestamp, LineData>();
      indicator.data.forEach((point) => {
        const time = (new Date(point.timestamp).getTime() / 1000) as UTCTimestamp;
        lineMap.set(time, { time, value: point.value });
      });
      const lineData: LineData[] = Array.from(lineMap.values()).sort((a, b) => (a.time as number) - (b.time as number));

      lineSeries.setData(lineData);
    });

    if (timeRangeRef.current) {
      chartRef.current?.timeScale().fitContent();
    } else if (savedRange) {
      chartRef.current.timeScale().setVisibleLogicalRange(savedRange);
    }
  }, [indicators]);

  useEffect(() => {
    if (!chartRef.current) return;

    const activeOscillatorNames = new Set(oscillators.map((oscillator) => oscillator.name));

    getRemovedSeriesNames(Array.from(oscillatorSeriesRef.current.keys()), Array.from(activeOscillatorNames)).forEach(
      (name) => {
        const series = oscillatorSeriesRef.current.get(name);
        if (series) {
          chartRef.current?.removeSeries(series);
          oscillatorSeriesRef.current.delete(name);
        }

        const refLines = refLineSeriesRef.current.get(name) ?? [];
        refLines.forEach((refLine) => chartRef.current?.removeSeries(refLine));
        refLineSeriesRef.current.delete(name);
      }
    );

    oscillators.forEach((oscillator) => {
      if (!chartRef.current) return;

      let series = oscillatorSeriesRef.current.get(oscillator.name);
      if (!series) {
        series = chartRef.current.addSeries(
          LineSeries,
          {
            color: oscillator.color,
            lineWidth: 2 as LineWidth,
            title: oscillator.name,
            priceLineVisible: false,
            lastValueVisible: true,
          },
          1 // pane 1 (oscillator sub-pane)
        );
        oscillatorSeriesRef.current.set(oscillator.name, series);
      } else {
        series.applyOptions({ color: oscillator.color, title: oscillator.name });
      }

      const lineMap = new Map<UTCTimestamp, LineData>();
      oscillator.data.forEach((point) => {
        const time = (new Date(point.timestamp).getTime() / 1000) as UTCTimestamp;
        lineMap.set(time, { time, value: point.value });
      });
      const lineData: LineData[] = Array.from(lineMap.values()).sort((a, b) => (a.time as number) - (b.time as number));
      series.setData(lineData);

      // Draw reference lines spanning the full data range
      if (oscillator.referenceLines?.length && lineData.length > 0) {
        const firstTime = lineData[0].time;
        const lastTime = lineData[lineData.length - 1].time;

        const existingRefLines = refLineSeriesRef.current.get(oscillator.name) ?? [];

        // Remove stale ref lines if count changed
        if (existingRefLines.length !== oscillator.referenceLines.length) {
          existingRefLines.forEach((s) => chartRef.current?.removeSeries(s));
          refLineSeriesRef.current.delete(oscillator.name);
        }

        const currentRefLines = refLineSeriesRef.current.get(oscillator.name);
        if (!currentRefLines) {
          const newRefLines = oscillator.referenceLines.map((ref) => {
            const refSeries = chartRef.current!.addSeries(
              LineSeries,
              {
                color: ref.color,
                lineWidth: 1 as LineWidth,
                lineStyle: LineStyle.Dashed,
                priceLineVisible: false,
                lastValueVisible: false,
                title: '',
              },
              1
            );
            refSeries.setData([
              { time: firstTime, value: ref.value },
              { time: lastTime, value: ref.value },
            ]);
            return refSeries;
          });
          refLineSeriesRef.current.set(oscillator.name, newRefLines);
        } else {
          currentRefLines.forEach((refSeries, i) => {
            const ref = oscillator.referenceLines![i];
            refSeries.applyOptions({ color: ref.color });
            refSeries.setData([
              { time: firstTime, value: ref.value },
              { time: lastTime, value: ref.value },
            ]);
          });
        }
      }

      if (!oscillator.referenceLines?.length) {
        const existingRefLines = refLineSeriesRef.current.get(oscillator.name) ?? [];
        existingRefLines.forEach((refLine) => chartRef.current?.removeSeries(refLine));
        refLineSeriesRef.current.delete(oscillator.name);
      }
    });
  }, [oscillators]);

  return (
    <div className="w-full">
      <div ref={chartContainerRef} className="w-full" style={{ height: `${height + oscillatorHeight}px` }} />
    </div>
  );
}
