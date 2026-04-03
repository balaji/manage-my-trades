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
import { technicalAnalysisApi } from '@/lib/api/technical-analysis';
import { Backtest, BacktestTrade } from '@/lib/types/backtest';
import { Signal } from '@/lib/types/signal';
import { marketDataApi } from '@/lib/api/market-data';
import { MarketDataResponse } from '@/lib/types/market-data';
import { PriceChart } from '@/components/charts/PriceChart';
import {
  buildChartSeries,
  buildStrategyIndicatorDefinitions,
  IndicatorSeriesConfig,
  OscillatorSeriesConfig,
} from '@/lib/technical-analysis/chart-model';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

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
    <Card size="sm">
      <CardContent className="pt-3">
        <div className="text-xs text-muted-foreground mb-1">{label}</div>
        <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variantMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    pending: 'outline',
    running: 'secondary',
    completed: 'default',
    failed: 'destructive',
  };
  return (
    <Badge variant={variantMap[status] ?? 'outline'} className="capitalize">
      {status}
    </Badge>
  );
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
    Record<string, { overlays: IndicatorSeriesConfig[]; oscillators: OscillatorSeriesConfig[] }>
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

          if (specIndicators.length > 0) {
            const indicatorRequests = specIndicators.map((d) => ({ name: d.indicator, params: d.params ?? {} }));
            const definitions = buildStrategyIndicatorDefinitions(specIndicators);
            const perSymbol: Record<
              string,
              { overlays: IndicatorSeriesConfig[]; oscillators: OscillatorSeriesConfig[] }
            > = {};

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
                  perSymbol[symbol] = buildChartSeries(response.indicators, supportedIndicators, definitions);
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

  // Compute open positions value: latest bar close price × quantity for each open trade
  const latestPrices: Record<string, number> = {};
  for (const { symbol, bars } of priceData) {
    if (bars.length > 0) latestPrices[symbol] = bars[bars.length - 1].close;
  }
  const openTrades = trades.filter((t) => t.status === 'open');
  const openTradesValue = openTrades.reduce(
    (sum, t) => sum + (latestPrices[t.symbol] ?? t.entry_price) * t.quantity,
    0
  );

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
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
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
          <Button nativeButton={false} render={<Link href={`/strategies/${backtest.strategy_id}`} />}>
            View Strategy
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/strategies/${backtest.strategy_id}/edit`} />}
          >
            Edit Strategy
          </Button>
          <Button
            variant="secondary"
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
          >
            Re-run Backtest
          </Button>
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
                  sub={
                    openTradesValue > 0
                      ? `Initial: $${backtest.initial_capital.toLocaleString()} · With Open: $${(openTradesValue + r.final_capital).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                      : `Initial: $${backtest.initial_capital.toLocaleString()}`
                  }
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
                <MetricCard
                  label="Open Positions Value"
                  value={
                    openTradesValue > 0
                      ? `$${openTradesValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                      : '—'
                  }
                  sub={
                    openTradesValue > 0
                      ? `${openTrades.length} position${openTrades.length !== 1 ? 's' : ''}`
                      : undefined
                  }
                />
              </div>
            </div>

            {/* Right: Equity Curve */}
            {equityData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Equity Curve</CardTitle>
                </CardHeader>
                <CardContent>
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
                        tickFormatter={(v) =>
                          `$${(v as number).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                        }
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
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Price History Chart */}
        {priceData.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Price History</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        )}

        {/* Signals & Trades Tables - Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Signals Section */}
          {signals.length > 0 && (
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Signals ({signals.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Timestamp</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {signals.map((signal) => (
                      <TableRow key={signal.id}>
                        <TableCell className="font-mono">{signal.symbol}</TableCell>
                        <TableCell>
                          <span
                            className={`capitalize font-semibold ${
                              signal.signal_type === 'buy'
                                ? 'text-green-600'
                                : signal.signal_type === 'sell'
                                  ? 'text-red-600'
                                  : 'text-muted-foreground'
                            }`}
                          >
                            {signal.signal_type}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(signal.timestamp).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: '2-digit',
                          })}
                        </TableCell>
                        <TableCell className="text-right font-mono">${signal.price.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Trades Table */}
          {trades.length > 0 && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Trades ({trades.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Side</TableHead>
                      <TableHead>Entry Date</TableHead>
                      <TableHead className="text-right">Entry Price</TableHead>
                      <TableHead>Exit Date</TableHead>
                      <TableHead className="text-right">Exit Price</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">P&amp;L</TableHead>
                      <TableHead className="text-right">P&amp;L %</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trades.map((trade) => (
                      <TableRow key={trade.id}>
                        <TableCell className="font-mono">{trade.symbol}</TableCell>
                        <TableCell>
                          <span
                            className={`capitalize font-semibold ${trade.side === 'buy' ? 'text-green-600' : 'text-red-600'}`}
                          >
                            {trade.side}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(trade.entry_date).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </TableCell>
                        <TableCell className="text-right font-mono">${trade.entry_price.toFixed(2)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {trade.exit_date
                            ? new Date(trade.exit_date).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {trade.exit_price != null ? `$${trade.exit_price.toFixed(2)}` : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono">{trade.quantity.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono">
                          {trade.pnl != null ? (
                            <span className={trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {trade.pnl_pct != null ? (
                            <span className={trade.pnl_pct >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {trade.pnl_pct >= 0 ? '+' : ''}
                              {trade.pnl_pct.toFixed(2)}%
                            </span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={trade.status === 'closed' ? 'default' : 'outline'} className="capitalize">
                            {trade.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
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
