'use client';

/**
 * Strategies list page.
 */
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getStrategies } from '@/lib/api/strategies';
import { useAuth } from '@/lib/auth-context';
import { Strategy, StrategyType, getStrategyTypeLabel } from '@/lib/types/strategy';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

function getIndicatorCount(strategy: Strategy): number {
  return Array.isArray(strategy.spec?.indicators) ? strategy.spec.indicators.length : 0;
}

export default function StrategiesPage() {
  const { user, authLoading } = useAuth();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterActive, setFilterActive] = useState<boolean | undefined>(undefined);
  const [filterType, setFilterType] = useState<string>('');

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
      setError(err.message || 'Failed to load strategies');
    } finally {
      setLoading(false);
    }
  }, [filterActive, filterType]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (user) {
      void loadStrategies();
      setError(null);
    } else {
      setError('Please sign in to view strategies.');
    }
  }, [authLoading, loadStrategies, user]);

  return (
    <>
      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>}
      {user && (
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8 mt-1">
            <h1 className="text-3xl font-bold">Trading Strategies</h1>
            {user && (
              <Button nativeButton={false} render={<Link href="/strategies/new" />}>
                Create Strategy
              </Button>
            )}
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="pt-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-2">Status</label>
                  <Select
                    value={filterActive === undefined ? '' : filterActive ? 'active' : 'inactive'}
                    onValueChange={(v) => {
                      if (v === '') setFilterActive(undefined);
                      else setFilterActive(v === 'active');
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All Strategies" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Strategies</SelectItem>
                      <SelectItem value="active">Active Only</SelectItem>
                      <SelectItem value="inactive">Inactive Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-2">Type</label>
                  <Select value={filterType} onValueChange={(value) => setFilterType(value ?? '')}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Types</SelectItem>
                      <SelectItem value={StrategyType.TECHNICAL}>Technical</SelectItem>
                      <SelectItem value={StrategyType.ML}>Machine Learning</SelectItem>
                      <SelectItem value={StrategyType.COMBINED}>Combined</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Strategies List */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-12 text-center text-muted-foreground">Loading strategies...</div>
              ) : strategies.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <p className="mb-4">No strategies found</p>

                  <Button nativeButton={false} render={<Link href="/strategies/new" />}>
                    Create Your First Strategy
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {strategies.map((strategy) => (
                    <Link
                      key={strategy.id}
                      href={`/strategies/${strategy.id}`}
                      className="block p-6 hover:bg-muted/50 cursor-pointer"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-semibold">{strategy.name}</h3>
                            <Badge variant={strategy.is_active ? 'default' : 'outline'}>
                              {strategy.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                            <Badge variant="secondary">
                              {getStrategyTypeLabel(strategy.strategy_type as StrategyType)}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground mb-2">{strategy.description || 'No description'}</p>
                          <div className="text-sm text-muted-foreground">
                            <span className="mr-4">Indicators: {getIndicatorCount(strategy)}</span>
                            <span>Created: {new Date(strategy.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
