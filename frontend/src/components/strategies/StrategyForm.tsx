"use client";

/**
 * Strategy form component for creating and editing strategies.
 */
import React, { useState } from "react";
import {
  StrategyCreate,
  StrategyType,
  StrategyIndicatorConfig,
  IndicatorUsage,
  getStrategyTypeLabel,
} from "@/lib/types/strategy";

interface StrategyFormProps {
  onSubmit: (data: StrategyCreate) => Promise<void>;
  initialData?: Partial<StrategyCreate>;
  submitLabel?: string;
}

const AVAILABLE_INDICATORS = [
  {
    value: "sma",
    label: "Simple Moving Average (SMA)",
    defaultParams: { period: 20 },
  },
  {
    value: "ema",
    label: "Exponential Moving Average (EMA)",
    defaultParams: { period: 20 },
  },
  {
    value: "rsi",
    label: "Relative Strength Index (RSI)",
    defaultParams: { period: 14 },
  },
  {
    value: "macd",
    label: "MACD",
    defaultParams: { fast: 12, slow: 26, signal: 9 },
  },
  {
    value: "bollinger_bands",
    label: "Bollinger Bands",
    defaultParams: { period: 20, std: 2 },
  },
  {
    value: "stochastic",
    label: "Stochastic Oscillator",
    defaultParams: { k_period: 14, d_period: 3 },
  },
  {
    value: "atr",
    label: "Average True Range (ATR)",
    defaultParams: { period: 14 },
  },
];

export function StrategyForm({
  onSubmit,
  initialData,
  submitLabel = "Create Strategy",
}: StrategyFormProps) {
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(
    initialData?.description || "",
  );
  const [strategyType, setStrategyType] = useState<StrategyType>(
    initialData?.strategy_type || StrategyType.TECHNICAL,
  );
  const [indicators, setIndicators] = useState<StrategyIndicatorConfig[]>(
    initialData?.indicators || [],
  );
  const [config, setConfig] = useState<Record<string, any>>(
    initialData?.config || {},
  );
  const [configJson, setConfigJson] = useState(
    JSON.stringify(initialData?.config || {}, null, 2),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddIndicator = () => {
    setIndicators([
      ...indicators,
      {
        indicator_name: "rsi",
        parameters: { period: 14 },
        usage: IndicatorUsage.ENTRY,
      },
    ]);
  };

  const handleRemoveIndicator = (index: number) => {
    setIndicators(indicators.filter((_, i) => i !== index));
  };

  const handleUpdateIndicator = (
    index: number,
    field: keyof StrategyIndicatorConfig,
    value: any,
  ) => {
    const updated = [...indicators];
    updated[index] = { ...updated[index], [field]: value };
    setIndicators(updated);
  };

  const handleUpdateIndicatorParam = (
    index: number,
    param: string,
    value: any,
  ) => {
    const updated = [...indicators];
    updated[index] = {
      ...updated[index],
      parameters: { ...updated[index].parameters, [param]: value },
    };
    setIndicators(updated);
  };

  const handleConfigChange = (value: string) => {
    setConfigJson(value);
    try {
      const parsed = JSON.parse(value);
      setConfig(parsed);
      setError(null);
    } catch (err) {
      setError("Invalid JSON configuration");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Strategy name is required");
      return;
    }

    try {
      JSON.parse(configJson);
    } catch (err) {
      setError("Invalid JSON configuration");
      return;
    }

    setSubmitting(true);

    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        strategy_type: strategyType,
        config: JSON.parse(configJson),
        indicators,
      });
    } catch (err: any) {
      setError(err.message || "Failed to submit strategy");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Basic Information */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Strategy Name *
            </label>
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
            <label className="block text-sm font-medium mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder="Describe your trading strategy..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Strategy Type *
            </label>
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
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Indicators</h2>
          <button
            type="button"
            onClick={handleAddIndicator}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            Add Indicator
          </button>
        </div>

        {indicators.length === 0 ? (
          <p className="text-gray-500 text-center py-4">
            No indicators added yet. Click &quot;Add Indicator&quot; to get
            started.
          </p>
        ) : (
          <div className="space-y-4">
            {indicators.map((indicator, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold">Indicator {index + 1}</h3>
                  <button
                    type="button"
                    onClick={() => handleRemoveIndicator(index)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Indicator Type
                    </label>
                    <select
                      value={indicator.indicator_name}
                      onChange={(e) => {
                        const selected = AVAILABLE_INDICATORS.find(
                          (i) => i.value === e.target.value,
                        );
                        handleUpdateIndicator(
                          index,
                          "indicator_name",
                          e.target.value,
                        );
                        if (selected) {
                          handleUpdateIndicator(
                            index,
                            "parameters",
                            selected.defaultParams,
                          );
                        }
                      }}
                      className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                    >
                      {AVAILABLE_INDICATORS.map((ind) => (
                        <option key={ind.value} value={ind.value}>
                          {ind.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Usage
                    </label>
                    <select
                      value={indicator.usage}
                      onChange={(e) =>
                        handleUpdateIndicator(
                          index,
                          "usage",
                          e.target.value as IndicatorUsage,
                        )
                      }
                      className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={IndicatorUsage.ENTRY}>Entry</option>
                      <option value={IndicatorUsage.EXIT}>Exit</option>
                      <option value={IndicatorUsage.FILTER}>Filter</option>
                    </select>
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-sm font-medium mb-2">
                    Parameters (JSON)
                  </label>
                  <textarea
                    value={JSON.stringify(indicator.parameters, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        handleUpdateIndicator(index, "parameters", parsed);
                      } catch (err) {
                        // Invalid JSON, keep editing
                      }
                    }}
                    className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    rows={3}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Configuration */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Configuration</h2>
        <div>
          <label className="block text-sm font-medium mb-2">
            Strategy Configuration (JSON)
          </label>
          <textarea
            value={configJson}
            onChange={(e) => handleConfigChange(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            rows={8}
            placeholder='{\n  "entry_threshold": 30,\n  "exit_threshold": 70,\n  "symbols": ["SPY", "QQQ"]\n}'
          />
          <p className="text-sm text-gray-500 mt-2">
            Add strategy-specific configuration like thresholds, symbols,
            position sizing, etc.
          </p>
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex gap-4">
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {submitting ? "Submitting..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
