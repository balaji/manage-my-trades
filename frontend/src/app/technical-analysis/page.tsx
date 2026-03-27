'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IChartApi } from 'lightweight-charts';
import { PriceChart } from '@/components/charts/PriceChart';
import { marketDataApi, technicalAnalysisApi } from '@/lib/api';
import type { OHLCVBar } from '@/lib/types/market-data';
import type { IndicatorResult } from '@/lib/api/technical-analysis';
import {
  buildChartSeries,
  buildIndicatorPresetOptions,
  serializeIndicatorKey,
} from '@/lib/technical-analysis/chart-model';

const RANGES = [
  { label: '90 days', days: 90 },
  { label: '6 months', days: 180 },
  { label: '1 year', days: 365 },
  { label: '3 years', days: 1095 },
  { label: '10 years', days: 3650 },
];

interface IndicatorDropdownProps {
  buttonLabel: string;
  open: boolean;
  onToggle: () => void;
  options: Array<{ id: string; color: string; label: string }>;
  enabledIndicatorIds: Set<string>;
  loadingIndicatorIds: Set<string>;
  loading: boolean;
  onSelect: (id: string) => void | Promise<void>;
}

function IndicatorDropdown({
  buttonLabel,
  open,
  onToggle,
  options,
  enabledIndicatorIds,
  loadingIndicatorIds,
  loading,
  onSelect,
}: IndicatorDropdownProps) {
  if (options.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
      >
        {buttonLabel}
        <svg
          className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 max-h-96 min-w-[260px] overflow-y-auto rounded-lg border bg-white shadow-lg">
          {options.map(({ id, color, label }) => (
            <label key={id} className="flex cursor-pointer select-none items-center gap-2.5 px-3 py-2 hover:bg-gray-50">
              <input
                type="checkbox"
                checked={enabledIndicatorIds.has(id)}
                onChange={() => void onSelect(id)}
                disabled={loadingIndicatorIds.has(id) || loading}
                className="h-4 w-4"
                style={{ accentColor: color }}
              />
              <span className="inline-block h-0.5 w-5 rounded" style={{ backgroundColor: color }} />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TechnicalAnalysisPage() {
  const [symbol, setSymbol] = useState('SPY');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<OHLCVBar[]>([]);
  const [indicatorResults, setIndicatorResults] = useState<IndicatorResult[]>([]);
  const [supportedIndicators, setSupportedIndicators] = useState<
    Awaited<ReturnType<typeof technicalAnalysisApi.getSupportedIndicators>>['indicators']
  >([]);
  const [enabledIndicatorIds, setEnabledIndicatorIds] = useState<Set<string>>(new Set());
  const [overlayDropdownOpen, setOverlayDropdownOpen] = useState(false);
  const [oscillatorDropdownOpen, setOscillatorDropdownOpen] = useState(false);
  const [rangeDays, setRangeDays] = useState(90);
  const [loadedRequest, setLoadedRequest] = useState<{
    symbol: string;
    startDate: string;
    indicatorStartDate: string;
    endDate: string;
  } | null>(null);
  const [loadingIndicatorIds, setLoadingIndicatorIds] = useState<Set<string>>(new Set());

  const overlayDropdownRef = useRef<HTMLDivElement>(null);
  const oscillatorDropdownRef = useRef<HTMLDivElement>(null);
  const priceChartRef = useRef<IChartApi | null>(null);
  const chartRequestVersionRef = useRef(0);

  const indicatorOptions = useMemo(() => buildIndicatorPresetOptions(supportedIndicators), [supportedIndicators]);
  const overlayOptions = useMemo(
    () => indicatorOptions.filter((option) => option.pane === 'overlay'),
    [indicatorOptions]
  );
  const oscillatorOptions = useMemo(
    () => indicatorOptions.filter((option) => option.pane === 'oscillator'),
    [indicatorOptions]
  );
  const chartSeries = useMemo(
    () =>
      buildChartSeries(
        indicatorResults,
        supportedIndicators,
        indicatorOptions.map(({ id, name, params, label, color }) => ({ id, name, params, label, color })),
        loadedRequest?.startDate
      ),
    [indicatorOptions, indicatorResults, loadedRequest?.startDate, supportedIndicators]
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;

      if (overlayDropdownRef.current && !overlayDropdownRef.current.contains(target)) {
        setOverlayDropdownOpen(false);
      }

      if (oscillatorDropdownRef.current && !oscillatorDropdownRef.current.contains(target)) {
        setOscillatorDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadSupportedIndicators = async () => {
      try {
        const response = await technicalAnalysisApi.getSupportedIndicators();
        if (!cancelled) {
          setSupportedIndicators(response.indicators);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Failed to load supported indicators');
        }
      }
    };

    loadSupportedIndicators();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLoadData = useCallback(
    async (days: number = rangeDays) => {
      if (indicatorOptions.length === 0) {
        setError('No chartable indicators are configured');
        return;
      }

      const requestVersion = ++chartRequestVersionRef.current;

      const selectedIndicatorRequests = indicatorOptions
        .filter((option) => enabledIndicatorIds.has(option.id))
        .map(({ name, params }) => ({ name, params }));

      setLoading(true);
      setError(null);
      setLoadingIndicatorIds(new Set());

      try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        endDate.setDate(endDate.getDate() - 1);

        const indicatorStartDate = new Date(startDate);
        indicatorStartDate.setDate(indicatorStartDate.getDate() - 30);
        const startDateStr = startDate.toISOString().split('T')[0];
        const indicatorStartDateStr = indicatorStartDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        const [marketData, indicatorResult] = await Promise.all([
          marketDataApi.getBars({
            symbols: [symbol],
            start_date: startDateStr,
            end_date: endDateStr,
            timeframe: '1d',
          }),
          selectedIndicatorRequests.length > 0
            ? technicalAnalysisApi.calculateIndicators({
                symbol,
                timeframe: '1d',
                start_date: indicatorStartDateStr,
                end_date: endDateStr,
                indicators: selectedIndicatorRequests,
              })
            : Promise.resolve({
                symbol,
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
            symbol,
            startDate: startDateStr,
            indicatorStartDate: indicatorStartDateStr,
            endDate: endDateStr,
          });
        } else {
          setError('No data available for this symbol');
          setChartData([]);
          setIndicatorResults([]);
          setLoadedRequest(null);
        }
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

      const isAlreadyLoaded = indicatorResults.some(
        (result) => serializeIndicatorKey(result.name, result.params ?? {}) === id
      );
      if (isAlreadyLoaded || !loadedRequest) {
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
    [enabledIndicatorIds, indicatorOptions, indicatorResults, loadedRequest]
  );

  const handlePriceChartReady = useCallback((chart: IChartApi) => {
    priceChartRef.current = chart;
  }, []);

  const activeOverlaySeries = useMemo(
    () => chartSeries.overlays.filter((series) => enabledIndicatorIds.has(series.selectionId)),
    [chartSeries.overlays, enabledIndicatorIds]
  );
  const activeOscillatorSeries = useMemo(
    () => chartSeries.oscillators.filter((series) => enabledIndicatorIds.has(series.selectionId)),
    [chartSeries.oscillators, enabledIndicatorIds]
  );
  const activeOverlayLegend = useMemo(
    () => overlayOptions.filter((option) => enabledIndicatorIds.has(option.id)),
    [enabledIndicatorIds, overlayOptions]
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 text-slate-900">
      <div className="border-b border-slate-200 bg-white px-5 py-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-56 flex-1">
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && !loading && handleLoadData(rangeDays)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              placeholder="Enter symbol (e.g., SPY)"
            />
          </div>
          <button
            onClick={() => handleLoadData(rangeDays)}
            disabled={loading || indicatorOptions.length === 0}
            className="rounded-lg bg-sky-600 px-5 py-2 font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? 'Loading...' : 'Load Chart'}
          </button>
          <div className="flex flex-wrap items-center gap-2">
            {RANGES.map(({ label, days }) => (
              <button
                key={days}
                onClick={() => {
                  setRangeDays(days);
                  handleLoadData(days);
                }}
                disabled={loading}
                className={`rounded px-3 py-1 text-sm transition ${
                  rangeDays === days
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>}

        {chartData.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-4">
            {overlayOptions.length > 0 && (
              <div ref={overlayDropdownRef}>
                <IndicatorDropdown
                  buttonLabel="Technicals"
                  open={overlayDropdownOpen}
                  onToggle={() => {
                    setOverlayDropdownOpen((open) => !open);
                    setOscillatorDropdownOpen(false);
                  }}
                  options={overlayOptions}
                  enabledIndicatorIds={enabledIndicatorIds}
                  loadingIndicatorIds={loadingIndicatorIds}
                  loading={loading}
                  onSelect={toggleIndicator}
                />
              </div>
            )}

            {oscillatorOptions.length > 0 && (
              <div ref={oscillatorDropdownRef}>
                <IndicatorDropdown
                  buttonLabel="Oscillators"
                  open={oscillatorDropdownOpen}
                  onToggle={() => {
                    setOscillatorDropdownOpen((open) => !open);
                    setOverlayDropdownOpen(false);
                  }}
                  options={oscillatorOptions}
                  enabledIndicatorIds={enabledIndicatorIds}
                  loadingIndicatorIds={loadingIndicatorIds}
                  loading={loading}
                  onSelect={toggleIndicator}
                />
              </div>
            )}

            {activeOverlayLegend.map(({ id, color, label }) => (
              <span key={id} className="flex items-center gap-1.5 text-sm text-slate-600">
                <span className="inline-block h-0.5 w-6 rounded" style={{ backgroundColor: color }} />
                {label}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {chartData.length > 0 ? (
          <PriceChart
            data={chartData}
            indicators={activeOverlaySeries}
            oscillators={activeOscillatorSeries}
            timeRange={
              loadedRequest
                ? {
                    from: `${loadedRequest.startDate}T00:00:00Z`,
                    to: `${loadedRequest.endDate}T23:59:59Z`,
                  }
                : undefined
            }
            onChartReady={handlePriceChartReady}
          />
        ) : (
          !loading &&
          !error && (
            <div className="flex h-full items-center justify-center px-6 text-center text-slate-500">
              <div>
                <p className="text-lg">Enter a symbol and load a chart</p>
                <p className="mt-2 text-sm">Popular ETFs: SPY, QQQ, IWM, DIA, GLD</p>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
