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
  const [specJson, setSpecJson] = useState(() => (initialData ? JSON.stringify(initialData.spec, null, 2) : null));
  const [compileSummary, setCompileSummary] = useState<string | null>(null);
  const [promptWarnings, setPromptWarnings] = useState<string[]>([]);
  const [compileWarnings, setCompileWarnings] = useState<string[]>([]);
  const [compiling, setCompiling] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingAsNew, setSavingAsNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildFormData = (specJson: string): StrategyCreate => {
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

  const validate = (specJson: string): string | null => {
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

  const handleSave = async (
    saveCallback: (data: StrategyCreate) => Promise<void>,
    progressFunc: (message: boolean) => void,
    errMsg?: string
  ) => {
    if (!specJson) {
      setError('Compile the strategy to generate a specification before submitting');
      return;
    }
    const validationError = validate(specJson);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    progressFunc(true);
    try {
      await saveCallback(buildFormData(specJson));
    } catch (err: any) {
      setError(err.message || errMsg || 'Failed to save');
    } finally {
      progressFunc(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSave(onSubmit, setSubmitting, 'Failed to submit strategy');
  };

  const handleSaveAsNew = async () => {
    if (!onSaveAsNew) return;
    await handleSave(onSaveAsNew, setSavingAsNew, 'Failed to save copy');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div aria-live="polite" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label htmlFor="strategy-name" className="mb-2 block text-sm font-medium">
                Strategy Name *
              </label>
              <Input
                id="strategy-name"
                name="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
                placeholder="e.g., RSI Mean Reversion…"
                required
                className="w-full"
              />
            </div>

            <div>
              <label htmlFor="strategy-description" className="mb-2 block text-sm font-medium">
                Description
              </label>
              <textarea
                id="strategy-description"
                name="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                autoComplete="off"
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                rows={3}
                placeholder="Describe your trading strategy…"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Describe the Strategy</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label htmlFor="strategy-prompt" className="mb-2 block text-sm font-medium">
                Strategy Request
              </label>
              <textarea
                id="strategy-prompt"
                name="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                autoComplete="off"
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                rows={6}
                placeholder="Buy SPY when 14-day RSI falls below 30, sell when it rises above 70, use 10% position sizing on daily bars…"
              />
              <p className="mt-2 text-sm text-muted-foreground">
                Creates a draft technical strategy spec. Review the generated JSON before saving.
              </p>
            </div>

            <Button type="button" onClick={handleCompile} disabled={compiling}>
              {compiling ? 'Compiling…' : 'Compile'}
            </Button>

            {compileSummary && (
              <div aria-live="polite" className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-900">
                {compileSummary}
              </div>
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

      {specJson && (
        <React.Fragment>
          <Card>
            <CardHeader>
              <CardTitle>Strategy Spec</CardTitle>
            </CardHeader>
            <CardContent>
              <label htmlFor="strategy-spec" className="sr-only">
                Strategy Spec
              </label>
              <textarea
                id="strategy-spec"
                name="specJson"
                value={specJson}
                onChange={(e) => setSpecJson(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                rows={24}
              />
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" disabled={submitting} size="lg">
              {submitting ? 'Saving…' : submitLabel}
            </Button>

            {onSaveAsNew && (
              <Button type="button" variant="outline" size="lg" onClick={handleSaveAsNew} disabled={savingAsNew}>
                {savingAsNew ? 'Saving Copy…' : 'Save As New'}
              </Button>
            )}
          </div>
        </React.Fragment>
      )}
    </form>
  );
}

function parseSpecJson(specJson: string): StrategySpec {
  return JSON.parse(specJson) as StrategySpec;
}
