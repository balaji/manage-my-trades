"use client";

/**
 * Strategies list page.
 */
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  getStrategies,
  deleteStrategy,
  activateStrategy,
  deactivateStrategy,
} from "@/lib/api/strategies";
import {
  Strategy,
  StrategyType,
  getStrategyTypeLabel,
} from "@/lib/types/strategy";

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterActive, setFilterActive] = useState<boolean | undefined>(
    undefined,
  );
  const [filterType, setFilterType] = useState<string>("");

  const loadStrategies = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getStrategies({
        is_active: filterActive,
        strategy_type: filterType || undefined,
      });
      setStrategies(response.strategies);
    } catch (err: any) {
      setError(err.message || "Failed to load strategies");
    } finally {
      setLoading(false);
    }
  }, [filterActive, filterType]);

  useEffect(() => {
    loadStrategies();
  }, [loadStrategies]);

  const handleToggleActive = async (strategy: Strategy) => {
    try {
      if (strategy.is_active) {
        await deactivateStrategy(strategy.id);
      } else {
        await activateStrategy(strategy.id);
      }
      await loadStrategies();
    } catch (err: any) {
      alert(
        `Failed to ${strategy.is_active ? "deactivate" : "activate"} strategy: ${err.message}`,
      );
    }
  };

  const handleDelete = async (strategy: Strategy) => {
    if (
      !confirm(
        `Are you sure you want to delete "${strategy.name}"? This cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      await deleteStrategy(strategy.id);
      await loadStrategies();
    } catch (err: any) {
      alert(`Failed to delete strategy: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Trading Strategies</h1>
          <Link
            href="/strategies/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create Strategy
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">Status</label>
              <select
                value={
                  filterActive === undefined
                    ? ""
                    : filterActive
                      ? "active"
                      : "inactive"
                }
                onChange={(e) => {
                  if (e.target.value === "") setFilterActive(undefined);
                  else setFilterActive(e.target.value === "active");
                }}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Strategies</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Types</option>
                <option value={StrategyType.TECHNICAL}>Technical</option>
                <option value={StrategyType.ML}>Machine Learning</option>
                <option value={StrategyType.COMBINED}>Combined</option>
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Strategies List */}
        <div className="bg-white rounded-lg shadow">
          {loading ? (
            <div className="p-12 text-center text-gray-500">
              Loading strategies...
            </div>
          ) : strategies.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <p className="mb-4">No strategies found</p>
              <Link
                href="/strategies/new"
                className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create Your First Strategy
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {strategies.map((strategy) => (
                <div key={strategy.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Link href={`/strategies/${strategy.id}`}>
                          <h3 className="text-xl font-semibold hover:text-blue-600 cursor-pointer">
                            {strategy.name}
                          </h3>
                        </Link>
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded ${
                            strategy.is_active
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {strategy.is_active ? "Active" : "Inactive"}
                        </span>
                        <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-100 text-blue-800">
                          {getStrategyTypeLabel(
                            strategy.strategy_type as StrategyType,
                          )}
                        </span>
                      </div>
                      <p className="text-gray-600 mb-2">
                        {strategy.description || "No description"}
                      </p>
                      <div className="text-sm text-gray-500">
                        <span className="mr-4">
                          Indicators: {strategy.indicators.length}
                        </span>
                        <span>
                          Created:{" "}
                          {new Date(strategy.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleToggleActive(strategy)}
                        className={`px-3 py-1 text-sm rounded ${
                          strategy.is_active
                            ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                            : "bg-green-100 text-green-800 hover:bg-green-200"
                        }`}
                      >
                        {strategy.is_active ? "Deactivate" : "Activate"}
                      </button>
                      <Link
                        href={`/strategies/${strategy.id}`}
                        className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => handleDelete(strategy)}
                        className="px-3 py-1 text-sm bg-red-100 text-red-800 rounded hover:bg-red-200"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Stats */}
        {!loading && strategies.length > 0 && (
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-blue-600">
                {strategies.length}
              </div>
              <div className="text-sm text-gray-600">Total Strategies</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-green-600">
                {strategies.filter((s) => s.is_active).length}
              </div>
              <div className="text-sm text-gray-600">Active Strategies</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-gray-600">
                {strategies.reduce((sum, s) => sum + s.indicators.length, 0)}
              </div>
              <div className="text-sm text-gray-600">Total Indicators</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
