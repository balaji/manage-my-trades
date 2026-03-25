'use client';

/**
 * Backtest results page.
 */
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { SeriesMarker, Time, UTCTimestamp } from 'lightweight-charts';
import { getBacktest, getBacktestTrades, getBacktestSignals, deleteBacktest } from '@/lib/api/backtests';
import { getStrategy } from '@/lib/api/strategies';
import { technicalAnalysisApi, IndicatorResult } from '@/lib/api/technical-analysis';
import { Backtest, BacktestTrade } from '@/lib/types/backtest';
import { Signal } from '@/lib/types/signal';
import { marketDataApi } from '@/lib/api/market-data';
import { MarketDataResponse } from '@/lib/types/market-data';
import { PriceChart } from '@/components/charts/PriceChart';

function MetricCard({
  label,
  value,
  sub,
  positive,
}: {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
}) {
  const colorClass = positive === true ? 'text-green-600' : positive === false ? 'text-red-600' : '';
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    running: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  };
  return (
    <span
      className={`px-3 py-1 text-sm font-semibold rounded capitalize ${styles[status] ?? 'bg-gray-100 text-gray-800'}`}
    >
      {status}
    </span>
  );
}

const INDICATOR_COLORS = ['#2196F3', '#FF5722', '#4CAF50', '#9C27B0', '#FF9800', '#00BCD4', '#E91E63', '#795548'];

const OSCILLATOR_REF_LINES: Record<string, Array<{ value: number; color: string }>> = {
  RSI: [
    { value: 70, color: '#ef4444' },
    { value: 30, color: '#22c55e' },
  ],
  STOCH: [
    { value: 80, color: '#ef4444' },
    { value: 20, color: '#22c55e' },
  ],
  STOCHF: [
    { value: 80, color: '#ef4444' },
    { value: 20, color: '#22c55e' },
  ],
};

interface IndicatorConfig {
  name: string;
  data: Array<{ timestamp: string; value: number }>;
  color: string;
}

interface OscillatorConfig {
  name: string;
  data: Array<{ timestamp: string; value: number }>;
  color: string;
  referenceLines?: Array<{ value: number; color: string }>;
}

function buildChartConfigs(
  results: IndicatorResult[],
  groupMap: Record<string, string>,
  strategyIndicators: Array<{ alias: string; indicator: string; params?: Record<string, unknown> }>
): { overlays: IndicatorConfig[]; oscillators: OscillatorConfig[] } {
  const overlays: IndicatorConfig[] = [];
  const oscillators: OscillatorConfig[] = [];
  let colorIdx = 0;
  for (const result of results) {
    const isOverlay = groupMap[result.name] === 'Overlap Studies';
    const strategyDef = strategyIndicators.find((d) => {
      const res = d.indicator.toUpperCase() === result.name;
      if (d.params || result.params) {
        return res && JSON.stringify(d.params) === JSON.stringify(result.params);
      }
      return res;
    });
    const alias = strategyDef?.alias ?? result.name;
    const outputKeys = Object.keys(result.outputs);

    for (const outputName of outputKeys) {
      const data = result.outputs[outputName];
      const color = INDICATOR_COLORS[colorIdx++ % INDICATOR_COLORS.length];
      const label = outputKeys.length > 1 ? `${alias} (${outputName})` : alias;

      if (isOverlay) {
        overlays.push({ name: label, data, color });
      } else {
        oscillators.push({
          name: label,
          data,
          color,
          referenceLines: outputKeys.length === 1 ? OSCILLATOR_REF_LINES[result.name] : undefined,
        });
      }
    }
  }

  return { overlays, oscillators };
}

function buildSignalMarkers(symbol: string, signals: Signal[]): SeriesMarker<Time>[] {
  return signals
    .filter((signal) => signal.symbol === symbol && (signal.signal_type === 'buy' || signal.signal_type === 'sell'))
    .map((signal) => ({
      time: (new Date(signal.timestamp).getTime() / 1000) as UTCTimestamp,
      position: signal.signal_type === 'buy' ? ('belowBar' as const) : ('aboveBar' as const),
      shape: signal.signal_type === 'buy' ? ('arrowUp' as const) : ('arrowDown' as const),
      color: signal.signal_type === 'buy' ? '#16a34a' : '#dc2626',
      text: signal.signal_type === 'buy' ? 'Buy' : 'Sell',
    }))
    .sort((a, b) => (a.time as number) - (b.time as number));
}

export default function BacktestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const backtestId = parseInt(params.id as string);

  const [backtest, setBacktest] = useState<Backtest | null>(null);
  const [trades, setTrades] = useState<BacktestTrade[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [priceData, setPriceData] = useState<MarketDataResponse[]>([]);
  const [symbolIndicators, setSymbolIndicators] = useState<
    Record<string, { overlays: IndicatorConfig[]; oscillators: OscillatorConfig[] }>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [bt, tradesData, signalsData] = await Promise.all([
          getBacktest(backtestId),
          getBacktestTrades(backtestId, { limit: 500 }),
          getBacktestSignals(backtestId, { limit: 500 }),
        ]);
        setBacktest(bt);
        setTrades(tradesData.trades);
        setSignals(signalsData.signals);
        if (bt.status === 'completed') {
          const [bars, strategy, { indicators: supportedIndicators }] = await Promise.all([
            marketDataApi.getBars({
              symbols: bt.symbols,
              start_date: bt.start_date,
              end_date: bt.end_date,
              timeframe: bt.timeframe,
            }),
            getStrategy(bt.strategy_id).catch(() => null),
            technicalAnalysisApi.getSupportedIndicators().catch(() => ({ indicators: [] })),
          ]);
          setPriceData(bars);

          const specIndicators: Array<{ alias: string; indicator: string; params: Record<string, unknown> }> =
            strategy?.spec?.indicators ?? [];
          const groupMap: Record<string, string> = Object.fromEntries(
            supportedIndicators.map((ind) => [ind.name, ind.group ?? ''])
          );

          if (specIndicators.length > 0) {
            const indicatorRequests = specIndicators.map((d) => ({ name: d.indicator, params: d.params ?? {} }));
            const perSymbol: Record<string, { overlays: IndicatorConfig[]; oscillators: OscillatorConfig[] }> = {};

            await Promise.all(
              bt.symbols.map(async (symbol) => {
                try {
                  const response = await technicalAnalysisApi.calculateIndicators({
                    symbol,
                    timeframe: bt.timeframe,
                    start_date: bt.start_date,
                    end_date: bt.end_date,
                    indicators: indicatorRequests,
                  });
                  perSymbol[symbol] = buildChartConfigs(response.indicators, groupMap, specIndicators);
                } catch {
                  perSymbol[symbol] = { overlays: [], oscillators: [] };
                }
              })
            );
            setSymbolIndicators(perSymbol);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load backtest');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [backtestId]);

  const handleDelete = async () => {
    if (!backtest) return;
    if (!confirm(`Delete backtest "${backtest.name}"? This cannot be undone.`)) return;
    try {
      await deleteBacktest(backtest.id);
      router.push('/backtests');
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto text-center py-12 text-gray-500">Loading backtest...</div>
      </div>
    );
  }

  if (error || !backtest) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error || 'Backtest not found'}
          </div>
          <Link href="/backtests" className="inline-block mt-4 text-blue-600 hover:underline">
            ← Back to Backtests
          </Link>
        </div>
      </div>
    );
  }

  // Build equity curve chart data
  const equityData = backtest.results?.equity_curve.curve ?? [];

  const r = backtest.results;

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href="/backtests" className="text-blue-600 hover:underline text-sm">
            ← Back to Backtests
          </Link>
          <div className="flex justify-between items-start mt-1">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-bold">{backtest.name}</h1>
                <StatusBadge status={backtest.status} />
              </div>
              <p className="text-gray-500 text-sm">
                {backtest.symbols.join(', ')} &middot; {new Date(backtest.start_date).toLocaleDateString()} –{' '}
                {new Date(backtest.end_date).toLocaleDateString()} &middot; {backtest.timeframe} timeframe
              </p>
            </div>
            <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
              Delete
            </button>
          </div>
        </div>

        {/* Error message if failed */}
        {backtest.status === 'failed' && backtest.error_message && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <strong>Backtest failed:</strong> {backtest.error_message}
          </div>
        )}

        {/* Strategy & Re-run Actions */}
        <div className="mb-6 flex gap-3">
          <Link
            href={`/strategies/${backtest.strategy_id}`}
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            View Strategy
          </Link>
          <Link
            href={`/strategies/${backtest.strategy_id}/edit`}
            className="inline-block px-4 py-2 border border-blue-600 text-blue-600 rounded hover:bg-blue-50 transition-colors"
          >
            Edit Strategy
          </Link>
          <button
            onClick={() => {
              const params = new URLSearchParams({
                strategyId: String(backtest.strategy_id),
                symbols: backtest.symbols.join(','),
                start_date: backtest.start_date,
                end_date: backtest.end_date,
                initial_capital: String(backtest.initial_capital),
                timeframe: backtest.timeframe,
                commission: String(backtest.commission),
                slippage: String(backtest.slippage),
              });
              router.push(`/backtests/new?${params.toString()}`);
            }}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            Re-run Backtest
          </button>
        </div>

        {/* Metrics & Equity Curve */}
        {r && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Left: Metrics */}
            <div>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <MetricCard
                  label="Total Return"
                  value={`${r.total_return_pct >= 0 ? '+' : ''}${r.total_return_pct.toFixed(2)}%`}
                  sub={`$${r.total_return.toFixed(2)}`}
                  positive={r.total_return_pct >= 0}
                />
                <MetricCard label="Sharpe Ratio" value={r.sharpe_ratio != null ? r.sharpe_ratio.toFixed(2) : '—'} />
                <MetricCard
                  label="Max Drawdown"
                  value={`-${r.max_drawdown_pct.toFixed(2)}%`}
                  sub={`$${r.max_drawdown.toFixed(2)}`}
                  positive={false}
                />
              </div>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <MetricCard
                  label="Win Rate"
                  value={`${(r.win_rate * 100).toFixed(1)}%`}
                  sub={`${r.winning_trades}W / ${r.losing_trades}L`}
                  positive={r.win_rate >= 0.5}
                />
                <MetricCard
                  label="Final Capital"
                  value={`$${r.final_capital.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                  sub={`Initial: $${backtest.initial_capital.toLocaleString()}`}
                />
                <MetricCard
                  label="Profit Factor"
                  value={r.profit_factor != null ? r.profit_factor.toFixed(2) : '—'}
                  positive={r.profit_factor != null ? r.profit_factor >= 1 : undefined}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <MetricCard label="Total Trades" value={r.total_trades.toString()} />
                <MetricCard
                  label="Avg Trade Duration"
                  value={r.avg_trade_duration != null ? `${(r.avg_trade_duration / 24).toFixed(1)}d` : '—'}
                />
              </div>
            </div>

            {/* Right: Equity Curve */}
            {equityData.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Equity Curve</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={equityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) =>
                        new Date(d).toLocaleDateString(undefined, {
                          month: 'short',
                          year: '2-digit',
                        })
                      }
                      tick={{ fontSize: 11 }}
                      interval={Math.ceil(equityData.length / 8)}
                    />
                    <YAxis
                      tickFormatter={(v) => `$${(v as number).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                      tick={{ fontSize: 11 }}
                      width={80}
                    />
                    <Tooltip
                      formatter={(v) => [
                        `$${(v as number).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
                        'Portfolio Value',
                      ]}
                      labelFormatter={(l) => new Date(l as string).toLocaleDateString()}
                    />
                    <Line type="monotone" dataKey="value" stroke="#2563eb" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Price History Chart */}
        {priceData.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Price History</h2>
            {priceData.map(({ symbol, bars }) => (
              <div key={symbol} className={priceData.length > 1 ? 'mb-6' : ''}>
                {priceData.length > 1 && <h3 className="text-base font-medium text-gray-700 mb-2">{symbol}</h3>}
                <PriceChart
                  data={bars}
                  indicators={symbolIndicators[symbol]?.overlays ?? []}
                  oscillators={symbolIndicators[symbol]?.oscillators ?? []}
                  markers={buildSignalMarkers(symbol, signals)}
                  timeRange={{
                    from: `${backtest.start_date}T00:00:00Z`,
                    to: `${backtest.end_date}T23:59:59Z`,
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Signals & Trades Tables - Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Signals Section */}
          {signals.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6 lg:col-span-1">
              <h2 className="text-xl font-semibold mb-4">Signals ({signals.length})</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600">Symbol</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600">Type</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600">Timestamp</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-600">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {signals.map((signal) => (
                      <tr key={signal.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3 font-mono">{signal.symbol}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`capitalize font-semibold ${
                              signal.signal_type === 'buy'
                                ? 'text-green-600'
                                : signal.signal_type === 'sell'
                                  ? 'text-red-600'
                                  : 'text-gray-600'
                            }`}
                          >
                            {signal.signal_type}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-gray-600">
                          {new Date(signal.timestamp).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: '2-digit',
                          })}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">${signal.price.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Trades Table */}
          {trades.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
              <h2 className="text-xl font-semibold mb-4">Trades ({trades.length})</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600">Symbol</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600">Side</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600">Entry Date</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-600">Entry Price</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600">Exit Date</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-600">Exit Price</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-600">Qty</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-600">P&amp;L</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-600">P&amp;L %</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((trade) => (
                      <tr key={trade.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3 font-mono">{trade.symbol}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`capitalize font-semibold ${trade.side === 'buy' ? 'text-green-600' : 'text-red-600'}`}
                          >
                            {trade.side}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-gray-600">
                          {new Date(trade.entry_date).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">${trade.entry_price.toFixed(2)}</td>
                        <td className="py-2 px-3 text-gray-600">
                          {trade.exit_date
                            ? new Date(trade.exit_date).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })
                            : '—'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          {trade.exit_price != null ? `$${trade.exit_price.toFixed(2)}` : '—'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">{trade.quantity.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-mono">
                          {trade.pnl != null ? (
                            <span className={trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          {trade.pnl_pct != null ? (
                            <span className={trade.pnl_pct >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {trade.pnl_pct >= 0 ? '+' : ''}
                              {trade.pnl_pct.toFixed(2)}%
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`capitalize text-xs font-semibold px-2 py-0.5 rounded ${
                              trade.status === 'closed'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {trade.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* No results yet */}
        {backtest.status === 'pending' && (
          <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
            Backtest is pending execution.
          </div>
        )}
        {backtest.status === 'running' && (
          <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
            Backtest is currently running...
          </div>
        )}
      </div>
    </div>
  );
}
