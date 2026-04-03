'use client';

import React, { useState } from 'react';

import { compileStrategy } from '@/lib/api/strategies';
import { StrategyCreate, StrategySpec, StrategyType } from '@/lib/types/strategy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface StrategyFormProps {
  onSubmit: (data: StrategyCreate) => Promise<void>;
  onSaveAsNew?: (data: StrategyCreate) => Promise<void>;
  initialData?: Partial<StrategyCreate>;
  submitLabel?: string;
}

export function StrategyForm({
  onSubmit,
  onSaveAsNew,
  initialData,
  submitLabel = 'Create Strategy',
}: StrategyFormProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [prompt, setPrompt] = useState('');
  const [specJson, setSpecJson] = useState(() =>
    JSON.stringify(initialData?.spec || buildEmptySpec(initialData?.name, initialData?.description), null, 2)
  );
  const [compileSummary, setCompileSummary] = useState<string | null>(null);
  const [promptWarnings, setPromptWarnings] = useState<string[]>([]);
  const [compileWarnings, setCompileWarnings] = useState<string[]>([]);
  const [compiling, setCompiling] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingAsNew, setSavingAsNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildFormData = (): StrategyCreate => {
    const spec = parseSpecJson(specJson);
    if (!spec.metadata) spec.metadata = {};
    spec.metadata.name = name.trim() || spec.metadata.name || 'Unnamed Strategy';
    spec.metadata.description = description.trim() || undefined;

    return {
      name: name.trim(),
      description: description.trim() || undefined,
      strategy_type: StrategyType.TECHNICAL,
      spec,
    };
  };

  const validate = (): string | null => {
    if (!name.trim()) return 'Strategy name is required';
    try {
      parseSpecJson(specJson);
    } catch {
      return 'Invalid JSON in strategy specification';
    }
    return null;
  };

  const handleCompile = async () => {
    if (!prompt.trim()) {
      setError('Enter a natural-language request to compile');
      return;
    }

    setCompiling(true);
    setError(null);
    try {
      const response = await compileStrategy({
        prompt: prompt.trim(),
        name: name.trim() || undefined,
        description: description.trim() || undefined,
      });
      setSpecJson(JSON.stringify(response.normalized_spec, null, 2));
      setCompileSummary(response.summary);
      setPromptWarnings(response.prompt_warnings || []);
      setCompileWarnings(response.warnings);
      if (!name.trim() && response.normalized_spec?.metadata?.name) {
        setName(response.normalized_spec.metadata.name);
      }
      if (!description.trim() && response.normalized_spec?.metadata?.description) {
        setDescription(response.normalized_spec.metadata.description);
      }
    } catch (err: any) {
      setPromptWarnings([]);
      setCompileWarnings([]);
      setError(err.message || 'Failed to compile strategy');
    } finally {
      setCompiling(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(buildFormData());
    } catch (err: any) {
      setError(err.message || 'Failed to submit strategy');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAsNew = async () => {
    if (!onSaveAsNew) return;

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSavingAsNew(true);
    try {
      await onSaveAsNew(buildFormData());
    } catch (err: any) {
      setError(err.message || 'Failed to save as new strategy');
    } finally {
      setSavingAsNew(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Strategy Name *</label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., RSI Mean Reversion"
                required
                className="w-full"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                rows={3}
                placeholder="Describe your trading strategy..."
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Strategy Type</label>
              <Input type="text" value="Technical" disabled className="w-full" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Natural Language Compiler</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Describe the Strategy</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                rows={6}
                placeholder="Buy SPY when 14-day RSI falls below 30, sell when it rises above 70, use 10% position sizing on daily bars."
              />
              <p className="mt-2 text-sm text-muted-foreground">
                The compiler returns a draft technical strategy spec. Review the generated JSON before saving.
              </p>
            </div>

            <Button type="button" onClick={handleCompile} disabled={compiling}>
              {compiling ? 'Compiling...' : 'Compile Strategy'}
            </Button>

            {compileSummary && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-900">{compileSummary}</div>
            )}

            {promptWarnings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="mb-2 font-medium text-amber-900">Prompt Warnings</div>
                <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800">
                  {promptWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {compileWarnings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="mb-2 font-medium text-amber-900">Warnings</div>
                <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800">
                  {compileWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Strategy Spec</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            value={specJson}
            onChange={(e) => setSpecJson(e.target.value)}
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            rows={24}
          />
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={submitting} size="lg">
          {submitting ? 'Saving...' : submitLabel}
        </Button>

        {onSaveAsNew && (
          <Button type="button" variant="outline" size="lg" onClick={handleSaveAsNew} disabled={savingAsNew}>
            {savingAsNew ? 'Saving Copy...' : 'Save As New'}
          </Button>
        )}
      </div>
    </form>
  );
}

function parseSpecJson(specJson: string): StrategySpec {
  return JSON.parse(specJson) as StrategySpec;
}

function buildEmptySpec(name?: string, description?: string): StrategySpec {
  return {
    kind: 'technical',
    metadata: {
      name: name || 'New Strategy',
      description: description || '',
      version: 1,
    },
    market: {
      timeframe: '1d',
      symbols: [],
    },
    indicators: [],
    rules: {
      entry: {
        type: 'compare',
        left: { type: 'price', field: 'close' },
        operator: '>',
        right: { type: 'constant', value: 0 },
      },
      exit: {
        type: 'compare',
        left: { type: 'price', field: 'close' },
        operator: '<',
        right: { type: 'constant', value: 0 },
      },
      filters: [],
    },
    risk: {
      position_sizing: {
        method: 'fixed_percentage',
        percentage: 0.1,
      },
      long_only: true,
    },
    execution: {},
  };
}
