import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { marketDataApi, technicalAnalysisApi } from '@/lib/api';
import type { IndicatorResult } from '@/lib/api/technical-analysis';
import {
  buildChartSeries,
  buildIndicatorPresetOptions,
  serializeIndicatorKey,
} from '@/lib/technical-analysis/chart-model';
import type { OHLCVBar } from '@/lib/types/market-data';
import { DEFAULT_RANGE_DAYS, DEFAULT_SYMBOL, INDICATOR_LOOKBACK_DAYS } from '../constants';

type SupportedIndicators = Awaited<ReturnType<typeof technicalAnalysisApi.getSupportedIndicators>>['indicators'];

interface LoadedRequest {
  symbol: string;
  startDate: string;
  indicatorStartDate: string;
  endDate: string;
}

function formatDate(value: Date) {
  return value.toISOString().split('T')[0];
}

function buildDateRange(days: number) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  endDate.setDate(endDate.getDate() - 1);

  const indicatorStartDate = new Date(startDate);
  indicatorStartDate.setDate(indicatorStartDate.getDate() - INDICATOR_LOOKBACK_DAYS);

  return {
    startDate: formatDate(startDate),
    indicatorStartDate: formatDate(indicatorStartDate),
    endDate: formatDate(endDate),
  };
}

function emptySet<T>() {
  return new Set<T>();
}

export function useTechnicalAnalysisChart() {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [rangeDays, setRangeDays] = useState(DEFAULT_RANGE_DAYS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<OHLCVBar[]>([]);
  const [indicatorResults, setIndicatorResults] = useState<IndicatorResult[]>([]);
  const [supportedIndicators, setSupportedIndicators] = useState<SupportedIndicators>([]);
  const [supportedIndicatorsReady, setSupportedIndicatorsReady] = useState(false);
  const [enabledIndicatorIds, setEnabledIndicatorIds] = useState<Set<string>>(emptySet());
  const [loadingIndicatorIds, setLoadingIndicatorIds] = useState<Set<string>>(emptySet());
  const [loadedRequest, setLoadedRequest] = useState<LoadedRequest | null>(null);
  const chartRequestVersionRef = useRef(0);

  const indicatorOptions = useMemo(() => buildIndicatorPresetOptions(supportedIndicators), [supportedIndicators]);

  const optionDefinitions = useMemo(
    () => indicatorOptions.map(({ id, name, params, label, color }) => ({ id, name, params, label, color })),
    [indicatorOptions]
  );

  const groupedOptions = useMemo(
    () => ({
      overlay: indicatorOptions.filter((option) => option.pane === 'overlay'),
      oscillator: indicatorOptions.filter((option) => option.pane === 'oscillator'),
      other: indicatorOptions.filter((option) => option.pane === 'other'),
    }),
    [indicatorOptions]
  );

  const loadedIndicatorIds = useMemo(
    () => new Set(indicatorResults.map((result) => serializeIndicatorKey(result.name, result.params ?? {}))),
    [indicatorResults]
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
  const activeOverlayLegend = useMemo(
    () => groupedOptions.overlay.filter((option) => enabledIndicatorIds.has(option.id)),
    [enabledIndicatorIds, groupedOptions.overlay]
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

  useEffect(() => {
    let cancelled = false;

    const loadSupportedIndicators = async () => {
      try {
        const response = await technicalAnalysisApi.getSupportedIndicators();
        if (cancelled) {
          return;
        }

        setSupportedIndicators(response.indicators);
      } catch (err: any) {
        if (cancelled) {
          return;
        }

        setError(err.message || 'Failed to load supported indicators');
      } finally {
        if (!cancelled) {
          setSupportedIndicatorsReady(true);
        }
      }
    };

    void loadSupportedIndicators();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadData = useCallback(
    async (days = rangeDays) => {
      if (indicatorOptions.length === 0) {
        setError('No chartable indicators are configured');
        return;
      }

      const normalizedSymbol = symbol.trim().toUpperCase();
      if (!normalizedSymbol) {
        setError('Enter a symbol to load a chart');
        return;
      }

      const requestVersion = ++chartRequestVersionRef.current;
      const selectedIndicatorRequests = indicatorOptions
        .filter((option) => enabledIndicatorIds.has(option.id))
        .map(({ name, params }) => ({ name, params }));
      const dateRange = buildDateRange(days);

      setLoading(true);
      setError(null);
      setLoadingIndicatorIds(emptySet());
      setSymbol(normalizedSymbol);

      try {
        const [marketData, indicatorResult] = await Promise.all([
          marketDataApi.getBars({
            symbols: [normalizedSymbol],
            start_date: dateRange.startDate,
            end_date: dateRange.endDate,
            timeframe: '1d',
          }),
          selectedIndicatorRequests.length > 0
            ? technicalAnalysisApi.calculateIndicators({
                symbol: normalizedSymbol,
                timeframe: '1d',
                start_date: dateRange.indicatorStartDate,
                end_date: dateRange.endDate,
                indicators: selectedIndicatorRequests,
              })
            : Promise.resolve({
                symbol: normalizedSymbol,
                timeframe: '1d',
                indicators: [],
              }),
        ]);

        if (requestVersion !== chartRequestVersionRef.current) {
          return;
        }

        if (marketData.length > 0 && marketData[0].bars.length > 0) {
          setChartData(marketData[0].bars);
          setIndicatorResults(indicatorResult.indicators);
          setLoadedRequest({
            symbol: normalizedSymbol,
            startDate: dateRange.startDate,
            indicatorStartDate: dateRange.indicatorStartDate,
            endDate: dateRange.endDate,
          });
          return;
        }

        setError('No data available for this symbol');
        setChartData([]);
        setIndicatorResults([]);
        setLoadedRequest(null);
      } catch (err: any) {
        if (requestVersion !== chartRequestVersionRef.current) {
          return;
        }

        setError(err.message || 'Failed to load data');
      } finally {
        if (requestVersion === chartRequestVersionRef.current) {
          setLoading(false);
        }
      }
    },
    [enabledIndicatorIds, indicatorOptions, rangeDays, symbol]
  );

  const selectRange = useCallback(
    async (days: number) => {
      setRangeDays(days);
      await loadData(days);
    },
    [loadData]
  );

  const toggleIndicator = useCallback(
    async (id: string) => {
      const isEnabled = enabledIndicatorIds.has(id);
      if (isEnabled) {
        setEnabledIndicatorIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        return;
      }

      const option = indicatorOptions.find((candidate) => candidate.id === id);
      if (!option) {
        return;
      }

      setEnabledIndicatorIds((prev) => new Set(prev).add(id));

      if (loadedIndicatorIds.has(id) || !loadedRequest) {
        return;
      }

      setLoadingIndicatorIds((prev) => new Set(prev).add(id));
      const requestVersion = chartRequestVersionRef.current;

      try {
        const response = await technicalAnalysisApi.calculateIndicators({
          symbol: loadedRequest.symbol,
          timeframe: '1d',
          start_date: loadedRequest.indicatorStartDate,
          end_date: loadedRequest.endDate,
          indicators: [{ name: option.name, params: option.params }],
        });

        if (requestVersion !== chartRequestVersionRef.current) {
          return;
        }

        setIndicatorResults((prev) => [
          ...prev.filter((result) => serializeIndicatorKey(result.name, result.params ?? {}) !== id),
          ...response.indicators,
        ]);
      } catch (err: any) {
        if (requestVersion !== chartRequestVersionRef.current) {
          return;
        }

        setEnabledIndicatorIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setError(err.message || `Failed to load ${option.displayName}`);
      } finally {
        setLoadingIndicatorIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [enabledIndicatorIds, indicatorOptions, loadedIndicatorIds, loadedRequest]
  );

  const clear = useCallback(() => {
    chartRequestVersionRef.current += 1;
    setSymbol(DEFAULT_SYMBOL);
    setRangeDays(DEFAULT_RANGE_DAYS);
    setLoading(false);
    setError(null);
    setChartData([]);
    setIndicatorResults([]);
    setEnabledIndicatorIds(emptySet());
    setLoadingIndicatorIds(emptySet());
    setLoadedRequest(null);
  }, []);

  return {
    symbol,
    rangeDays,
    loading,
    error,
    chartData,
    enabledIndicatorIds,
    loadingIndicatorIds,
    overlayOptions: groupedOptions.overlay,
    oscillatorOptions: groupedOptions.oscillator,
    otherOptions: groupedOptions.other,
    activeOverlaySeries,
    activeOscillatorSeries,
    activeOverlayLegend,
    loadDisabled: loading || !supportedIndicatorsReady || indicatorOptions.length === 0,
    hasChartData: chartData.length > 0,
    timeRange,
    setSymbol: (value: string) => setSymbol(value.toUpperCase()),
    loadData,
    clear,
    selectRange,
    toggleIndicator,
  };
}
