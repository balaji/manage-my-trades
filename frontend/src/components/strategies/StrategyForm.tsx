'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  StrategyCreate,
  StrategyType,
  StrategyIndicatorConfig,
  IndicatorUsage,
  getStrategyTypeLabel,
} from '@/lib/types/strategy';
import { getIndicators, IndicatorDefinition } from '@/lib/api/indicators';

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
  const [strategyType, setStrategyType] = useState<StrategyType>(initialData?.strategy_type || StrategyType.TECHNICAL);
  const [indicators, setIndicators] = useState<StrategyIndicatorConfig[]>(initialData?.indicators || []);
  const [entryThreshold, setEntryThreshold] = useState<number>(initialData?.config?.entry_threshold ?? 30);
  const [exitThreshold, setExitThreshold] = useState<number>(initialData?.config?.exit_threshold ?? 70);
  const initialPositionSizing = (initialData?.config?.position_sizing as Record<string, any>) || {};
  const [positionSizingMethod, setPositionSizingMethod] = useState<string>(
    initialPositionSizing.method || 'fixed_percentage'
  );
  const [positionSizingPercentage, setPositionSizingPercentage] = useState<number>(
    (initialPositionSizing.percentage ?? 0.1) * 100
  );
  const [positionSizingAmount, setPositionSizingAmount] = useState<number>(initialPositionSizing.amount ?? 1000);
  const [positionSizingNumPositions, setPositionSizingNumPositions] = useState<number>(
    initialPositionSizing.num_positions ?? 5
  );

  const [advancedJson, setAdvancedJson] = useState(() => {
    const cfg = { ...(initialData?.config || {}) };
    delete cfg.entry_threshold;
    delete cfg.exit_threshold;
    delete cfg.position_sizing;
    const keys = Object.keys(cfg);
    return keys.length > 0 ? JSON.stringify(cfg, null, 2) : '';
  });
  const [showAdvanced, setShowAdvanced] = useState(() => {
    const cfg = { ...(initialData?.config || {}) };
    delete cfg.entry_threshold;
    delete cfg.exit_threshold;
    delete cfg.position_sizing;
    return Object.keys(cfg).length > 0;
  });
  const [submitting, setSubmitting] = useState(false);
  const [savingAsNew, setSavingAsNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [registry, setRegistry] = useState<IndicatorDefinition[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getIndicators().then(setRegistry).catch(console.error);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredIndicators = registry.filter(
    (ind) =>
      ind.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ind.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectIndicator = (ind: IndicatorDefinition) => {
    const defaultParams: Record<string, any> = {};
    ind.parameters.forEach((p) => {
      defaultParams[p.name] = p.default;
    });
    setIndicators([
      ...indicators,
      {
        indicator_name: ind.name,
        parameters: defaultParams,
        usage: IndicatorUsage.ENTRY,
      },
    ]);
    setSearchQuery('');
    setShowDropdown(false);
  };

  const handleRemoveIndicator = (index: number) => {
    setIndicators(indicators.filter((_, i) => i !== index));
  };

  const handleUpdateIndicatorUsage = (index: number, usage: IndicatorUsage) => {
    const updated = [...indicators];
    updated[index] = { ...updated[index], usage };
    setIndicators(updated);
  };

  const handleUpdateIndicatorParam = (index: number, param: string, value: number) => {
    const updated = [...indicators];
    updated[index] = {
      ...updated[index],
      parameters: { ...updated[index].parameters, [param]: value },
    };
    setIndicators(updated);
  };

  const getRegistryDef = (name: string) => registry.find((r) => r.name === name);

  const buildConfig = (): Record<string, any> => {
    const cfg: Record<string, any> = {};
    if (strategyType === StrategyType.TECHNICAL) {
      cfg.entry_threshold = entryThreshold;
      cfg.exit_threshold = exitThreshold;
    }
    const positionSizing: Record<string, any> = { method: positionSizingMethod };
    if (positionSizingMethod === 'fixed_percentage') {
      positionSizing.percentage = positionSizingPercentage / 100;
    } else if (positionSizingMethod === 'fixed_amount') {
      positionSizing.amount = positionSizingAmount;
    } else if (positionSizingMethod === 'equal_weight') {
      positionSizing.num_positions = positionSizingNumPositions;
    }
    cfg.position_sizing = positionSizing;
    if (advancedJson.trim()) {
      try {
        Object.assign(cfg, JSON.parse(advancedJson));
      } catch {
        // will be caught in validation
      }
    }
    return cfg;
  };

  const buildFormData = (): StrategyCreate => ({
    name: name.trim(),
    description: description.trim() || undefined,
    strategy_type: strategyType,
    config: buildConfig(),
    indicators,
  });

  const validate = (): string | null => {
    if (!name.trim()) return 'Strategy name is required';
    if (advancedJson.trim()) {
      try {
        JSON.parse(advancedJson);
      } catch {
        return 'Invalid JSON in advanced configuration';
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setError(err);
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
    const err = validate();
    if (err) {
      setError(err);
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
      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>}

      {/* Basic Information */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Strategy Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., RSI Mean Reversion"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder="Describe your trading strategy..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Strategy Type *</label>
            <select
              value={strategyType}
              onChange={(e) => setStrategyType(e.target.value as StrategyType)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {Object.values(StrategyType).map((type) => (
                <option key={type} value={type}>
                  {getStrategyTypeLabel(type)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Indicators */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Indicators</h2>

        {/* Autocomplete search */}
        <div className="flex gap-2 mb-4" ref={searchRef}>
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Type to search indicators..."
            />
            {showDropdown && searchQuery.length === 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {registry.map((ind) => (
                  <button
                    key={ind.name}
                    type="button"
                    onClick={() => handleSelectIndicator(ind)}
                    className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b last:border-b-0"
                  >
                    <div className="font-medium text-sm">{ind.label}</div>
                    <div className="text-xs text-gray-500">{ind.description}</div>
                  </button>
                ))}
              </div>
            )}
            {showDropdown && searchQuery.length > 0 && filteredIndicators.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredIndicators.map((ind) => (
                  <button
                    key={ind.name}
                    type="button"
                    onClick={() => handleSelectIndicator(ind)}
                    className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b last:border-b-0"
                  >
                    <div className="font-medium text-sm">{ind.label}</div>
                    <div className="text-xs text-gray-500">{ind.description}</div>
                  </button>
                ))}
              </div>
            )}
            {showDropdown && searchQuery.length > 0 && filteredIndicators.length === 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg p-3 text-sm text-gray-500">
                No matching indicators
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg font-bold"
            title="Browse indicators"
          >
            +
          </button>
        </div>

        {indicators.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No indicators added yet. Search above to add one.</p>
        ) : (
          <div className="space-y-4">
            {indicators.map((indicator, index) => {
              const def = getRegistryDef(indicator.indicator_name);
              return (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold text-lg capitalize">{def?.label || indicator.indicator_name}</h3>
                    <button
                      type="button"
                      onClick={() => handleRemoveIndicator(index)}
                      className="text-red-600 hover:text-red-800 text-xl leading-none"
                      title="Remove indicator"
                    >
                      &times;
                    </button>
                  </div>

                  {def ? (
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      {def.parameters.map((param) => (
                        <div key={param.name}>
                          <label className="block text-sm font-medium mb-1">{param.label}</label>
                          <input
                            type="number"
                            value={indicator.parameters[param.name] ?? param.default}
                            onChange={(e) =>
                              handleUpdateIndicatorParam(index, param.name, parseFloat(e.target.value) || 0)
                            }
                            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                          />
                          <p className="text-xs text-gray-500 mt-1">{param.description}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mb-3">
                      <label className="block text-sm font-medium mb-1">Parameters (JSON)</label>
                      <textarea
                        value={JSON.stringify(indicator.parameters, null, 2)}
                        onChange={(e) => {
                          try {
                            const parsed = JSON.parse(e.target.value);
                            const updated = [...indicators];
                            updated[index] = { ...updated[index], parameters: parsed };
                            setIndicators(updated);
                          } catch {
                            // keep editing
                          }
                        }}
                        className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                        rows={3}
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium mb-1">Usage</label>
                    <select
                      value={indicator.usage}
                      onChange={(e) => handleUpdateIndicatorUsage(index, e.target.value as IndicatorUsage)}
                      className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={IndicatorUsage.ENTRY}>Entry</option>
                      <option value={IndicatorUsage.EXIT}>Exit</option>
                      <option value={IndicatorUsage.FILTER}>Filter</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Configuration */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Configuration</h2>

        {strategyType === StrategyType.TECHNICAL && (
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Entry Threshold</label>
              <input
                type="number"
                value={entryThreshold}
                onChange={(e) => setEntryThreshold(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Signal to buy when indicator drops below this value (e.g. RSI &lt; 30)
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Exit Threshold</label>
              <input
                type="number"
                value={exitThreshold}
                onChange={(e) => setExitThreshold(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Signal to sell when indicator rises above this value (e.g. RSI &gt; 70)
              </p>
            </div>
          </div>
        )}

        {/* Position Sizing */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-3">Position Sizing</h3>
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">Method</label>
            <select
              value={positionSizingMethod}
              onChange={(e) => setPositionSizingMethod(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="fixed_percentage">Fixed Percentage</option>
              <option value="fixed_amount">Fixed Amount</option>
              <option value="equal_weight">Equal Weight</option>
            </select>
          </div>
          {positionSizingMethod === 'fixed_percentage' && (
            <div>
              <label className="block text-sm font-medium mb-1">Percentage of Portfolio (%)</label>
              <input
                type="number"
                min={0.1}
                max={100}
                step={0.1}
                value={positionSizingPercentage}
                onChange={(e) => setPositionSizingPercentage(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Allocate this % of portfolio equity per trade (default: 10%)</p>
            </div>
          )}
          {positionSizingMethod === 'fixed_amount' && (
            <div>
              <label className="block text-sm font-medium mb-1">Amount ($)</label>
              <input
                type="number"
                min={1}
                step={1}
                value={positionSizingAmount}
                onChange={(e) => setPositionSizingAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Fixed dollar amount to allocate per trade</p>
            </div>
          )}
          {positionSizingMethod === 'equal_weight' && (
            <div>
              <label className="block text-sm font-medium mb-1">Number of Positions</label>
              <input
                type="number"
                min={1}
                step={1}
                value={positionSizingNumPositions}
                onChange={(e) => setPositionSizingNumPositions(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Divide portfolio equally across this many positions</p>
            </div>
          )}
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-blue-600 hover:underline mb-2"
          >
            {showAdvanced ? 'Hide' : 'Show'} Advanced JSON
          </button>
          {showAdvanced && (
            <div>
              <textarea
                value={advancedJson}
                onChange={(e) => setAdvancedJson(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                rows={6}
                placeholder='{"custom_field": "value"}'
              />
              <p className="text-sm text-gray-500 mt-1">
                Additional strategy-specific configuration as JSON. Merged with the fields above.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Submit Buttons */}
      <div className="flex gap-4">
        <button
          type="submit"
          disabled={submitting || savingAsNew}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {submitting ? 'Submitting...' : submitLabel}
        </button>
        {onSaveAsNew && (
          <button
            type="button"
            onClick={handleSaveAsNew}
            disabled={submitting || savingAsNew}
            className="px-6 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 disabled:border-gray-400 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            {savingAsNew ? 'Saving...' : 'Save as New'}
          </button>
        )}
      </div>
    </form>
  );
}
