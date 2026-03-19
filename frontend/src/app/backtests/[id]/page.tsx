'use client';

/**
 * Backtest results page.
 */
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getBacktest, getBacktestTrades, getBacktestSignals, deleteBacktest } from '@/lib/api/backtests';
import { Backtest, BacktestTrade } from '@/lib/types/backtest';
import { Signal } from '@/lib/types/signal';

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

export default function BacktestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const backtestId = parseInt(params.id as string);

  const [backtest, setBacktest] = useState<Backtest | null>(null);
  const [trades, setTrades] = useState<BacktestTrade[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
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

        {/* Strategy Link */}
        <div className="mb-6">
          <Link
            href={`/strategies/${backtest.strategy_id}`}
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            View Strategy
          </Link>
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

        {/* Signals & Trades Tables - Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Signals Section */}
          {signals.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Signals ({signals.length})</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600">Symbol</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600">Signal Type</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600">Timestamp</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-600">Price</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-600">Strength</th>
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
                        <td className="py-2 px-3 text-gray-600">{new Date(signal.timestamp).toLocaleDateString()}</td>
                        <td className="py-2 px-3 text-right font-mono">${signal.price.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-mono">
                          {signal.strength != null ? `${(signal.strength * 100).toFixed(0)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Trades Table */}
          {trades.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
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
                        <td className="py-2 px-3 text-gray-600">{new Date(trade.entry_date).toLocaleDateString()}</td>
                        <td className="py-2 px-3 text-right font-mono">${trade.entry_price.toFixed(2)}</td>
                        <td className="py-2 px-3 text-gray-600">
                          {trade.exit_date ? new Date(trade.exit_date).toLocaleDateString() : '—'}
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
