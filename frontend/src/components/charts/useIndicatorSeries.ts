import { useEffect } from 'react';
import { IChartApi, ISeriesApi, LineSeries, LineWidth } from 'lightweight-charts';

import { IndicatorConfig, preserveVisibleRange } from './chart-utils';

export function useIndicatorSeries(
  chartRef: React.RefObject<IChartApi | null>,
  indicatorSeriesRef: React.RefObject<Map<string, ISeriesApi<'Line'>>>,
  shouldFitContentRef: React.RefObject<boolean>,
  indicators: IndicatorConfig[]
) {
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
                lineStyle: indicator.lineStyle,
                title: indicator.name,
                priceLineVisible: false,
                lastValueVisible: indicator.lineStyle === undefined,
                visible: true,
              },
              0
            );
            indicatorSeriesRef.current.set(indicator.name, lineSeries);
          } else {
            lineSeries.applyOptions({
              color: indicator.color || '#2196F3',
              lineWidth: (indicator.lineWidth ?? 2) as LineWidth,
              lineStyle: indicator.lineStyle,
              title: indicator.name,
              priceLineVisible: false,
              lastValueVisible: indicator.lineStyle === undefined,
              visible: true,
            });
          }

          const lineMap = new Map<number, { time: number; value: number }>();
          indicator.data.forEach((point) => {
            const time = new Date(point.timestamp).getTime() / 1000;
            lineMap.set(time, { time, value: point.value });
          });
          const lineData = Array.from(lineMap.values()).sort((a, b) => a.time - b.time);

          lineSeries.setData(lineData as never);
        });
      },
      fitContent
    );
  }, [indicators]); // eslint-disable-line react-hooks/exhaustive-deps
}
