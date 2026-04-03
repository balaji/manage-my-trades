'use client';

/**
 * Backtests list page.
 */
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { listBacktests, deleteBacktest } from '@/lib/api/backtests';
import { Backtest, BacktestStatus } from '@/lib/types/backtest';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

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
      setError(err.message || 'Failed to load backtests');
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
          <Button nativeButton={false} render={<Link href="/backtests/new" />}>
            New Backtest
          </Button>
        </div>

        {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>}

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading backtests...</div>
        ) : backtests.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-4">No backtests yet</p>
            <Link href="/backtests/new" className="text-blue-600 hover:underline">
              Create your first backtest
            </Link>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Symbols</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Return</TableHead>
                <TableHead className="text-right">Sharpe</TableHead>
                <TableHead className="text-right">Win Rate</TableHead>
                <TableHead className="text-right">Created</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {backtests.map((bt) => (
                <TableRow key={bt.id}>
                  <TableCell>
                    <Link href={`/backtests/${bt.id}`} className="font-medium text-primary hover:underline">
                      {bt.name}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono">{bt.symbols.join(', ')}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(bt.start_date).toLocaleDateString()} – {new Date(bt.end_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={bt.status} />
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {bt.results != null ? (
                      <span className={bt.results.total_return_pct >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {bt.results.total_return_pct >= 0 ? '+' : ''}
                        {bt.results.total_return_pct.toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {bt.results?.sharpe_ratio != null ? bt.results.sharpe_ratio.toFixed(2) : '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {bt.results != null ? `${(bt.results.win_rate * 100).toFixed(1)}%` : '—'}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {new Date(bt.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="destructive" size="xs" onClick={() => handleDelete(bt.id, bt.name)}>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
