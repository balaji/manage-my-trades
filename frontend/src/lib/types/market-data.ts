/**
 * Market data type definitions.
 */

export interface OHLCVBar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
  trade_count?: number;
}

export interface MarketDataRequest {
  symbols: string[];
  start_date: string;
  end_date: string;
  timeframe?: string;
}

export interface MarketDataResponse {
  symbol: string;
  timeframe: string;
  bars: OHLCVBar[];
}

export interface SymbolInfo {
  symbol: string;
  name: string;
}

export interface SymbolSearchResponse {
  symbols: SymbolInfo[];
}

export interface LatestQuote {
  symbol: string;
  ask_price: number;
  bid_price: number;
  ask_size: number;
  bid_size: number;
  timestamp: string;
}
