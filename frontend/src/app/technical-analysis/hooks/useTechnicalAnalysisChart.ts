import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { marketDataApi } from '@/lib/api/market-data';
import { technicalAnalysisApi } from '@/lib/api/technical-analysis';
import type { IndicatorResult, RegimeSegment, RegimeType } from '@/lib/api/technical-analysis';
import type { RegimeSegmentData } from '@/components/charts/useRegimeOverlay';
import { toChartUnixSeconds } from '@/lib/chart-time';
import { buildIndicatorPresetOptions, serializeIndicatorKey } from '@/lib/technical-analysis/chart-model';
import type { OHLCVBar } from '@/lib/types/market-data';
import { DEFAULT_RANGE_DAYS, DEFAULT_SYMBOL } from '../constants';

type SupportedIndicators = Awaited<ReturnType<typeof technicalAnalysisApi.getSupportedIndicators>>['indicators'];

interface LoadedRequest {
  symbol: string;
  startDate: string;
  endDate: string;
}

interface LoadDataOptions {
  days?: number;
  symbolOverride?: string;
}

function getExactSymbolDisplayName(symbol: string, candidates: Array<{ symbol: string; name: string }>): string | null {
  const match = candidates.find((candidate) => candidate.symbol.toUpperCase() === symbol);
  return match?.name ?? null;
}

function formatDate(value: Date) {
  return value.toISOString().split('T')[0];
}

function buildDateRange(days: number) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  endDate.setDate(endDate.getDate() - 1);

  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
  };
}

function emptySet<T>() {
  return new Set<T>();
}

export function useTechnicalAnalysisChart() {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [rangeDays, setRangeDays] = useState(DEFAULT_RANGE_DAYS);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<OHLCVBar[]>([]);
  const [symbolDisplayName, setSymbolDisplayName] = useState<string | null>(null);
  const [indicatorResults, setIndicatorResults] = useState<IndicatorResult[]>([]);
  const [supportedIndicators, setSupportedIndicators] = useState<SupportedIndicators>([]);
  const [supportedIndicatorsReady, setSupportedIndicatorsReady] = useState(false);
  const [enabledIndicatorIds, setEnabledIndicatorIds] = useState<Set<string>>(emptySet());
  const [loadingIndicatorIds, setLoadingIndicatorIds] = useState<Set<string>>(emptySet());
  const [loadedRequest, setLoadedRequest] = useState<LoadedRequest | null>(null);
  const [regimeType, setRegimeType] = useState<RegimeType | null>(null);
  const [regimeSegments, setRegimeSegments] = useState<RegimeSegmentData[]>([]);
  const [regimeLoading, setRegimeLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const regimeRequestRef = useRef<string | null>(null);
  const chartRequestVersionRef = useRef(0);

  const indicatorOptions = useMemo(() => buildIndicatorPresetOptions(supportedIndicators), [supportedIndicators]);

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
  const activeOverlayLegend = useMemo(
    () => groupedOptions.overlay.filter((option) => enabledIndicatorIds.has(option.id)),
    [enabledIndicatorIds, groupedOptions.overlay]
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
    async ({ days = rangeDays, symbolOverride }: LoadDataOptions = {}) => {
      if (indicatorOptions.length === 0) {
        setError('No chartable indicators are configured');
        return;
      }

      const normalizedSymbol = (symbolOverride ?? symbol).trim().toUpperCase();
      if (!normalizedSymbol) {
        setError('Enter a symbol to load a chart');
        return;
      }

      const requestVersion = ++chartRequestVersionRef.current;
      const dateRange = buildDateRange(days);
      const isSymbolChange = loadedRequest?.symbol !== normalizedSymbol;

      // Only fetch indicators when the symbol changes; range changes reuse cached results.
      const selectedIndicatorRequests = isSymbolChange
        ? indicatorOptions
            .filter((option) => enabledIndicatorIds.has(option.id))
            .map(({ name, params }) => ({ name, params }))
        : [];
      const symbolSearchRequest = isSymbolChange
        ? marketDataApi.searchSymbols(normalizedSymbol).catch(() => ({ symbols: [] }))
        : Promise.resolve(null);

      setError(null);
      setSymbol(normalizedSymbol);
      startTransition(async () => {
        setLoadingIndicatorIds(emptySet());

        try {
          const [marketData, indicatorResult, symbolSearchResult] = await Promise.all([
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
                  indicators: selectedIndicatorRequests,
                })
              : Promise.resolve({
                  symbol: normalizedSymbol,
                  timeframe: '1d',
                  indicators: [],
                }),
            symbolSearchRequest,
          ]);

          if (requestVersion !== chartRequestVersionRef.current) {
            return;
          }

          if (marketData.length > 0 && marketData[0].bars.length > 0) {
            setChartData(marketData[0].bars);
            if (symbolSearchResult) {
              setSymbolDisplayName(getExactSymbolDisplayName(normalizedSymbol, symbolSearchResult.symbols));
            }
            if (isSymbolChange) {
              setIndicatorResults(indicatorResult.indicators);
            }
            setLoadedRequest({
              symbol: normalizedSymbol,
              startDate: dateRange.startDate,
              endDate: dateRange.endDate,
            });
            return;
          }

          setError('No data available for this symbol');
          setChartData([]);
          setSymbolDisplayName(null);
          setIndicatorResults([]);
          setLoadedRequest(null);
        } catch (err: any) {
          if (requestVersion !== chartRequestVersionRef.current) {
            return;
          }

          setError(err.message || 'Failed to load data');
        }
      });
    },
    [enabledIndicatorIds, indicatorOptions, loadedRequest?.symbol, rangeDays, symbol]
  );

  const selectRange = useCallback(
    async (days: number) => {
      setRangeDays(days);
      await loadData({ days });
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

  useEffect(() => {
    setRegimeSegments([]);
    regimeRequestRef.current = null;
  }, [loadedRequest?.symbol]);

  const fetchRegimes = useCallback(
    async (type: RegimeType) => {
      if (!loadedRequest) return;

      const cacheKey = `${loadedRequest.symbol}:${type}`;
      if (regimeRequestRef.current === cacheKey) return;

      setRegimeLoading(true);
      try {
        const response = await technicalAnalysisApi.detectRegimes({
          symbol: loadedRequest.symbol,
          timeframe: '1d',
          regime_type: type,
        });

        regimeRequestRef.current = cacheKey;
        setRegimeSegments(
          response.segments.map((seg: RegimeSegment) => ({
            start: toChartUnixSeconds(seg.start),
            end: toChartUnixSeconds(seg.end),
            regime: seg.regime,
          }))
        );
      } catch {
        setRegimeType(null);
      } finally {
        setRegimeLoading(false);
      }
    },
    [loadedRequest]
  );

  const selectRegimeType = useCallback((type: RegimeType | null) => {
    setRegimeType(type);
    if (!type) {
      setRegimeSegments([]);
    }
  }, []);

  useEffect(() => {
    if (regimeType) {
      void fetchRegimes(regimeType);
    }
  }, [fetchRegimes, regimeType]);

  const clear = useCallback(() => {
    chartRequestVersionRef.current += 1;
    setSymbol(DEFAULT_SYMBOL);
    setRangeDays(DEFAULT_RANGE_DAYS);
    setError(null);
    setChartData([]);
    setSymbolDisplayName(null);
    setIndicatorResults([]);
    setEnabledIndicatorIds(emptySet());
    setLoadingIndicatorIds(emptySet());
    setLoadedRequest(null);
    setRegimeType(null);
    setRegimeSegments([]);
    regimeRequestRef.current = null;
  }, []);

  return {
    symbol,
    rangeDays,
    loading: isPending,
    error,
    chartData,
    symbolDisplayName,
    indicatorResults,
    indicatorOptions,
    supportedIndicators,
    enabledIndicatorIds,
    loadingIndicatorIds,
    loadedRequest,
    overlayOptions: groupedOptions.overlay,
    oscillatorOptions: groupedOptions.oscillator,
    otherOptions: groupedOptions.other,
    activeOverlayLegend,
    loadDisabled: isPending || !supportedIndicatorsReady || indicatorOptions.length === 0,
    regimeType,
    regimeSegments,
    regimeLoading,
    setSymbol,
    loadData,
    clear,
    selectRange,
    toggleIndicator,
    selectRegimeType,
  };
}
