/**
 * TypeScript types for signals.
 */

export interface Signal {
  id: string;
  symbol: string;
  signal_type: string; // buy, sell, hold
  timestamp: string;
  price: number;
  strength?: number;
  indicators?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface BacktestSignalsResponse {
  signals: Signal[];
  total: number;
}
