"use client";

/**
 * New strategy page.
 */
import React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StrategyForm } from "@/components/strategies/StrategyForm";
import { createStrategy } from "@/lib/api/strategies";
import { StrategyCreate } from "@/lib/types/strategy";

export default function NewStrategyPage() {
  const router = useRouter();

  const handleSubmit = async (data: StrategyCreate) => {
    const strategy = await createStrategy(data);
    router.push(`/strategies/${strategy.id}`);
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href="/strategies"
            className="text-blue-600 hover:underline mb-2 inline-block"
          >
            ← Back to Strategies
          </Link>
          <h1 className="text-3xl font-bold">Create New Strategy</h1>
          <p className="text-gray-600 mt-2">
            Define your trading strategy with indicators and configuration.
          </p>
        </div>

        <StrategyForm onSubmit={handleSubmit} />
      </div>
    </div>
  );
}
