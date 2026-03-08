"use client";

/**
 * Strategy detail page.
 */
import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  getStrategy,
  getStrategySignals,
  activateStrategy,
  deactivateStrategy,
  deleteStrategy,
} from "@/lib/api/strategies";
import {
  Strategy,
  Signal,
  StrategyType,
  getStrategyTypeLabel,
  getSignalTypeLabel,
  getSignalTypeColor,
  formatSignalStrength,
} from "@/lib/types/strategy";

export default function StrategyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const strategyId = parseInt(params.id as string);

  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSignals, setLoadingSignals] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStrategy = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getStrategy(strategyId);
      setStrategy(data);
    } catch (err: any) {
      setError(err.message || "Failed to load strategy");
    } finally {
      setLoading(false);
    }
  }, [strategyId]);

  const loadSignals = useCallback(async () => {
    setLoadingSignals(true);

    try {
      const response = await getStrategySignals(strategyId, { limit: 20 });
      setSignals(response.signals);
    } catch (err: any) {
      console.error("Failed to load signals:", err);
    } finally {
      setLoadingSignals(false);
    }
  }, [strategyId]);

  useEffect(() => {
    loadStrategy();
    loadSignals();
  }, [loadStrategy, loadSignals]);

  const handleToggleActive = async () => {
    if (!strategy) return;

    try {
      if (strategy.is_active) {
        await deactivateStrategy(strategy.id);
      } else {
        await activateStrategy(strategy.id);
      }
      await loadStrategy();
    } catch (err: any) {
      alert(
        `Failed to ${strategy.is_active ? "deactivate" : "activate"} strategy: ${err.message}`,
      );
    }
  };

  const handleDelete = async () => {
    if (!strategy) return;

    if (
      !confirm(
        `Are you sure you want to delete "${strategy.name}"? This cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      await deleteStrategy(strategy.id);
      router.push("/strategies");
    } catch (err: any) {
      alert(`Failed to delete strategy: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">Loading strategy...</div>
        </div>
      </div>
    );
  }

  if (error || !strategy) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error || "Strategy not found"}
          </div>
          <Link
            href="/strategies"
            className="inline-block mt-4 text-blue-600 hover:underline"
          >
            ← Back to Strategies
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/strategies"
            className="text-blue-600 hover:underline mb-2 inline-block"
          >
            ← Back to Strategies
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">{strategy.name}</h1>
                <span
                  className={`px-3 py-1 text-sm font-semibold rounded ${
                    strategy.is_active
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {strategy.is_active ? "Active" : "Inactive"}
                </span>
                <span className="px-3 py-1 text-sm font-semibold rounded bg-blue-100 text-blue-800">
                  {getStrategyTypeLabel(strategy.strategy_type as StrategyType)}
                </span>
              </div>
              <p className="text-gray-600">
                {strategy.description || "No description"}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleToggleActive}
                className={`px-4 py-2 rounded ${
                  strategy.is_active
                    ? "bg-yellow-600 text-white hover:bg-yellow-700"
                    : "bg-green-600 text-white hover:bg-green-700"
                }`}
              >
                {strategy.is_active ? "Deactivate" : "Activate"}
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Strategy Configuration */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Configuration</h2>
              <pre className="bg-gray-50 p-4 rounded overflow-x-auto text-sm">
                {JSON.stringify(strategy.config, null, 2)}
              </pre>
            </div>

            {/* Indicators */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Indicators</h2>
              {strategy.indicators.length === 0 ? (
                <p className="text-gray-500">No indicators configured</p>
              ) : (
                <div className="space-y-3">
                  {strategy.indicators.map((indicator) => (
                    <div key={indicator.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-lg capitalize">
                          {indicator.indicator_name}
                        </h3>
                        <span className="px-2 py-1 text-xs font-semibold rounded bg-purple-100 text-purple-800">
                          {indicator.usage}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Parameters: </span>
                        {JSON.stringify(indicator.parameters)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Signals */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Recent Signals</h2>
              {loadingSignals ? (
                <p className="text-gray-500">Loading signals...</p>
              ) : signals.length === 0 ? (
                <p className="text-gray-500">No signals generated yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-4">Time</th>
                        <th className="text-left py-2 px-4">Symbol</th>
                        <th className="text-left py-2 px-4">Type</th>
                        <th className="text-right py-2 px-4">Price</th>
                        <th className="text-right py-2 px-4">Strength</th>
                      </tr>
                    </thead>
                    <tbody>
                      {signals.map((signal) => (
                        <tr
                          key={signal.id}
                          className="border-b hover:bg-gray-50"
                        >
                          <td className="py-2 px-4 text-sm">
                            {new Date(signal.timestamp).toLocaleString()}
                          </td>
                          <td className="py-2 px-4 font-mono">
                            {signal.symbol}
                          </td>
                          <td className="py-2 px-4">
                            <span
                              className={`px-2 py-1 text-xs font-semibold rounded`}
                              style={{
                                backgroundColor: `${getSignalTypeColor(signal.signal_type as any)}20`,
                                color: getSignalTypeColor(
                                  signal.signal_type as any,
                                ),
                              }}
                            >
                              {getSignalTypeLabel(signal.signal_type as any)}
                            </span>
                          </td>
                          <td className="py-2 px-4 text-right font-mono">
                            ${signal.price.toFixed(2)}
                          </td>
                          <td className="py-2 px-4 text-right">
                            {formatSignalStrength(signal.strength)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Stats</h2>
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-gray-600">Indicators</div>
                  <div className="text-2xl font-bold">
                    {strategy.indicators.length}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Recent Signals</div>
                  <div className="text-2xl font-bold">{signals.length}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Created</div>
                  <div className="text-sm">
                    {new Date(strategy.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Last Updated</div>
                  <div className="text-sm">
                    {new Date(strategy.updated_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Actions</h2>
              <div className="space-y-2">
                <button className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                  Run Backtest
                </button>
                <button className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                  Generate Signals
                </button>
                <button className="w-full px-4 py-2 border rounded hover:bg-gray-50">
                  Export Configuration
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
