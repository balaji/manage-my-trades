import { useEffect, useRef } from 'react';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import { RegimeBackgroundPrimitive } from './RegimeBackgroundPrimitive';
import type { RegimeSegmentData } from './RegimeBackgroundPrimitive';

export type { RegimeSegmentData };

export function useRegimeOverlay(
  chartRef: React.RefObject<IChartApi | null>,
  candlestickSeriesRef: React.RefObject<ISeriesApi<'Candlestick'> | null>,
  segments: RegimeSegmentData[],
  enabled: boolean
) {
  const primitiveRef = useRef<RegimeBackgroundPrimitive | null>(null);

  useEffect(() => {
    const series = candlestickSeriesRef.current;
    if (!series || !enabled) {
      if (primitiveRef.current && series) {
        series.detachPrimitive(primitiveRef.current);
        primitiveRef.current = null;
      }
      return;
    }

    if (!primitiveRef.current) {
      primitiveRef.current = new RegimeBackgroundPrimitive();
      series.attachPrimitive(primitiveRef.current);
    }

    primitiveRef.current.setSegments(segments);

    const primitive = primitiveRef.current;
    return () => {
      if (primitive && series) {
        series.detachPrimitive(primitive);
        primitiveRef.current = null;
      }
    };
  }, [chartRef, candlestickSeriesRef, segments, enabled]);
}
