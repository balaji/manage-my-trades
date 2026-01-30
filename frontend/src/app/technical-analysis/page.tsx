'use client';

/**
 * Technical Analysis page.
 */
import React, { useState } from 'react';
import { PriceChart } from '@/components/charts/PriceChart';
import { marketDataApi, technicalAnalysisApi } from '@/lib/api';
import type { OHLCVBar } from '@/lib/types/market-data';

export default function TechnicalAnalysisPage() {
  const [symbol, setSymbol] = useState('SPY');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<OHLCVBar[]>([]);
  const [indicators, setIndicators] = useState<any[]>([]);

  const handleLoadData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get last 90 days of data
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);

      // Fetch market data
      const marketData = await marketDataApi.getBars({
        symbols: [symbol],
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        timeframe: '1d',
      });

      if (marketData.length > 0 && marketData[0].bars.length > 0) {
        setChartData(marketData[0].bars);

        // Calculate some default indicators
        const indicatorResults = await technicalAnalysisApi.calculateIndicators({
          symbol,
          timeframe: '1d',
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          indicators: [
            { name: 'sma', params: { length: 20 } },
            { name: 'sma', params: { length: 50 } },
            { name: 'rsi', params: { length: 14 } },
          ],
        });

        // Format indicators for chart
        const formattedIndicators = Object.entries(indicatorResults.indicators).map(
          ([key, indicator]: [string, any]) => {
            if (indicator.values) {
              return {
                name: `${indicator.name}(${JSON.stringify(indicator.params)})`,
                data: indicator.values,
                color: indicator.name === 'sma'
                  ? (indicator.params.length === 20 ? '#2196F3' : '#FF9800')
                  : '#9C27B0',
              };
            }
            return null;
          }
        ).filter(Boolean);

        setIndicators(formattedIndicators as any[]);
      } else {
        setError('No data available for this symbol');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Technical Analysis</h1>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">Symbol</label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter symbol (e.g., SPY)"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleLoadData}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Load Chart'}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {chartData.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">{symbol} - Daily Chart</h2>
              <PriceChart data={chartData} indicators={indicators} height={500} />

              <div className="mt-4 flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-blue-500"></div>
                  <span>SMA(20)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-orange-500"></div>
                  <span>SMA(50)</span>
                </div>
              </div>
            </div>
          )}

          {!loading && chartData.length === 0 && !error && (
            <div className="text-center py-12 text-gray-500">
              <p>Enter a symbol and click &quot;Load Chart&quot; to view technical analysis</p>
              <p className="text-sm mt-2">Popular ETFs: SPY, QQQ, IWM, DIA, GLD</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Available Indicators</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Trend</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Simple Moving Average (SMA)</li>
                <li>• Exponential Moving Average (EMA)</li>
              </ul>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Momentum</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Relative Strength Index (RSI)</li>
                <li>• MACD</li>
                <li>• Stochastic Oscillator</li>
              </ul>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Volatility</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Bollinger Bands</li>
                <li>• Average True Range (ATR)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
