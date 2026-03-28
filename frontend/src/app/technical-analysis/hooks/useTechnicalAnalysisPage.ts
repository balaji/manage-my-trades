import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';

import { marketDataApi, technicalAnalysisApi } from '@/lib/api';
import type { IndicatorConfig, IndicatorResult, SupportedIndicator } from '@/lib/api/technical-analysis';
import {
  buildChartSeries,
  buildIndicatorPresetOptions,
  serializeIndicatorKey,
} from '@/lib/technical-analysis/chart-model';
import type { OHLCVBar } from '@/lib/types/market-data';

export interface LoadedChartRequest {
  symbol: string;
  startDate: string;
  indicatorStartDate: string;
  endDate: string;
}

interface ChartLoadPayload {
  chartData: OHLCVBar[];
  indicatorResults: IndicatorResult[];
  request: LoadedChartRequest;
  queryKeyString: string;
}

function formatDate(date: Date) {
  return date.toISOString().split('T')[0];
}

function buildRequestWindow(symbol: string, days: number): LoadedChartRequest {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  endDate.setDate(endDate.getDate() - 1);

  const indicatorStartDate = new Date(startDate);
  indicatorStartDate.setDate(indicatorStartDate.getDate() - 30);

  return {
    symbol,
    startDate: formatDate(startDate),
    indicatorStartDate: formatDate(indicatorStartDate),
    endDate: formatDate(endDate),
  };
}

function createChartQueryKey(request: LoadedChartRequest, indicatorIds: string[]) {
  return ['technical-analysis', 'chart', request.symbol, request.startDate, request.endDate, ...indicatorIds] as const;
}

function createIndicatorQueryKey(request: LoadedChartRequest, indicatorId: string) {
  return [
    'technical-analysis',
    'indicator',
    request.symbol,
    request.indicatorStartDate,
    request.endDate,
    indicatorId,
  ] as const;
}

function filterSelectedIndicatorRequests(
  enabledIndicatorIds: Set<string>,
  indicatorOptions: ReturnType<typeof buildIndicatorPresetOptions>
): IndicatorConfig[] {
  return indicatorOptions
    .filter((option) => enabledIndicatorIds.has(option.id))
    .map(({ name, params }) => ({ name, params }));
}

function findIndicatorOption(indicatorId: string, indicatorOptions: ReturnType<typeof buildIndicatorPresetOptions>) {
  return indicatorOptions.find((candidate) => candidate.id === indicatorId);
}

export function useTechnicalAnalysisPage() {
  const queryClient = useQueryClient();
  const latestChartQueryKeyRef = useRef<string | null>(null);

  const [symbol, setSymbol] = useState('SPY');
  const [rangeDays, setRangeDays] = useState(90);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<OHLCVBar[]>([]);
  const [indicatorResults, setIndicatorResults] = useState<IndicatorResult[]>([]);
  const [enabledIndicatorIds, setEnabledIndicatorIds] = useState<Set<string>>(new Set());
  const [loadedRequest, setLoadedRequest] = useState<LoadedChartRequest | null>(null);
  const [loadingIndicatorIds, setLoadingIndicatorIds] = useState<Set<string>>(new Set());

  const supportedIndicatorsQuery = useQuery({
    queryKey: ['technical-analysis', 'supported-indicators'],
    queryFn: () => technicalAnalysisApi.getSupportedIndicators(),
  });

  const supportedIndicators = useMemo(
    () => supportedIndicatorsQuery.data?.indicators ?? [],
    [supportedIndicatorsQuery.data]
  );
  const supportedIndicatorsError =
    supportedIndicatorsQuery.error instanceof Error
      ? supportedIndicatorsQuery.error.message
      : 'Failed to load supported indicators';

  const indicatorOptions = useMemo(() => buildIndicatorPresetOptions(supportedIndicators), [supportedIndicators]);
  const overlayOptions = useMemo(
    () => indicatorOptions.filter((option) => option.pane === 'overlay'),
    [indicatorOptions]
  );
  const oscillatorOptions = useMemo(
    () => indicatorOptions.filter((option) => option.pane === 'oscillator'),
    [indicatorOptions]
  );
  const otherOptions = useMemo(() => indicatorOptions.filter((option) => option.pane === 'other'), [indicatorOptions]);

  const chartMutation = useMutation({
    mutationFn: async ({
      symbol,
      days,
      selectedIndicators,
    }: {
      symbol: string;
      days: number;
      selectedIndicators: IndicatorConfig[];
    }) => {
      const request = buildRequestWindow(symbol, days);
      const selectedIndicatorIds = selectedIndicators.map(({ name, params }) =>
        serializeIndicatorKey(name, params ?? {})
      );
      const queryKey = createChartQueryKey(request, selectedIndicatorIds);
      const queryKeyString = JSON.stringify(queryKey);

      return queryClient.fetchQuery({
        queryKey,
        queryFn: async (): Promise<ChartLoadPayload> => {
          const [marketData, indicatorResponse] = await Promise.all([
            marketDataApi.getBars({
              symbols: [symbol],
              start_date: request.startDate,
              end_date: request.endDate,
              timeframe: '1d',
            }),
            selectedIndicators.length > 0
              ? technicalAnalysisApi.calculateIndicators({
                  symbol,
                  timeframe: '1d',
                  start_date: request.indicatorStartDate,
                  end_date: request.endDate,
                  indicators: selectedIndicators,
                })
              : Promise.resolve({
                  symbol,
                  timeframe: '1d',
                  indicators: [],
                }),
          ]);

          if (marketData.length === 0 || marketData[0].bars.length === 0) {
            throw new Error('No data available for this symbol');
          }

          return {
            chartData: marketData[0].bars,
            indicatorResults: indicatorResponse.indicators,
            request,
            queryKeyString,
          };
        },
      });
    },
    onMutate: ({ symbol, days, selectedIndicators }) => {
      setError(null);
      setLoadingIndicatorIds(new Set());
      const request = buildRequestWindow(symbol, days);
      const selectedIndicatorIds = selectedIndicators.map(({ name, params }) =>
        serializeIndicatorKey(name, params ?? {})
      );
      latestChartQueryKeyRef.current = JSON.stringify(createChartQueryKey(request, selectedIndicatorIds));
    },
    onSuccess: (payload) => {
      if (payload.queryKeyString !== latestChartQueryKeyRef.current) {
        return;
      }

      setChartData(payload.chartData);
      setIndicatorResults(payload.indicatorResults);
      setLoadedRequest(payload.request);
    },
    onError: (mutationError, variables) => {
      const request = buildRequestWindow(variables.symbol, variables.days);
      const selectedIndicatorIds = variables.selectedIndicators.map(({ name, params }) =>
        serializeIndicatorKey(name, params ?? {})
      );
      if (JSON.stringify(createChartQueryKey(request, selectedIndicatorIds)) !== latestChartQueryKeyRef.current) {
        return;
      }

      setChartData([]);
      setIndicatorResults([]);
      setLoadedRequest(null);
      setError(mutationError instanceof Error ? mutationError.message : 'Failed to load data');
    },
  });

  const indicatorMutation = useMutation({
    mutationFn: async ({ request, indicatorId }: { request: LoadedChartRequest; indicatorId: string }) => {
      const option = findIndicatorOption(indicatorId, indicatorOptions);
      if (!option) {
        throw new Error('Indicator configuration not found');
      }

      return queryClient.fetchQuery({
        queryKey: createIndicatorQueryKey(request, indicatorId),
        queryFn: async () => {
          const response = await technicalAnalysisApi.calculateIndicators({
            symbol: request.symbol,
            timeframe: '1d',
            start_date: request.indicatorStartDate,
            end_date: request.endDate,
            indicators: [{ name: option.name, params: option.params }],
          });

          return {
            indicatorId,
            indicatorName: option.displayName,
            result: response.indicators,
            request,
          };
        },
      });
    },
    onMutate: ({ indicatorId }) => {
      setError(null);
      setLoadingIndicatorIds((prev) => new Set(prev).add(indicatorId));
    },
    onSuccess: ({ indicatorId, result, request }) => {
      if (
        !loadedRequest ||
        loadedRequest.symbol !== request.symbol ||
        loadedRequest.indicatorStartDate !== request.indicatorStartDate ||
        loadedRequest.endDate !== request.endDate
      ) {
        return;
      }

      setIndicatorResults((prev) => [
        ...prev.filter((item) => serializeIndicatorKey(item.name, item.params ?? {}) !== indicatorId),
        ...result,
      ]);
    },
    onError: (mutationError, variables) => {
      setEnabledIndicatorIds((prev) => {
        const next = new Set(prev);
        next.delete(variables.indicatorId);
        return next;
      });

      setError(
        mutationError instanceof Error
          ? mutationError.message
          : `Failed to load ${findIndicatorOption(variables.indicatorId, indicatorOptions)?.displayName ?? 'indicator'}`
      );
    },
    onSettled: (_data, _error, variables) => {
      setLoadingIndicatorIds((prev) => {
        const next = new Set(prev);
        next.delete(variables.indicatorId);
        return next;
      });
    },
  });

  const loadData = useCallback(
    async (days: number = rangeDays) => {
      if (indicatorOptions.length === 0) {
        setError(
          supportedIndicators.length === 0 ? supportedIndicatorsError : 'No chartable indicators are configured'
        );
        return;
      }

      setRangeDays(days);

      await chartMutation.mutateAsync({
        symbol,
        days,
        selectedIndicators: filterSelectedIndicatorRequests(enabledIndicatorIds, indicatorOptions),
      });
    },
    [
      chartMutation,
      enabledIndicatorIds,
      indicatorOptions,
      rangeDays,
      supportedIndicators.length,
      supportedIndicatorsError,
      symbol,
    ]
  );

  const toggleIndicator = useCallback(
    async (indicatorId: string) => {
      const nextEnabledIndicatorIds = new Set(enabledIndicatorIds);
      const isEnabled = nextEnabledIndicatorIds.has(indicatorId);

      if (isEnabled) {
        nextEnabledIndicatorIds.delete(indicatorId);
        setEnabledIndicatorIds(nextEnabledIndicatorIds);
        setIndicatorResults((prev) =>
          prev.filter((item) => serializeIndicatorKey(item.name, item.params ?? {}) !== indicatorId)
        );
        return;
      }

      nextEnabledIndicatorIds.add(indicatorId);
      setEnabledIndicatorIds(nextEnabledIndicatorIds);

      if (!loadedRequest) {
        return;
      }

      await indicatorMutation.mutateAsync({
        request: loadedRequest,
        indicatorId,
      });
    },
    [enabledIndicatorIds, indicatorMutation, loadedRequest]
  );

  const clear = useCallback(() => {
    setError(null);
    setChartData([]);
    setIndicatorResults([]);
    setEnabledIndicatorIds(new Set());
    setLoadedRequest(null);
    setLoadingIndicatorIds(new Set());
  }, []);

  const { overlays: activeOverlaySeries, oscillators: activeOscillatorSeries } = useMemo(
    () => buildChartSeries(indicatorResults, supportedIndicators, indicatorOptions, loadedRequest?.startDate),
    [indicatorResults, supportedIndicators, indicatorOptions, loadedRequest]
  );

  const activeOverlayLegend = useMemo(() => {
    const seenIds = new Set<string>();
    return activeOverlaySeries
      .filter((s) => {
        if (seenIds.has(s.selectionId)) return false;
        seenIds.add(s.selectionId);
        return true;
      })
      .map((s) => {
        const option = indicatorOptions.find((opt) => opt.id === s.selectionId);
        return { id: s.selectionId, color: s.color, label: option?.label ?? s.name };
      });
  }, [activeOverlaySeries, indicatorOptions]);

  return {
    symbol,
    setSymbol,
    rangeDays,
    error,
    chartData,
    indicatorResults,
    enabledIndicatorIds,
    loadingIndicatorIds,
    loadedRequest,
    loading: chartMutation.isPending || indicatorMutation.isPending || supportedIndicatorsQuery.isLoading,
    indicatorOptions,
    overlayOptions,
    oscillatorOptions,
    otherOptions,
    activeOverlaySeries,
    activeOscillatorSeries,
    activeOverlayLegend,
    supportedIndicators,
    supportedIndicatorsError,
    loadData,
    toggleIndicator,
    clear,
  };
}
