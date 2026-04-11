import { useEffect } from 'react';
import { IChartApi, ISeriesApi, LineSeries, LineStyle, LineWidth, UTCTimestamp } from 'lightweight-charts';
import { toChartUnixSeconds } from '@/lib/chart-time';

import { OscillatorConfig, parseTimeRangeBounds, preserveVisibleRange } from './chart-utils';
import type { OscillatorPaneState } from './useLightweightChart';

const CHART_MAX_VALUE = 90071992547409.91;

function getOscillatorKey(oscillator: OscillatorConfig) {
  return oscillator.selectionId ?? oscillator.id ?? oscillator.name;
}

function getOscillatorSeriesKey(oscillator: OscillatorConfig) {
  return oscillator.id ?? oscillator.name;
}

export function useOscillatorPanes(
  chartRef: React.RefObject<IChartApi | null>,
  oscillatorPaneRef: React.RefObject<Map<string, OscillatorPaneState>>,
  oscillators: OscillatorConfig[],
  oscillatorHeight: number,
  timeRange: { from: string; to: string } | undefined
) {
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = chartRef.current;
    const activeOscillatorKeys = new Set(oscillators.map(getOscillatorKey));
    const groupedOscillators = new Map<string, OscillatorConfig[]>();
    const visibleBounds = parseTimeRangeBounds(timeRange);

    preserveVisibleRange(chart, () => {
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
          paneState = { pane, series: new Map(), referenceLines: [] };
          oscillatorPaneRef.current.set(paneKey, paneState);
        }

        const ps = paneState;
        ps.pane.setHeight(oscillatorHeight);

        const activeSeriesKeys = new Set(oscillatorGroup.map(getOscillatorSeriesKey));
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

          const lineMap = new Map<UTCTimestamp, { time: UTCTimestamp; value: number }>();
          oscillator.data.forEach((point) => {
            const pointTime = toChartUnixSeconds(point.timestamp) * 1000;
            if (visibleBounds && (pointTime < visibleBounds.from || pointTime > visibleBounds.to)) {
              return;
            }
            if (!isFinite(point.value) || Math.abs(point.value) > CHART_MAX_VALUE) {
              return;
            }

            const time = (pointTime / 1000) as UTCTimestamp;
            lineMap.set(time, { time, value: point.value });
          });
          const lineData = Array.from(lineMap.values()).sort((a, b) => (a.time as number) - (b.time as number));
          series.setData(lineData as never);

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
              ) as ISeriesApi<'Line'>;
              refSeries.setData([
                { time: bounds.firstTime, value: ref.value },
                { time: bounds.lastTime, value: ref.value },
              ] as never);
              return refSeries;
            });
          } else {
            ps.referenceLines.forEach((refSeries, index) => {
              const ref = referenceLines[index];
              refSeries.applyOptions({ color: ref.color });
              refSeries.setData([
                { time: bounds.firstTime, value: ref.value },
                { time: bounds.lastTime, value: ref.value },
              ] as never);
            });
          }
        } else if (ps.referenceLines.length > 0) {
          ps.referenceLines.forEach((refLine) => chart.removeSeries(refLine));
          ps.referenceLines = [];
        }
      });
    });
  }, [oscillatorHeight, oscillators, timeRange]); // eslint-disable-line react-hooks/exhaustive-deps
}
