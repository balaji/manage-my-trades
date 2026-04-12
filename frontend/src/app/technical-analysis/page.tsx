'use client';

import { PriceChart } from '@/components/charts/PriceChart';
import { IndicatorToolbar } from './components/IndicatorToolbar';
import { TechnicalAnalysisControls } from './components/TechnicalAnalysisControls';
import { useTechnicalAnalysisChart } from './hooks/useTechnicalAnalysisChart';
import { useTechnicalAnalysisPriceChart } from './hooks/useTechnicalAnalysisPriceChart';

export default function TechnicalAnalysisPage() {
  const {
    symbol,
    rangeDays,
    loading,
    error,
    chartData,
    symbolDisplayName,
    indicatorResults,
    indicatorOptions,
    supportedIndicators,
    enabledIndicatorIds,
    loadingIndicatorIds,
    loadedRequest,
    overlayOptions,
    oscillatorOptions,
    otherOptions,
    activeOverlayLegend,
    loadDisabled,
    regimeType,
    regimeSegments,
    regimeLoading,
    setSymbol,
    loadData,
    clear,
    selectRange,
    toggleIndicator,
    selectRegimeType,
  } = useTechnicalAnalysisChart();

  const { hasChartData, priceChartProps } = useTechnicalAnalysisPriceChart({
    chartData,
    symbolDisplayName,
    indicatorResults,
    indicatorOptions,
    supportedIndicators,
    enabledIndicatorIds,
    loadedRequest,
    regimeType,
    regimeSegments,
  });

  return (
    <div className="flex min-h-0 flex-col overflow-hidden">
      <div className="relative z-10 border-b border-slate-200 px-5 py-4">
        <TechnicalAnalysisControls
          symbol={symbol}
          rangeDays={rangeDays}
          loading={loading}
          loadDisabled={loadDisabled}
          onSymbolChange={setSymbol}
          onLoad={(symbolOverride) => loadData({ symbolOverride })}
          onClear={clear}
          onRangeChange={selectRange}
        />

        {error && (
          <div aria-live="polite" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
            {error}
          </div>
        )}

        {hasChartData && (
          <IndicatorToolbar
            overlayOptions={overlayOptions}
            oscillatorOptions={oscillatorOptions}
            otherOptions={otherOptions}
            activeOverlayLegend={activeOverlayLegend}
            enabledIndicatorIds={enabledIndicatorIds}
            loadingIndicatorIds={loadingIndicatorIds}
            loading={loading}
            onSelect={toggleIndicator}
            regimeType={regimeType}
            onRegimeTypeChange={selectRegimeType}
            regimeLoading={regimeLoading}
          />
        )}
      </div>

      <div className="relative z-0 min-h-0 flex-1 overflow-y-auto">
        {hasChartData ? (
          <PriceChart {...priceChartProps} />
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
