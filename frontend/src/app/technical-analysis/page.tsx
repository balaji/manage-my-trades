'use client';

import React, { useCallback } from 'react';

import { PriceChart } from '@/components/charts/PriceChart';
import { useIndicatorDropdowns } from '@/app/technical-analysis/hooks/useIndicatorDropdowns';
import { useTechnicalAnalysisPage } from '@/app/technical-analysis/hooks/useTechnicalAnalysisPage';

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
  const [filterText, setFilterText] = React.useState('');

  if (options.length === 0) {
    return null;
  }

  const filteredOptions = filterText
    ? options.filter(({ label }) => label.toLowerCase().includes(filterText.toLowerCase()))
    : options;

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
        <div className="absolute left-0 top-full z-10 mt-1 min-w-[260px] rounded-lg border bg-white shadow-lg">
          <div className="border-b px-3 py-2">
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter..."
              className="w-full rounded border border-gray-200 px-2 py-1 text-sm focus:border-sky-400 focus:outline-none"
              autoFocus
            />
          </div>
          <div className="max-h-80 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-400">No matches</div>
            ) : (
              filteredOptions.map(({ id, color, label }) => (
                <label
                  key={id}
                  className="flex cursor-pointer select-none items-center gap-2.5 px-3 py-2 hover:bg-gray-50"
                >
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
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TechnicalAnalysisPage() {
  const {
    symbol,
    setSymbol,
    rangeDays,
    error,
    chartData,
    enabledIndicatorIds,
    loadingIndicatorIds,
    loadedRequest,
    loading,
    indicatorOptions,
    overlayOptions,
    oscillatorOptions,
    otherOptions,
    activeOverlaySeries,
    activeOscillatorSeries,
    activeOverlayLegend,
    loadData,
    toggleIndicator,
    clear,
  } = useTechnicalAnalysisPage();
  const { overlayRef, oscillatorRef, otherRef, openCounts, dropdownState, toggleDropdown, closeAllDropdowns } =
    useIndicatorDropdowns();

  const handleRangeClick = useCallback(
    async (days: number) => {
      await loadData(days);
    },
    [loadData]
  );

  const handleClear = useCallback(() => {
    clear();
    closeAllDropdowns();
  }, [clear, closeAllDropdowns]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 text-slate-900">
      <div className="border-b border-slate-200 bg-white px-5 py-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-56 flex-1">
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && !loading && void loadData(rangeDays)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              placeholder="Enter symbol (e.g., SPY)"
            />
          </div>
          <button
            onClick={() => void loadData(rangeDays)}
            disabled={loading || indicatorOptions.length === 0}
            className="rounded-lg bg-sky-600 px-5 py-2 font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? 'Loading...' : 'Load Chart'}
          </button>
          <button
            onClick={handleClear}
            disabled={loading}
            className="rounded-lg border border-slate-300 px-5 py-2 font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear
          </button>
          <div className="flex flex-wrap items-center gap-2">
            {RANGES.map(({ label, days }) => (
              <button
                key={days}
                onClick={() => void handleRangeClick(days)}
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
              <div ref={overlayRef}>
                <IndicatorDropdown
                  key={openCounts.overlay}
                  buttonLabel="Technicals"
                  open={dropdownState.overlay}
                  onToggle={() => toggleDropdown('overlay')}
                  options={overlayOptions}
                  enabledIndicatorIds={enabledIndicatorIds}
                  loadingIndicatorIds={loadingIndicatorIds}
                  loading={loading}
                  onSelect={toggleIndicator}
                />
              </div>
            )}

            {oscillatorOptions.length > 0 && (
              <div ref={oscillatorRef}>
                <IndicatorDropdown
                  key={openCounts.oscillator}
                  buttonLabel="Oscillators"
                  open={dropdownState.oscillator}
                  onToggle={() => toggleDropdown('oscillator')}
                  options={oscillatorOptions}
                  enabledIndicatorIds={enabledIndicatorIds}
                  loadingIndicatorIds={loadingIndicatorIds}
                  loading={loading}
                  onSelect={toggleIndicator}
                />
              </div>
            )}

            {otherOptions.length > 0 && (
              <div ref={otherRef}>
                <IndicatorDropdown
                  key={openCounts.other}
                  buttonLabel="Others"
                  open={dropdownState.other}
                  onToggle={() => toggleDropdown('other')}
                  options={otherOptions}
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
