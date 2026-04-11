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
      // Use candlestickSeriesRef.current (live value) rather than the captured `series`
      // to detect whether the chart was already removed by useLightweightChart's cleanup.
      // Calling detachPrimitive after chart.remove() schedules a spurious rAF that throws
      // "Object is disposed" when it fires on the now-disposed canvas bindings.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const liveSeries = candlestickSeriesRef.current;
      if (primitive && liveSeries) {
        liveSeries.detachPrimitive(primitive);
      }
      primitiveRef.current = null;
    };
  }, [chartRef, candlestickSeriesRef, segments, enabled]);
}
