/**
 * TypeScript types for strategies, signals, and indicators.
 */

export enum StrategyType {
  TECHNICAL = 'technical',
  ML = 'ml',
  COMBINED = 'combined',
}

export enum SignalType {
  BUY = 'buy',
  SELL = 'sell',
  HOLD = 'hold',
}

export enum IndicatorUsage {
  ENTRY = 'entry',
  EXIT = 'exit',
  FILTER = 'filter',
}

export interface StrategyIndicatorConfig {
  indicator_name: string;
  parameters: Record<string, any>;
  usage: IndicatorUsage;
}

export interface StrategyIndicator {
  id: number;
  strategy_id: number;
  indicator_name: string;
  parameters: Record<string, any>;
  usage: string;
  created_at: string;
  updated_at: string;
}

export interface Strategy {
  id: number;
  name: string;
  description: string | null;
  strategy_type: string;
  is_active: boolean;
  config: Record<string, any>;
  indicators: StrategyIndicator[];
  created_at: string;
  updated_at: string;
}

export interface StrategyCreate {
  name: string;
  description?: string;
  strategy_type: StrategyType;
  config: Record<string, any>;
  indicators: StrategyIndicatorConfig[];
}

export interface StrategyUpdate {
  name?: string;
  description?: string;
  strategy_type?: StrategyType;
  is_active?: boolean;
  config?: Record<string, any>;
  indicators?: StrategyIndicatorConfig[];
}

export interface StrategyListResponse {
  strategies: Strategy[];
  total: number;
}

export interface Signal {
  id: number;
  backtest_result_id: number;
  symbol: string;
  signal_type: string;
  timestamp: string;
  price: number;
  strength: number | null;
  indicators: Record<string, any>;
  metadata_: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface SignalListResponse {
  signals: Signal[];
  total: number;
}

export interface GetStrategiesParams {
  skip?: number;
  limit?: number;
  is_active?: boolean;
  strategy_type?: string;
}

/**
 * Get human-readable label for strategy type.
 */
export function getStrategyTypeLabel(type: StrategyType): string {
  switch (type) {
    case StrategyType.TECHNICAL:
      return 'Technical';
    case StrategyType.ML:
      return 'Machine Learning';
    case StrategyType.COMBINED:
      return 'Combined';
    default:
      return type;
  }
}

/**
 * Get human-readable label for signal type.
 */
export function getSignalTypeLabel(type: SignalType): string {
  switch (type) {
    case SignalType.BUY:
      return 'Buy';
    case SignalType.SELL:
      return 'Sell';
    case SignalType.HOLD:
      return 'Hold';
    default:
      return type;
  }
}

/**
 * Get CSS color class for signal type.
 */
export function getSignalTypeColor(type: SignalType | string): string {
  switch (type) {
    case SignalType.BUY:
      return 'text-green-500';
    case SignalType.SELL:
      return 'text-red-500';
    case SignalType.HOLD:
      return 'text-yellow-500';
    default:
      return 'text-gray-500';
  }
}

/**
 * Format signal strength as a percentage string.
 */
export function formatSignalStrength(strength: number | null): string {
  if (strength === null || strength === undefined) return 'N/A';
  return `${(strength * 100).toFixed(1)}%`;
}
