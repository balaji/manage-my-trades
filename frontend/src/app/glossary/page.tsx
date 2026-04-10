'use client';

import Link from 'next/link';

import { StrategyInspirationList } from '@/components/strategies/StrategyInspirationList';

export default function GlossaryPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/strategies" className="mb-2 inline-block text-blue-600 hover:underline">
          ← Back to Strategies
        </Link>
        <h1 className="text-3xl font-bold">Glossary</h1>
        <p className="mt-2 text-gray-600">Definitions and examples.</p>
      </div>

      <StrategyInspirationList description="Browse popular strategy archetypes and technical-indicator ideas you can adapt into your own setups." />
    </div>
  );
}
