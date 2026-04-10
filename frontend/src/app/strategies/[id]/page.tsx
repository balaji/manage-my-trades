'use client';

/**
 * Strategy detail page.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getStrategy, activateStrategy, deactivateStrategy, deleteStrategy } from '@/lib/api/strategies';
import { Strategy, StrategyType, getStrategyTypeLabel } from '@/lib/types/strategy';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

function getSpecIndicators(strategy: Strategy) {
  return Array.isArray(strategy.spec?.indicators) ? strategy.spec.indicators : [];
}

export default function StrategyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const strategyId = params.id as string;

  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStrategy = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getStrategy(strategyId);
      setStrategy(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load strategy');
    } finally {
      setLoading(false);
    }
  }, [strategyId]);

  useEffect(() => {
    loadStrategy();
  }, [loadStrategy]);

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
      alert(`Failed to ${strategy.is_active ? 'deactivate' : 'activate'} strategy: ${err.message}`);
    }
  };

  const handleExportConfig = () => {
    if (!strategy) return;
    const config = {
      name: strategy.name,
      description: strategy.description,
      strategy_type: strategy.strategy_type,
      spec: strategy.spec,
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${strategy.name.replace(/\s+/g, '_')}_config.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async () => {
    if (!strategy) return;

    if (
      !confirm(
        `Are you sure you want to delete "${strategy.name}"?\n\nThis will also permanently delete all associated backtest results. This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await deleteStrategy(strategy.id);
      router.push('/strategies');
    } catch (err: any) {
      alert(`Failed to delete strategy: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div role="status" aria-live="polite" className="text-center py-12">
          Loading strategy…
        </div>
      </div>
    );
  }

  if (error || !strategy) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error || 'Strategy not found'}
        </div>
        <Link href="/strategies" className="inline-block mt-4 text-blue-600 hover:underline">
          ← Back to Strategies
        </Link>
      </div>
    );
  }

  const specIndicators = getSpecIndicators(strategy);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/strategies" className="text-blue-600 hover:underline mb-2 inline-block">
          ← Back to Strategies
        </Link>
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{strategy.name}</h1>
              <Badge variant={strategy.is_active ? 'default' : 'outline'}>
                {strategy.is_active ? 'Active' : 'Inactive'}
              </Badge>
              <Badge variant="secondary">{getStrategyTypeLabel(strategy.strategy_type as StrategyType)}</Badge>
            </div>
            <p className="text-muted-foreground">{strategy.description || 'No description'}</p>
          </div>
          <div className="flex gap-2">
            <Button variant={strategy.is_active ? 'outline' : 'secondary'} onClick={handleToggleActive}>
              {strategy.is_active ? 'Deactivate' : 'Activate'}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Strategy Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Strategy Spec</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded overflow-x-auto text-sm">
                {JSON.stringify(strategy.spec, null, 2)}
              </pre>
            </CardContent>
          </Card>

          {/* Indicators */}
          <Card>
            <CardHeader>
              <CardTitle>Indicators</CardTitle>
            </CardHeader>
            <CardContent>
              {specIndicators.length === 0 ? (
                <p className="text-muted-foreground">No indicators configured</p>
              ) : (
                <div className="space-y-3">
                  {specIndicators.map((indicator, index) => (
                    <div key={`${indicator.alias}-${index}`} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-lg">{indicator.alias}</h3>
                        <Badge variant="secondary">{indicator.indicator}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">Parameters: </span>
                        {JSON.stringify(indicator.params || {})}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-muted-foreground">Indicators</div>
                  <div className="text-2xl font-bold">{specIndicators.length}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Created</div>
                  <div className="text-sm">{new Date(strategy.created_at).toLocaleDateString()}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Last Updated</div>
                  <div className="text-sm">{new Date(strategy.updated_at).toLocaleDateString()}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button
                  className="w-full"
                  onClick={() => router.push(`/backtests/new?strategyId=${strategy.id}`)}
                  disabled={!strategy.is_active}
                >
                  Run Backtest
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  nativeButton={false}
                  render={<Link href={`/strategies/${strategy.id}/edit`} />}
                >
                  Edit Strategy
                </Button>
                <Button variant="outline" className="w-full" onClick={handleExportConfig}>
                  Export Configuration
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
