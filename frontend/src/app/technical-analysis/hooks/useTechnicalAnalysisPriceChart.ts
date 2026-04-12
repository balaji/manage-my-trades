import { useMemo } from 'react';
import type { IndicatorResult, RegimeType, SupportedIndicator } from '@/lib/api/technical-analysis';
import type { OHLCVBar } from '@/lib/types/market-data';
import { buildChartSeries, type IndicatorPresetOption } from '@/lib/technical-analysis/chart-model';
import type { RegimeSegmentData } from '@/components/charts/useRegimeOverlay';

interface LoadedRequest {
  symbol: string;
  startDate: string;
  endDate: string;
}

interface UseTechnicalAnalysisPriceChartOptions {
  chartData: OHLCVBar[];
  symbolDisplayName: string | null;
  indicatorResults: IndicatorResult[];
  indicatorOptions: IndicatorPresetOption[];
  supportedIndicators: SupportedIndicator[];
  enabledIndicatorIds: Set<string>;
  loadedRequest: LoadedRequest | null;
  regimeType: RegimeType | null;
  regimeSegments: RegimeSegmentData[];
}

export function useTechnicalAnalysisPriceChart({
  chartData,
  symbolDisplayName,
  indicatorResults,
  indicatorOptions,
  supportedIndicators,
  enabledIndicatorIds,
  loadedRequest,
  regimeType,
  regimeSegments,
}: UseTechnicalAnalysisPriceChartOptions) {
  const optionDefinitions = useMemo(
    () => indicatorOptions.map(({ id, name, params, label, color }) => ({ id, name, params, label, color })),
    [indicatorOptions]
  );

  const chartSeries = useMemo(
    () => buildChartSeries(indicatorResults, supportedIndicators, optionDefinitions, loadedRequest?.startDate),
    [indicatorResults, loadedRequest?.startDate, optionDefinitions, supportedIndicators]
  );

  const activeOverlaySeries = useMemo(
    () => chartSeries.overlays.filter((series) => enabledIndicatorIds.has(series.selectionId)),
    [chartSeries.overlays, enabledIndicatorIds]
  );

  const activeOscillatorSeries = useMemo(
    () => chartSeries.oscillators.filter((series) => enabledIndicatorIds.has(series.selectionId)),
    [chartSeries.oscillators, enabledIndicatorIds]
  );

  const timeRange = useMemo(
    () =>
      loadedRequest
        ? {
            from: `${loadedRequest.startDate}T00:00:00Z`,
            to: `${loadedRequest.endDate}T23:59:59Z`,
          }
        : undefined,
    [loadedRequest]
  );

  const priceChartProps = useMemo(
    () => ({
      data: chartData,
      symbolDisplayName: symbolDisplayName ?? undefined,
      indicators: activeOverlaySeries,
      oscillators: activeOscillatorSeries,
      regimeSegments,
      showRegimes: regimeType !== null,
      timeRange,
    }),
    [activeOscillatorSeries, activeOverlaySeries, chartData, regimeSegments, regimeType, symbolDisplayName, timeRange]
  );

  return {
    hasChartData: chartData.length > 0,
    priceChartProps,
  };
}
