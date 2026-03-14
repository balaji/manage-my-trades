'use client';

/**
 * Create new backtest page.
 */
import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createBacktest, runBacktest } from '@/lib/api/backtests';
import { getStrategies } from '@/lib/api/strategies';
import { Strategy } from '@/lib/types/strategy';

const TIMEFRAMES = ['1d', '1h', '15m', '5m', '1m'];

export default function NewBacktestPage() {
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
    symbols: 'SPY',
    start_date: oneYearAgo.toISOString().split('T')[0],
    end_date: today.toISOString().split('T')[0],
    initial_capital: '10000',
    timeframe: '1d',
    commission: '0',
    slippage: '0.001',
  });

  useEffect(() => {
    const loadStrategies = async () => {
      try {
        const data = await getStrategies({ limit: 100 });
        setStrategies(data.strategies);
        // Auto-set name based on pre-filled strategy
        if (prefillStrategyId && data.strategies.length > 0) {
          const strategy = data.strategies.find((s) => s.id === parseInt(prefillStrategyId));
          if (strategy) {
            setForm((f) => ({
              ...f,
              name: `${strategy.name} Backtest`,
            }));
          }
        }
      } catch (err) {
        console.error('Failed to load strategies:', err);
      } finally {
        setLoadingStrategies(false);
      }
    };
    loadStrategies();
  }, [prefillStrategyId]);

  const handleStrategyChange = (strategyId: string) => {
    setForm((f) => {
      const strategy = strategies.find((s) => s.id === parseInt(strategyId));
      return {
        ...f,
        strategy_id: strategyId,
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
        strategy_id: parseInt(form.strategy_id),
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
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link href="/backtests" className="text-blue-600 hover:underline text-sm">
            ← Back to Backtests
          </Link>
          <h1 className="text-3xl font-bold mt-1">New Backtest</h1>
        </div>

        {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-5">
          {/* Strategy */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Strategy <span className="text-red-500">*</span>
            </label>
            {loadingStrategies ? (
              <p className="text-sm text-gray-500">Loading strategies...</p>
            ) : (
              <select
                required
                value={form.strategy_id}
                onChange={(e) => handleStrategyChange(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a strategy</option>
                {strategies.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Backtest Name <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g. SPY 2023 Backtest"
            />
          </div>

          {/* Symbols */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Symbols <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="text"
              value={form.symbols}
              onChange={(e) => setForm({ ...form, symbols: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="SPY, QQQ, IWM (comma-separated)"
            />
            <p className="text-xs text-gray-500 mt-1">Comma-separated list of ETF symbols</p>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                End Date <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Capital + Timeframe */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Initial Capital ($) <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="number"
                min="1"
                step="any"
                value={form.initial_capital}
                onChange={(e) => setForm({ ...form, initial_capital: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Timeframe</label>
              <select
                value={form.timeframe}
                onChange={(e) => setForm({ ...form, timeframe: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {TIMEFRAMES.map((tf) => (
                  <option key={tf} value={tf}>
                    {tf}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Commission + Slippage */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Commission (per trade, $)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.commission}
                onChange={(e) => setForm({ ...form, commission: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Slippage (fraction)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.slippage}
                onChange={(e) => setForm({ ...form, slippage: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">e.g. 0.001 = 0.1% slippage</p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {submitting ? 'Running...' : 'Run Backtest'}
            </button>
            <Link href="/backtests" className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-center">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
