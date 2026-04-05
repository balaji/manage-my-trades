'use client';

import { PriceChart } from '@/components/charts/PriceChart';
import { IndicatorToolbar } from './components/IndicatorToolbar';
import { TechnicalAnalysisControls } from './components/TechnicalAnalysisControls';
import { useTechnicalAnalysisChart } from './hooks/useTechnicalAnalysisChart';

export default function TechnicalAnalysisPage() {
  const {
    symbol,
    rangeDays,
    loading,
    error,
    chartData,
    enabledIndicatorIds,
    loadingIndicatorIds,
    overlayOptions,
    oscillatorOptions,
    otherOptions,
    activeOverlayLegend,
    activeOverlaySeries,
    activeOscillatorSeries,
    loadDisabled,
    hasChartData,
    timeRange,
    setSymbol,
    loadData,
    clear,
    selectRange,
    toggleIndicator,
  } = useTechnicalAnalysisChart();

  return (
    <div className="flex min-h-0 flex-col overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-4">
        <TechnicalAnalysisControls
          symbol={symbol}
          rangeDays={rangeDays}
          loading={loading}
          loadDisabled={loadDisabled}
          onSymbolChange={setSymbol}
          onLoad={loadData}
          onClear={clear}
          onRangeChange={selectRange}
        />

        {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>}

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
          />
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {hasChartData ? (
          <PriceChart
            data={chartData}
            indicators={activeOverlaySeries}
            oscillators={activeOscillatorSeries}
            timeRange={timeRange}
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
