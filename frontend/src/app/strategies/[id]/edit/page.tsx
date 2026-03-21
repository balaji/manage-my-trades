'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getStrategy, updateStrategy, createStrategy } from '@/lib/api/strategies';
import { Strategy, StrategyCreate, StrategyType } from '@/lib/types/strategy';
import { StrategyForm } from '@/components/strategies/StrategyForm';

export default function EditStrategyPage() {
  const params = useParams();
  const router = useRouter();
  const strategyId = parseInt(params.id as string);

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

  const handleOverwrite = async (data: StrategyCreate) => {
    await updateStrategy(strategyId, {
      name: data.name,
      description: data.description,
      strategy_type: data.strategy_type,
      spec: data.spec,
    });
    router.push(`/strategies/${strategyId}`);
  };

  const handleSaveAsNew = async (data: StrategyCreate) => {
    const newName = data.name === strategy?.name ? `${data.name} (copy)` : data.name;
    const newStrategy = await createStrategy({ ...data, name: newName });
    router.push(`/strategies/${newStrategy.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-3xl mx-auto text-center py-12 text-gray-500">Loading strategy...</div>
      </div>
    );
  }

  if (error || !strategy) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error || 'Strategy not found'}
          </div>
          <Link href="/strategies" className="inline-block mt-4 text-blue-600 hover:underline">
            &larr; Back to Strategies
          </Link>
        </div>
      </div>
    );
  }

  const initialData: Partial<StrategyCreate> = {
    name: strategy.name,
    description: strategy.description || '',
    strategy_type: strategy.strategy_type as StrategyType,
    spec: strategy.spec,
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link href={`/strategies/${strategyId}`} className="text-blue-600 hover:underline text-sm">
            &larr; Back to Strategy
          </Link>
          <h1 className="text-3xl font-bold mt-1">Edit Strategy</h1>
        </div>
        <StrategyForm
          onSubmit={handleOverwrite}
          onSaveAsNew={handleSaveAsNew}
          initialData={initialData}
          submitLabel="Overwrite"
        />
      </div>
    </div>
  );
}
