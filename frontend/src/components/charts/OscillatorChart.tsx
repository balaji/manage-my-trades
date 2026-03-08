"use client";

import React, { useEffect, useRef } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  LineData,
  LineStyle,
  UTCTimestamp,
} from "lightweight-charts";

export interface OscillatorSeriesConfig {
  color: string;
  title: string;
}

export interface OscillatorReferenceLine {
  value: number;
  color: string;
}

interface OscillatorChartProps {
  seriesConfigs: OscillatorSeriesConfig[];
  seriesData: Array<Array<{ timestamp: string; value: number }>>;
  referenceLines?: OscillatorReferenceLine[];
  height?: number;
  onChartReady?: (chart: IChartApi) => void;
}

export function OscillatorChart({
  seriesConfigs,
  seriesData,
  referenceLines = [],
  height = 160,
  onChartReady,
}: OscillatorChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<ISeriesApi<"Line">[]>([]);
  const refLineRefs = useRef<ISeriesApi<"Line">[]>([]);

  // Create chart and series once (based on seriesConfigs length)
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { color: "#ffffff" },
        textColor: "#333",
      },
      grid: {
        vertLines: { color: "#f0f0f0" },
        horzLines: { color: "#f0f0f0" },
      },
      crosshair: { mode: 1 },
      rightPriceScale: {
        borderColor: "#cccccc",
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: "#cccccc",
        timeVisible: true,
      },
    });

    chartRef.current = chart;

    seriesRefs.current = seriesConfigs.map((cfg) =>
      chart.addLineSeries({
        color: cfg.color,
        lineWidth: 2,
        title: cfg.title,
        priceLineVisible: false,
      }),
    );

    refLineRefs.current = referenceLines.map(() =>
      chart.addLineSeries({
        color: "#cccccc", // placeholder; updated when data arrives
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
        title: "",
      }),
    );

    onChartReady?.(chart);

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
        });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRefs.current = [];
      refLineRefs.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  // Update series data
  useEffect(() => {
    if (!chartRef.current || seriesRefs.current.length === 0) return;

    let firstTime: number | null = null;
    let lastTime: number | null = null;

    seriesData.forEach((points, i) => {
      if (!seriesRefs.current[i] || !points.length) return;
      const closeMap = new Map<number, LineData>();
      points.forEach((bar) => {
        const time = (new Date(bar.timestamp).getTime() / 1000) as UTCTimestamp;
        closeMap.set(time, { time, value: bar.value });
      });
      const lineData: LineData[] = Array.from(closeMap.values()).sort(
        (a, b) => (a.time as number) - (b.time as number),
      );

      // const lineData: LineData[] = points.map((p) => ({
      //   time: new Date(p.timestamp).getTime() / 1000,
      //   value: p.value,
      // }));
      seriesRefs.current[i].setData(lineData);
      if (firstTime === null) firstTime = lineData[0].time as number;
      lastTime = lineData[lineData.length - 1].time as number;
    });

    if (firstTime !== null && lastTime !== null) {
      referenceLines.forEach((ref, i) => {
        if (!refLineRefs.current[i]) return;
        refLineRefs.current[i].applyOptions({ color: ref.color });
        refLineRefs.current[i].setData([
          { time: firstTime as UTCTimestamp, value: ref.value },
          { time: lastTime as UTCTimestamp, value: ref.value },
        ]);
      });
    }

    chartRef.current.timeScale().fitContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesData]);

  return (
    <div
      ref={containerRef}
      className="w-full"
      style={{ height: `${height}px` }}
    />
  );
}
