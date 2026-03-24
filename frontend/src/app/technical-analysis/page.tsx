'use client';

/**
 * Technical Analysis page.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { IChartApi, LineStyle } from 'lightweight-charts';
import { PriceChart } from '@/components/charts/PriceChart';
import { marketDataApi, technicalAnalysisApi } from '@/lib/api';
import type { OHLCVBar } from '@/lib/types/market-data';

const RANGES = [
  { label: '90 days', days: 90 },
  { label: '6 months', days: 180 },
  { label: '1 year', days: 365 },
  { label: '3 years', days: 1095 },
  { label: '10 years', days: 3650 },
];

const SMA_COLORS: Record<number, string> = {
  10: '#2196F3',
  20: '#9C27B0',
  30: '#FF5722',
};
const EMA_COLORS: Record<number, string> = {
  10: '#00BCD4',
  20: '#8BC34A',
  30: '#FF9800',
};
const BBAND_COLOR = '#607D8B';

type DataPoint = { timestamp: string; value: number };
type Indicator = {
  name: string;
  data: DataPoint[];
  color: string;
  lineStyle?: LineStyle;
  lineWidth?: number;
};

export default function TechnicalAnalysisPage() {
  const [symbol, setSymbol] = useState('SPY');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<OHLCVBar[]>([]);

  // SMA / EMA toggleable indicators
  const [allIndicators, setAllIndicators] = useState<Indicator[]>([]);
  const [enabledIndicators, setEnabledIndicators] = useState<Set<string>>(new Set(['SMA 10']));
  const [showBBands, setShowBBands] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Bollinger Bands (always shown when data is loaded)
  const [bbandIndicators, setBbandIndicators] = useState<Indicator[]>([]);

  // Oscillator data
  const [rsiData, setRsiData] = useState<DataPoint[]>([]);

  const [rangeDays, setRangeDays] = useState(90);

  const priceChartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLoadData = async (days: number = rangeDays) => {
    setLoading(true);
    setError(null);

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      endDate.setDate(endDate.getDate() - 1);

      const indicatorStartDate = new Date(startDate);
      indicatorStartDate.setDate(indicatorStartDate.getDate() - 30);
      const startDateStr = startDate.toISOString().split('T')[0];

      const [marketData, indicatorResult] = await Promise.all([
        marketDataApi.getBars({
          symbols: [symbol],
          start_date: startDateStr,
          end_date: endDate.toISOString().split('T')[0],
          timeframe: '1d',
        }),
        technicalAnalysisApi.calculateIndicators({
          symbol,
          timeframe: '1d',
          start_date: indicatorStartDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          indicators: [
            { name: 'SMA', params: { timeperiod: 10 } },
            { name: 'SMA', params: { timeperiod: 20 } },
            { name: 'SMA', params: { timeperiod: 30 } },
            { name: 'EMA', params: { timeperiod: 10 } },
            { name: 'EMA', params: { timeperiod: 20 } },
            { name: 'EMA', params: { timeperiod: 30 } },
            { name: 'RSI', params: { timeperiod: 14 } },
            { name: 'BBANDS', params: { timeperiod: 20, nbdevup: 2, nbdevdn: 2 } },
          ],
        }),
      ]);

      if (marketData.length > 0 && marketData[0].bars.length > 0) {
        setChartData(marketData[0].bars);
        const results = indicatorResult.indicators.map((indicator) => ({
          ...indicator,
          outputs: Object.fromEntries(
            Object.entries(indicator.outputs).map(([outputName, values]) => [
              outputName,
              values.filter((value) => value.timestamp >= startDateStr),
            ])
          ),
        }));

        const rsiResult = results.find((result) => result.name === 'RSI');
        setRsiData(rsiResult?.outputs.real ?? []);

        const bbResult = results.find((result) => result.name === 'BBANDS');
        if (bbResult?.outputs) {
          const outputs = bbResult.outputs;
          const pick = (key: string): DataPoint[] => outputs[key] ?? [];

          setBbandIndicators([
            {
              name: 'BB Upper',
              data: pick('upperband'),
              color: BBAND_COLOR,
              lineStyle: LineStyle.Dashed,
              lineWidth: 1,
            },
            {
              name: 'BB Middle',
              data: pick('middleband'),
              color: BBAND_COLOR,
              lineStyle: LineStyle.Solid,
              lineWidth: 1,
            },
            {
              name: 'BB Lower',
              data: pick('lowerband'),
              color: BBAND_COLOR,
              lineStyle: LineStyle.Dashed,
              lineWidth: 1,
            },
          ]);
        } else {
          setBbandIndicators([]);
        }

        const getByName = (name: string) =>
          results
            .filter((result) => result.name === name)
            .map((result) => {
              const period = result.params.timeperiod as number;
              const colors = name === 'SMA' ? SMA_COLORS : EMA_COLORS;
              return {
                name: `${name} ${period}`,
                data: result.outputs.real ?? [],
                color: colors[period] ?? '#2196F3',
              };
            });

        setAllIndicators([...getByName('SMA'), ...getByName('EMA')]);
      } else {
        setError('No data available for this symbol');
        setAllIndicators([]);
        setBbandIndicators([]);
        setRsiData([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const toggleIndicator = (name: string) => {
    setEnabledIndicators((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const handlePriceChartReady = useCallback((chart: IChartApi) => {
    priceChartRef.current = chart;
  }, []);

  useEffect(() => {
    if (chartData.length === 0) return;
    const id = requestAnimationFrame(() => {
      priceChartRef.current?.timeScale().fitContent();
    });
    return () => cancelAnimationFrame(id);
  }, [chartData]);

  const smaGroup = allIndicators.filter((i) => i.name.startsWith('SMA'));
  const emaGroup = allIndicators.filter((i) => i.name.startsWith('EMA'));
  const activeIndicators = useMemo(
    () => [...allIndicators.filter((i) => enabledIndicators.has(i.name)), ...(showBBands ? bbandIndicators : [])],
    [allIndicators, enabledIndicators, showBBands, bbandIndicators]
  );

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <Link href="/" className="text-blue-600 hover:underline text-sm">
          ← Home
        </Link>
        <h1 className="text-3xl font-bold mb-8 mt-1">Technical Analysis</h1>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">Symbol</label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && !loading && handleLoadData(rangeDays)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter symbol (e.g., SPY)"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => handleLoadData(rangeDays)}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Load Chart'}
              </button>
            </div>
          </div>

          {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>}

          {chartData.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">{symbol} - Daily Chart</h2>
                <div className="flex items-center gap-3">
                  {RANGES.map(({ label, days }) => (
                    <button
                      key={days}
                      onClick={() => {
                        setRangeDays(days);
                        handleLoadData(days);
                      }}
                      disabled={loading}
                      className={`text-sm px-3 py-1 rounded ${rangeDays === days ? 'bg-blue-600 text-white' : 'text-blue-600 hover:underline'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toolbar: Technicals dropdown + active legend */}
              <div className="flex items-center gap-4 mb-3">
                {allIndicators.length > 0 && (
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setDropdownOpen((o) => !o)}
                      className="flex items-center gap-1.5 text-sm px-3 py-1.5 border rounded-lg hover:bg-gray-50"
                    >
                      Technicals
                      <svg
                        className={`w-3.5 h-3.5 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {dropdownOpen && (
                      <div className="absolute left-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-10 min-w-[150px]">
                        <div className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                          SMA
                        </div>
                        {smaGroup.map(({ name, color }) => (
                          <label
                            key={name}
                            className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer select-none"
                          >
                            <input
                              type="checkbox"
                              checked={enabledIndicators.has(name)}
                              onChange={() => toggleIndicator(name)}
                              className="w-4 h-4"
                              style={{ accentColor: color }}
                            />
                            <span className="inline-block w-5 h-0.5 rounded" style={{ backgroundColor: color }} />
                            <span className="text-sm">{name}</span>
                          </label>
                        ))}
                        <div className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide border-t mt-1">
                          EMA
                        </div>
                        {emaGroup.map(({ name, color }) => (
                          <label
                            key={name}
                            className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer select-none"
                          >
                            <input
                              type="checkbox"
                              checked={enabledIndicators.has(name)}
                              onChange={() => toggleIndicator(name)}
                              className="w-4 h-4"
                              style={{ accentColor: color }}
                            />
                            <span className="inline-block w-5 h-0.5 rounded" style={{ backgroundColor: color }} />
                            <span className="text-sm">{name}</span>
                          </label>
                        ))}
                        <div className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide border-t mt-1">
                          Bollinger Bands
                        </div>
                        <label className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={showBBands}
                            onChange={(e) => setShowBBands(e.target.checked)}
                            className="w-4 h-4"
                            style={{ accentColor: BBAND_COLOR }}
                          />
                          <span className="inline-block w-5 h-0.5 rounded" style={{ backgroundColor: BBAND_COLOR }} />
                          <span className="text-sm">BB (20, 2)</span>
                        </label>
                      </div>
                    )}
                  </div>
                )}

                {/* Active SMA/EMA legend */}
                {allIndicators
                  .filter((i) => enabledIndicators.has(i.name))
                  .map(({ name, color }) => (
                    <span key={name} className="flex items-center gap-1.5 text-sm">
                      <span className="inline-block w-6 h-0.5 rounded" style={{ backgroundColor: color }} />
                      {name}
                    </span>
                  ))}

                {/* BBands legend */}
                {showBBands && bbandIndicators.length > 0 && (
                  <span className="flex items-center gap-1.5 text-sm">
                    <span className="inline-block w-6 h-0.5 rounded" style={{ backgroundColor: BBAND_COLOR }} />
                    BB (20, 2)
                  </span>
                )}
              </div>

              {/* Price chart with RSI sub-pane */}
              <PriceChart
                data={chartData}
                indicators={activeIndicators}
                oscillators={
                  rsiData.length > 0
                    ? [
                        {
                          name: 'RSI 14',
                          data: rsiData,
                          color: '#E91E63',
                          referenceLines: [
                            { value: 70, color: '#ef5350' },
                            { value: 30, color: '#26a69a' },
                          ],
                        },
                      ]
                    : []
                }
                height={500}
                onChartReady={handlePriceChartReady}
              />
            </div>
          )}

          {!loading && chartData.length === 0 && !error && (
            <div className="text-center py-12 text-gray-500">
              <p>Enter a symbol and click &quot;Load Chart&quot; to view technical analysis</p>
              <p className="text-sm mt-2">Popular ETFs: SPY, QQQ, IWM, DIA, GLD</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
