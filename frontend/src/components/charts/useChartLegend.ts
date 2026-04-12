import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { IChartApi, ISeriesApi, MouseEventParams, Time } from 'lightweight-charts';
import type { OscillatorPaneState } from './useLightweightChart';
import type { RegimeSegmentData } from './RegimeBackgroundPrimitive';

type CandleData = { open: number; high: number; low: number; close: number };
type LineData = { value: number };

const REGIME_COLORS_DARK: Record<string, string> = {
  bullish: '#26a69a',
  bearish: '#ef5350',
  sideways: '#9e9e9e',
  low_vol: '#2196f3',
  normal_vol: '#9e9e9e',
  high_vol: '#ff9800',
  bearish_high_vol: '#ef5350',
  bearish_low_vol: '#ef9a9a',
  bullish_low_vol: '#80cbc4',
  bullish_high_vol: '#26a69a',
};

const REGIME_COLORS_LIGHT: Record<string, string> = {
  bullish: '#00796b',
  bearish: '#c62828',
  sideways: '#616161',
  low_vol: '#1565c0',
  normal_vol: '#616161',
  high_vol: '#e65100',
  bearish_high_vol: '#c62828',
  bearish_low_vol: '#e57373',
  bullish_low_vol: '#4db6ac',
  bullish_high_vol: '#00796b',
};

function formatRegimeLabel(regime: string): string {
  return regime
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function findRegimeAtTime(segments: RegimeSegmentData[], time: number): RegimeSegmentData | null {
  for (const segment of segments) {
    if (time >= segment.start && time <= segment.end) return segment;
  }
  return null;
}

function fmt(value: number): string {
  const abs = Math.abs(value);
  if (abs === 0) return '0.00';
  if (abs < 0.01) return value.toFixed(6);
  if (abs < 1) return value.toFixed(4);
  return value.toFixed(2);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function useChartLegend(
  chartRef: React.RefObject<IChartApi | null>,
  candlestickSeriesRef: React.RefObject<ISeriesApi<'Candlestick'> | null>,
  indicatorSeriesRef: React.RefObject<Map<string, ISeriesApi<'Line'>>>,
  oscillatorPaneRef: React.RefObject<Map<string, OscillatorPaneState>>,
  regimeSegments: RegimeSegmentData[],
  showRegimes: boolean,
  symbolDisplayName?: string
): React.RefObject<HTMLDivElement | null> {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';

  const regimeSegmentsRef = useRef(regimeSegments);
  const showRegimesRef = useRef(showRegimes);
  const isDarkRef = useRef(isDark);
  const symbolDisplayNameRef = useRef(symbolDisplayName);

  useEffect(() => {
    regimeSegmentsRef.current = regimeSegments;
    showRegimesRef.current = showRegimes;
    isDarkRef.current = isDark;
    symbolDisplayNameRef.current = symbolDisplayName;
  }, [isDark, regimeSegments, showRegimes, symbolDisplayName]);
  const legendRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const legend = legendRef.current;
    if (!legend) return;

    legend.innerHTML = symbolDisplayName ? `<div style="font-weight:600">${escapeHtml(symbolDisplayName)}</div>` : '';
  }, [symbolDisplayName]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    function updateLegend(param: MouseEventParams<Time>) {
      const legend = legendRef.current;
      if (!legend) return;

      const candleSeries = candlestickSeriesRef.current;
      let html = '';

      if (symbolDisplayNameRef.current) {
        html += `<div style="font-weight:600">${escapeHtml(symbolDisplayNameRef.current)}</div>`;
      }

      if (!param.time) {
        legend.innerHTML = html;
        return;
      }

      if (candleSeries) {
        const data = param.seriesData.get(candleSeries) as CandleData | undefined;
        if (data) {
          const bullColor = isDarkRef.current ? '#26a69a' : '#00796b';
          const bearColor = isDarkRef.current ? '#ef5350' : '#c62828';
          const color = data.close >= data.open ? bullColor : bearColor;
          html += `<div style="color:${color}">O&nbsp;${fmt(data.open)}&nbsp;&nbsp;H&nbsp;${fmt(data.high)}&nbsp;&nbsp;L&nbsp;${fmt(data.low)}&nbsp;&nbsp;C&nbsp;${fmt(data.close)}</div>`;
        }
      }

      indicatorSeriesRef.current.forEach((series, name) => {
        const opts = series.options() as { visible?: boolean; color?: string };
        if (opts.visible === false) return;
        const data = param.seriesData.get(series) as LineData | undefined;
        if (!data) return;
        const color = opts.color ?? '#2196F3';
        html += `<div><span style="color:${color}">&#9632;</span>&nbsp;${name}:&nbsp;${fmt(data.value)}</div>`;
      });

      oscillatorPaneRef.current.forEach((paneState) => {
        paneState.series.forEach((series, name) => {
          const opts = series.options() as { color?: string };
          const data = param.seriesData.get(series) as LineData | undefined;
          if (!data) return;
          const color = opts.color ?? '#2196F3';
          html += `<div><span style="color:${color}">&#9632;</span>&nbsp;${name}:&nbsp;${fmt(data.value)}</div>`;
        });
      });

      if (showRegimesRef.current && regimeSegmentsRef.current.length > 0) {
        const time = param.time as number;
        const segment = findRegimeAtTime(regimeSegmentsRef.current, time);
        if (segment) {
          const regimeColors = isDarkRef.current ? REGIME_COLORS_DARK : REGIME_COLORS_LIGHT;
          const color = regimeColors[segment.regime] ?? (isDarkRef.current ? '#9e9e9e' : '#616161');
          html += `<div><span style="color:${color}">&#9632;</span>&nbsp;Regime:&nbsp;${formatRegimeLabel(segment.regime)}</div>`;
        }
      }

      legend.innerHTML = html;
    }

    chart.subscribeCrosshairMove(updateLegend);
    return () => {
      chart.unsubscribeCrosshairMove(updateLegend);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return legendRef;
}
