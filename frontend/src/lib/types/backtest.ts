/**
 * TypeScript types for backtests and trades.
 */

export enum BacktestStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
}

export interface BacktestCreate {
  strategy_id: number;
  name: string;
  symbols: string[];
  start_date: string;
  end_date: string;
  initial_capital?: number;
  timeframe?: string;
  commission?: number;
  slippage?: number;
}

export interface BacktestResult {
  total_return: number;
  total_return_pct: number;
  sharpe_ratio: number | null;
  max_drawdown: number;
  max_drawdown_pct: number;
  win_rate: number;
  profit_factor: number | null;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  avg_win: number | null;
  avg_loss: number | null;
  avg_trade_duration: number | null;
  final_capital: number;
  equity_curve: { curve: Array<{ date: string; value: number }> };
}

export interface Backtest {
  id: number;
  strategy_id: number;
  name: string;
  symbols: string[];
  start_date: string;
  end_date: string;
  initial_capital: number;
  timeframe: string;
  commission: number;
  slippage: number;
  status: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  results: BacktestResult | null;
}

export interface BacktestListResponse {
  backtests: Backtest[];
  total: number;
}

export interface BacktestTrade {
  id: number;
  symbol: string;
  side: string;
  entry_date: string;
  entry_price: number;
  quantity: number;
  exit_date: string | null;
  exit_price: number | null;
  pnl: number | null;
  pnl_pct: number | null;
  commission: number;
  status: string;
}

export interface BacktestTradesResponse {
  trades: BacktestTrade[];
  total: number;
}
