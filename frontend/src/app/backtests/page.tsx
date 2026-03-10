"use client";

/**
 * Backtests list page.
 */
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { listBacktests, deleteBacktest } from "@/lib/api/backtests";
import { Backtest, BacktestStatus } from "@/lib/types/backtest";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    running: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
  };
  return (
    <span
      className={`px-2 py-1 text-xs font-semibold rounded capitalize ${styles[status] ?? "bg-gray-100 text-gray-800"}`}
    >
      {status}
    </span>
  );
}

export default function BacktestsPage() {
  const [backtests, setBacktests] = useState<Backtest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listBacktests({ limit: 100 });
      setBacktests(data.backtests);
    } catch (err: any) {
      setError(err.message || "Failed to load backtests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete backtest "${name}"? This cannot be undone.`)) return;
    try {
      await deleteBacktest(id);
      setBacktests((prev) => prev.filter((b) => b.id !== id));
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <Link href="/" className="text-blue-600 hover:underline text-sm">
              ← Home
            </Link>
            <h1 className="text-3xl font-bold mt-1">Backtests</h1>
          </div>
          <Link
            href="/backtests/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            New Backtest
          </Link>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-500">
            Loading backtests...
          </div>
        ) : backtests.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-4">No backtests yet</p>
            <Link
              href="/backtests/new"
              className="text-blue-600 hover:underline"
            >
              Create your first backtest
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                    Name
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                    Symbols
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                    Period
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                    Status
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">
                    Return
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">
                    Sharpe
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">
                    Win Rate
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">
                    Created
                  </th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {backtests.map((bt) => (
                  <tr key={bt.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <Link
                        href={`/backtests/${bt.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {bt.name}
                      </Link>
                    </td>
                    <td className="py-3 px-4 font-mono text-sm">
                      {bt.symbols.join(", ")}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(bt.start_date).toLocaleDateString()} –{" "}
                      {new Date(bt.end_date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={bt.status} />
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm">
                      {bt.results != null ? (
                        <span
                          className={
                            bt.results.total_return_pct >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }
                        >
                          {bt.results.total_return_pct >= 0 ? "+" : ""}
                          {bt.results.total_return_pct.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm">
                      {bt.results?.sharpe_ratio != null
                        ? bt.results.sharpe_ratio.toFixed(2)
                        : "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm">
                      {bt.results != null
                        ? `${(bt.results.win_rate * 100).toFixed(1)}%`
                        : "—"}
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-gray-500">
                      {new Date(bt.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDelete(bt.id, bt.name)}
                        className="text-sm text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
