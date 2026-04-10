'use client';

/**
 * Create new backtest page.
 */
import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createBacktest, runBacktest } from '@/lib/api/backtests';
import { getStrategies } from '@/lib/api/strategies';
import { Strategy } from '@/lib/types/strategy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

const TIMEFRAMES = ['1d', '1h', '15m', '5m', '1m'];

function NewBacktestPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillStrategyId = searchParams.get('strategyId');

  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loadingStrategies, setLoadingStrategies] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(today.getFullYear() - 1);

  const [form, setForm] = useState({
    strategy_id: prefillStrategyId ?? '',
    name: '',
    symbols: searchParams.get('symbols') || '',
    start_date: searchParams.get('start_date') || oneYearAgo.toISOString().split('T')[0],
    end_date: searchParams.get('end_date') || today.toISOString().split('T')[0],
    initial_capital: searchParams.get('initial_capital') || '10000',
    timeframe: searchParams.get('timeframe') || '1d',
    commission: searchParams.get('commission') || '0',
    slippage: searchParams.get('slippage') || '0.001',
  });
  const selectedStrategyName = strategies.find((strategy) => strategy.id === form.strategy_id)?.name;

  useEffect(() => {
    const loadStrategies = async () => {
      try {
        const data = await getStrategies({ limit: 100, is_active: true });
        setStrategies(data.strategies);
        // Auto-set name based on pre-filled strategy
        if (prefillStrategyId && data.strategies.length > 0) {
          const strategy = data.strategies.find((s) => s.id === prefillStrategyId);
          if (strategy) {
            setForm((f) => ({
              ...f,
              strategy_id: strategy.id,
              name: `${strategy.name} Backtest`,
            }));
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load strategies');
      } finally {
        setLoadingStrategies(false);
      }
    };
    loadStrategies();
  }, [prefillStrategyId]);

  const handleStrategyChange = (strategyId: string | null) => {
    const nextStrategyId = strategyId ?? '';

    setForm((f) => {
      const strategy = strategies.find((s) => s.id === nextStrategyId);
      return {
        ...f,
        strategy_id: nextStrategyId,
        name: strategy ? `${strategy.name} Backtest` : f.name,
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const symbols = form.symbols
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);

      const backtest = await createBacktest({
        strategy_id: form.strategy_id,
        name: form.name,
        symbols,
        start_date: form.start_date,
        end_date: form.end_date,
        initial_capital: parseFloat(form.initial_capital),
        timeframe: form.timeframe,
        commission: parseFloat(form.commission),
        slippage: parseFloat(form.slippage),
      });

      // Run the backtest immediately
      await runBacktest(backtest.id);
      router.push(`/backtests/${backtest.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create backtest');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href="/backtests" className="text-blue-600 hover:underline text-sm">
          ← Back to Backtests
        </Link>
        <h1 className="text-3xl font-bold mt-1">New Backtest</h1>
      </div>

      {error && (
        <div aria-live="polite" className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-card rounded-xl ring-1 ring-foreground/10 p-6 space-y-5">
        {/* Strategy */}
        <div>
          <label id="backtest-strategy-label" className="mb-1 block text-sm font-medium">
            Strategy <span className="text-destructive">*</span>
          </label>
          {loadingStrategies ? (
            <p aria-live="polite" className="text-sm text-muted-foreground">
              Loading strategies…
            </p>
          ) : (
            <Select value={form.strategy_id} onValueChange={handleStrategyChange}>
              <SelectTrigger aria-labelledby="backtest-strategy-label" className="w-full">
                <SelectValue placeholder="Select a strategy">{selectedStrategyName}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {strategies.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Name */}
        <div>
          <label htmlFor="backtest-name" className="mb-1 block text-sm font-medium">
            Backtest Name <span className="text-destructive">*</span>
          </label>
          <Input
            id="backtest-name"
            name="name"
            required
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            autoComplete="off"
            placeholder="e.g., SPY 2023 Backtest…"
            className="w-full"
          />
        </div>

        {/* Symbols */}
        <div>
          <label htmlFor="backtest-symbols" className="mb-1 block text-sm font-medium">
            Symbols <span className="text-destructive">*</span>
          </label>
          <Input
            id="backtest-symbols"
            name="symbols"
            required
            type="text"
            value={form.symbols}
            onChange={(e) => setForm({ ...form, symbols: e.target.value.toUpperCase() })}
            autoComplete="off"
            spellCheck={false}
            placeholder="SPY, QQQ, IWM…"
            className="w-full"
          />
          <p className="text-xs text-muted-foreground mt-1">Comma-separated list of ETF symbols</p>
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="backtest-start-date" className="mb-1 block text-sm font-medium">
              Start Date <span className="text-destructive">*</span>
            </label>
            <Input
              id="backtest-start-date"
              name="start_date"
              required
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              autoComplete="off"
              className="w-full"
            />
          </div>
          <div>
            <label htmlFor="backtest-end-date" className="mb-1 block text-sm font-medium">
              End Date <span className="text-destructive">*</span>
            </label>
            <Input
              id="backtest-end-date"
              name="end_date"
              required
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              autoComplete="off"
              className="w-full"
            />
          </div>
        </div>

        {/* Capital + Timeframe */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="backtest-initial-capital" className="mb-1 block text-sm font-medium">
              Initial Capital ($) <span className="text-destructive">*</span>
            </label>
            <Input
              id="backtest-initial-capital"
              name="initial_capital"
              required
              type="number"
              min="1"
              step="any"
              value={form.initial_capital}
              onChange={(e) => setForm({ ...form, initial_capital: e.target.value })}
              autoComplete="off"
              inputMode="decimal"
              className="w-full"
            />
          </div>
          <div>
            <label id="backtest-timeframe-label" className="mb-1 block text-sm font-medium">
              Timeframe
            </label>
            <Select value={form.timeframe} onValueChange={(v) => setForm({ ...form, timeframe: v ?? '1d' })}>
              <SelectTrigger aria-labelledby="backtest-timeframe-label" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEFRAMES.map((tf) => (
                  <SelectItem key={tf} value={tf}>
                    {tf}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Commission + Slippage */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="backtest-commission" className="mb-1 block text-sm font-medium">
              Commission (per trade, $)
            </label>
            <Input
              id="backtest-commission"
              name="commission"
              type="number"
              min="0"
              step="any"
              value={form.commission}
              onChange={(e) => setForm({ ...form, commission: e.target.value })}
              autoComplete="off"
              inputMode="decimal"
              className="w-full"
            />
          </div>
          <div>
            <label htmlFor="backtest-slippage" className="mb-1 block text-sm font-medium">
              Slippage (fraction)
            </label>
            <Input
              id="backtest-slippage"
              name="slippage"
              type="number"
              min="0"
              step="any"
              value={form.slippage}
              onChange={(e) => setForm({ ...form, slippage: e.target.value })}
              autoComplete="off"
              inputMode="decimal"
              className="w-full"
            />
            <p className="mt-1 text-xs text-muted-foreground">e.g., 0.001 = 0.1% slippage</p>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={submitting} className="flex-1">
            {submitting ? 'Running…' : 'Run Backtest'}
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/backtests" />}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function NewBacktestPageWrapper() {
  return (
    <Suspense>
      <NewBacktestPage />
    </Suspense>
  );
}
