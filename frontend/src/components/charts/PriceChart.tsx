'use client';

/**
 * Price chart component with indicator overlays and oscillator sub-pane.
 */
import React, { useEffect, useLayoutEffect, useRef } from 'react';
import {
  createChart,
  createSeriesMarkers,
  IChartApi,
  IPaneApi,
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

interface IndicatorConfig {
  name: string;
  data: Array<{ timestamp: string; value: number }>;
  color?: string;
  lineStyle?: LineStyle;
  lineWidth?: number;
}

interface OscillatorConfig {
  id?: string;
  selectionId?: string;
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

function preserveVisibleRange(chart: IChartApi, update: () => void, fitInstead = false) {
  if (fitInstead) {
    update();
    chart.timeScale().fitContent();
    return;
  }

  const savedRange = chart.timeScale().getVisibleRange();
  update();

  if (savedRange) {
    chart.timeScale().setVisibleRange(savedRange);
  }
}

function parseTimeRangeBounds(timeRange?: { from: string; to: string }) {
  if (!timeRange) {
    return null;
  }

  const from = new Date(timeRange.from).getTime();
  const to = new Date(timeRange.to).getTime();

  if (Number.isNaN(from) || Number.isNaN(to)) {
    return null;
  }

  return { from, to };
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
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const markerSeriesRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const closeSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  const oscillatorPaneRef = useRef<
    Map<
      string,
      {
        pane: IPaneApi<Time>;
        series: Map<string, ISeriesApi<'Line'>>;
        referenceLines: ISeriesApi<'Line'>[];
      }
    >
  >(new Map());
  const onChartReadyRef = useRef(onChartReady);
  const timeRangeRef = useRef(timeRange);
  const shouldFitContentRef = useRef(false);
  useLayoutEffect(() => {
    onChartReadyRef.current = onChartReady;
    timeRangeRef.current = timeRange;
  }, [onChartReady, timeRange]);

  const getOscillatorKey = (oscillator: OscillatorConfig) => oscillator.selectionId ?? oscillator.id ?? oscillator.name;
  const getOscillatorSeriesKey = (oscillator: OscillatorConfig) => oscillator.id ?? oscillator.name;
  const oscillatorPaneCount = new Set(oscillators.map((oscillator) => getOscillatorKey(oscillator))).size;
  const totalHeight = (height ?? 400) + oscillatorPaneCount * oscillatorHeight;

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const initialHeight = container.clientHeight || totalHeight;

    const chart = createChart(chartContainerRef.current, {
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

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry || !chartRef.current) {
              return;
            }

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

  useEffect(() => {
    if (!chartRef.current) return;
    preserveVisibleRange(chartRef.current, () => {
      chartRef.current?.applyOptions({ height: totalHeight });
    });
  }, [totalHeight]);

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

    shouldFitContentRef.current = true;
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  useEffect(() => {
    markerSeriesRef.current?.setMarkers(markers);
  }, [markers]);

  useEffect(() => {
    if (!chartRef.current) return;

    const activeIndicatorNames = new Set(indicators.map((indicator) => indicator.name));
    const fitContent = shouldFitContentRef.current;

    preserveVisibleRange(
      chartRef.current,
      () => {
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
          const lineData: LineData[] = Array.from(lineMap.values()).sort(
            (a, b) => (a.time as number) - (b.time as number)
          );

          lineSeries.setData(lineData);
        });
      },
      fitContent
    );
  }, [indicators]);

  useEffect(() => {
    if (!chartRef.current) return;

    const chart = chartRef.current;
    const activeOscillatorKeys = new Set(oscillators.map((oscillator) => getOscillatorKey(oscillator)));
    const groupedOscillators = new Map<string, OscillatorConfig[]>();
    const visibleBounds = parseTimeRangeBounds(timeRangeRef.current);
    const fitContent = shouldFitContentRef.current;
    shouldFitContentRef.current = false;

    preserveVisibleRange(
      chart,
      () => {
        oscillators.forEach((oscillator) => {
          const key = getOscillatorKey(oscillator);
          const existing = groupedOscillators.get(key);
          if (existing) {
            existing.push(oscillator);
          } else {
            groupedOscillators.set(key, [oscillator]);
          }
        });

        const removedPanes = Array.from(oscillatorPaneRef.current.entries())
          .filter(([key]) => !activeOscillatorKeys.has(key))
          .sort(([, left], [, right]) => right.pane.paneIndex() - left.pane.paneIndex());

        removedPanes.forEach(([key, paneState]) => {
          paneState.series.forEach((series) => chart.removeSeries(series));
          paneState.referenceLines.forEach((refLine) => chart.removeSeries(refLine));
          const paneStillExists = chart.panes().some((pane) => pane === paneState.pane);
          if (paneStillExists) {
            chart.removePane(paneState.pane.paneIndex());
          }
          oscillatorPaneRef.current.delete(key);
        });

        groupedOscillators.forEach((oscillatorGroup, paneKey) => {
          let paneState = oscillatorPaneRef.current.get(paneKey);
          if (!paneState) {
            const pane = chart.addPane();
            pane.setHeight(oscillatorHeight);
            paneState = {
              pane,
              series: new Map(),
              referenceLines: [],
            };
            oscillatorPaneRef.current.set(paneKey, paneState);
          }

          const ps = paneState;
          ps.pane.setHeight(oscillatorHeight);

          const activeSeriesKeys = new Set(oscillatorGroup.map((oscillator) => getOscillatorSeriesKey(oscillator)));
          let paneTimeBounds: { firstTime: UTCTimestamp; lastTime: UTCTimestamp } | null = null;

          ps.series.forEach((series, seriesKey) => {
            if (!activeSeriesKeys.has(seriesKey)) {
              chart.removeSeries(series);
              ps.series.delete(seriesKey);
            }
          });

          oscillatorGroup.forEach((oscillator) => {
            const seriesKey = getOscillatorSeriesKey(oscillator);
            let series = ps.series.get(seriesKey);
            if (!series) {
              series = chart.addSeries(
                LineSeries,
                {
                  color: oscillator.color,
                  lineWidth: 2 as LineWidth,
                  title: oscillator.name,
                  priceLineVisible: false,
                  lastValueVisible: true,
                },
                ps.pane.paneIndex()
              );
              ps.series.set(seriesKey, series);
            } else {
              series.applyOptions({ color: oscillator.color, title: oscillator.name });
            }

            const CHART_MAX_VALUE = 90071992547409.91;
            const lineMap = new Map<UTCTimestamp, LineData>();
            oscillator.data.forEach((point) => {
              const pointTime = new Date(point.timestamp).getTime();
              if (visibleBounds && (pointTime < visibleBounds.from || pointTime > visibleBounds.to)) {
                return;
              }
              if (!isFinite(point.value) || Math.abs(point.value) > CHART_MAX_VALUE) {
                return;
              }

              const time = (pointTime / 1000) as UTCTimestamp;
              lineMap.set(time, { time, value: point.value });
            });
            const lineData: LineData[] = Array.from(lineMap.values()).sort(
              (a, b) => (a.time as number) - (b.time as number)
            );
            series.setData(lineData);
            if (!paneTimeBounds && lineData.length > 0) {
              paneTimeBounds = visibleBounds
                ? {
                    firstTime: (visibleBounds.from / 1000) as UTCTimestamp,
                    lastTime: (visibleBounds.to / 1000) as UTCTimestamp,
                  }
                : {
                    firstTime: lineData[0].time as UTCTimestamp,
                    lastTime: lineData[lineData.length - 1].time as UTCTimestamp,
                  };
            }
          });

          const referenceLines =
            oscillatorGroup.find((oscillator) => (oscillator.referenceLines?.length ?? 0) > 0)?.referenceLines ?? [];
          if (referenceLines.length > 0 && paneTimeBounds) {
            const bounds: { firstTime: UTCTimestamp; lastTime: UTCTimestamp } = paneTimeBounds;
            if (ps.referenceLines.length !== referenceLines.length) {
              ps.referenceLines.forEach((refLine) => chart.removeSeries(refLine));
              ps.referenceLines = referenceLines.map((ref) => {
                const refSeries = chart.addSeries(
                  LineSeries,
                  {
                    color: ref.color,
                    lineWidth: 1 as LineWidth,
                    lineStyle: LineStyle.Dashed,
                    priceLineVisible: false,
                    lastValueVisible: false,
                    title: '',
                  },
                  ps.pane.paneIndex()
                );
                refSeries.setData([
                  { time: bounds.firstTime, value: ref.value },
                  { time: bounds.lastTime, value: ref.value },
                ]);
                return refSeries;
              });
            } else {
              ps.referenceLines.forEach((refSeries, index) => {
                const ref = referenceLines[index];
                refSeries.applyOptions({ color: ref.color });
                refSeries.setData([
                  { time: bounds.firstTime, value: ref.value },
                  { time: bounds.lastTime, value: ref.value },
                ]);
              });
            }
          } else if (ps.referenceLines.length > 0) {
            ps.referenceLines.forEach((refLine) => chart.removeSeries(refLine));
            ps.referenceLines = [];
          }
        });
      },
      fitContent
    );
  }, [oscillatorHeight, oscillators, timeRange]);

  return (
    <div className="w-full">
      <div ref={chartContainerRef} className="h-full w-full" style={{ height: `${totalHeight}px` }} />
    </div>
  );
}
