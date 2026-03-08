"use client";

/**
 * Price chart component with indicator overlays.
 */
import React, { useEffect, useLayoutEffect, useRef } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  LineData,
  LineStyle,
  UTCTimestamp,
  LineWidth,
} from "lightweight-charts";
import type { OHLCVBar } from "@/lib/types/market-data";

interface PriceChartProps {
  data: OHLCVBar[];
  indicators?: {
    name: string;
    data: Array<{ timestamp: string; value: number }>;
    color?: string;
    lineStyle?: LineStyle;
    lineWidth?: number;
  }[];
  height?: number;
  showCloseLine?: boolean;
  onChartReady?: (chart: IChartApi) => void;
}

export function PriceChart({
  data,
  indicators = [],
  height = 400,
  showCloseLine = false,
  onChartReady,
}: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const closeLineSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const onChartReadyRef = useRef(onChartReady);
  useLayoutEffect(() => {
    onChartReadyRef.current = onChartReady;
  }, [onChartReady]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height,
      layout: {
        background: { color: "#ffffff" },
        textColor: "#333",
      },
      grid: {
        vertLines: { color: "#f0f0f0" },
        horzLines: { color: "#f0f0f0" },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: "#cccccc",
      },
      timeScale: {
        borderColor: "#cccccc",
        timeVisible: true,
      },
    });

    chartRef.current = chart;
    onChartReadyRef.current?.(chart);

    // Add candlestick series
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    candlestickSeriesRef.current = candlestickSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    const indicatorSeries = indicatorSeriesRef.current;
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      candlestickSeriesRef.current = null;
      closeLineSeriesRef.current = null;
      indicatorSeries.clear();
    };
  }, [height]);

  useEffect(() => {
    if (!candlestickSeriesRef.current || !data.length) return;

    // Convert data to candlestick format, deduplicate by time (keep last), and sort ascending
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
    const candlestickData: CandlestickData[] = Array.from(
      candlestickMap.values(),
    ).sort((a, b) => (a.time as number) - (b.time as number));

    candlestickSeriesRef.current.setData(candlestickData);

    if (showCloseLine && chartRef.current) {
      if (!closeLineSeriesRef.current) {
        closeLineSeriesRef.current = chartRef.current.addLineSeries({
          color: "#FF9800",
          lineWidth: 1,
          title: "Close",
          priceLineVisible: false,
          lastValueVisible: false,
        });
      }
      const closeMap = new Map<UTCTimestamp, LineData>();
      data.forEach((bar) => {
        const time = (new Date(bar.timestamp).getTime() / 1000) as UTCTimestamp;
        closeMap.set(time, { time, value: bar.close });
      });
      const closeData: LineData[] = Array.from(closeMap.values()).sort(
        (a, b) => (a.time as number) - (b.time as number),
      );
      closeLineSeriesRef.current.setData(closeData);
    } else if (
      !showCloseLine &&
      closeLineSeriesRef.current &&
      chartRef.current
    ) {
      chartRef.current.removeSeries(closeLineSeriesRef.current);
      closeLineSeriesRef.current = null;
    }

    chartRef.current?.timeScale().fitContent();
  }, [data, showCloseLine]);

  useEffect(() => {
    if (!chartRef.current) return;

    // Remove old indicator series
    indicatorSeriesRef.current.forEach((series) => {
      chartRef.current?.removeSeries(series);
    });
    indicatorSeriesRef.current.clear();

    // Add new indicator series
    indicators.forEach((indicator) => {
      if (!chartRef.current) return;

      const lineSeries = chartRef.current.addLineSeries({
        color: indicator.color || "#2196F3",
        lineWidth: (indicator.lineWidth ?? 2) as LineWidth,
        lineStyle: indicator.lineStyle ?? LineStyle.Solid,
        title: indicator.name,
        priceLineVisible: false,
        lastValueVisible: indicator.lineStyle === undefined,
      });

      const lineMap = new Map<UTCTimestamp, LineData>();
      indicator.data.forEach((point) => {
        const time = (new Date(point.timestamp).getTime() /
          1000) as UTCTimestamp;
        lineMap.set(time, { time, value: point.value });
      });
      const lineData: LineData[] = Array.from(lineMap.values()).sort(
        (a, b) => (a.time as number) - (b.time as number),
      );

      lineSeries.setData(lineData);
      indicatorSeriesRef.current.set(indicator.name, lineSeries);
    });
  }, [indicators]);

  return (
    <div className="w-full">
      <div
        ref={chartContainerRef}
        className="w-full"
        style={{ height: `${height}px` }}
      />
    </div>
  );
}
