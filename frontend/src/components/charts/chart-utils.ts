import { IChartApi, LineStyle } from 'lightweight-charts';

export interface IndicatorConfig {
  name: string;
  data: Array<{ timestamp: string; value: number }>;
  color?: string;
  lineStyle?: LineStyle;
  lineWidth?: number;
}

export interface OscillatorConfig {
  id?: string;
  selectionId?: string;
  name: string;
  data: Array<{ timestamp: string; value: number }>;
  color: string;
  referenceLines?: Array<{ value: number; color: string }>;
}

export function preserveVisibleRange(chart: IChartApi, update: () => void) {
  update();
  chart.timeScale().fitContent();
}

export function parseTimeRangeBounds(timeRange?: { from: string; to: string }) {
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
