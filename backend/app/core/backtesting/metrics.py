"""Performance metrics calculator for backtesting."""

from typing import List, Tuple, Dict, Any, Optional
from datetime import date
import numpy as np
from app.models.trade import Trade


class MetricsCalculator:
    """Calculate backtest performance metrics."""

    @staticmethod
    def calculate_total_return(initial_capital: float, final_capital: float) -> Tuple[float, float]:
        """
        Calculate total return (absolute and percentage).

        Args:
            initial_capital: Starting capital
            final_capital: Ending capital

        Returns:
            Tuple of (absolute_return, percentage_return)
        """
        absolute_return = final_capital - initial_capital

        if initial_capital > 0:
            percentage_return = (absolute_return / initial_capital) * 100
        else:
            percentage_return = 0.0

        return absolute_return, percentage_return

    @staticmethod
    def calculate_sharpe_ratio(equity_curve: List[Tuple[date, float]], risk_free_rate: float = 0.02) -> Optional[float]:
        """
        Calculate annualized Sharpe ratio.

        Sharpe Ratio = (Mean Return - Risk Free Rate) / Std Dev of Returns
        Annualized assuming 252 trading days.

        Args:
            equity_curve: List of (timestamp, equity) tuples
            risk_free_rate: Annual risk-free rate (default: 0.02 = 2%)

        Returns:
            Annualized Sharpe ratio, or None if insufficient data
        """
        if len(equity_curve) < 2:
            return None

        # Extract equity values
        equity_values = [equity for _, equity in equity_curve]

        # Calculate daily returns
        returns = []
        for i in range(1, len(equity_values)):
            if equity_values[i - 1] > 0:
                daily_return = (equity_values[i] - equity_values[i - 1]) / equity_values[i - 1]
                returns.append(daily_return)

        if len(returns) < 2:
            return None

        # Calculate statistics
        mean_return = np.mean(returns)
        std_return = np.std(returns, ddof=1)  # Sample standard deviation

        if std_return == 0:
            return None

        # Calculate daily risk-free rate
        daily_risk_free_rate = risk_free_rate / 252

        # Calculate Sharpe ratio
        sharpe = (mean_return - daily_risk_free_rate) / std_return

        # Annualize (multiply by sqrt of periods per year)
        annualized_sharpe = sharpe * np.sqrt(252)

        return float(annualized_sharpe)

    @staticmethod
    def calculate_max_drawdown(equity_curve: List[Tuple[date, float]]) -> Tuple[float, float]:
        """
        Calculate maximum drawdown (peak to trough decline).

        Args:
            equity_curve: List of (timestamp, equity) tuples

        Returns:
            Tuple of (max_drawdown_dollars, max_drawdown_percentage)
        """
        if len(equity_curve) < 2:
            return 0.0, 0.0

        # Extract equity values
        equity_values = [equity for _, equity in equity_curve]

        max_drawdown_dollars = 0.0
        max_drawdown_pct = 0.0
        peak = equity_values[0]

        for equity in equity_values:
            # Update peak if we have a new high
            if equity > peak:
                peak = equity

            # Calculate drawdown from peak
            drawdown = peak - equity
            drawdown_pct = (drawdown / peak * 100) if peak > 0 else 0.0

            # Update max drawdown
            if drawdown > max_drawdown_dollars:
                max_drawdown_dollars = drawdown
                max_drawdown_pct = drawdown_pct

        return max_drawdown_dollars, max_drawdown_pct

    @staticmethod
    def calculate_win_rate(trades: List[Trade]) -> float:
        """
        Calculate percentage of winning trades.

        Args:
            trades: List of Trade objects

        Returns:
            Win rate as percentage (0-100)
        """
        if not trades:
            return 0.0

        # Only count closed trades with P&L
        closed_trades = [t for t in trades if t.status == "closed" and t.pnl is not None]

        if not closed_trades:
            return 0.0

        winning_trades = sum(1 for t in closed_trades if t.pnl > 0)
        win_rate = winning_trades / len(closed_trades)

        return win_rate

    @staticmethod
    def calculate_profit_factor(trades: List[Trade]) -> Optional[float]:
        """
        Calculate profit factor (gross profits / gross losses).

        Args:
            trades: List of Trade objects

        Returns:
            Profit factor, or None if no losing trades
        """
        if not trades:
            return None

        # Only count closed trades with P&L
        closed_trades = [t for t in trades if t.status == "closed" and t.pnl is not None]

        if not closed_trades:
            return None

        gross_profit = sum(t.pnl for t in closed_trades if t.pnl > 0)
        gross_loss = abs(sum(t.pnl for t in closed_trades if t.pnl < 0))

        if gross_loss == 0:
            return None  # No losing trades: undefined, not infinity

        profit_factor = gross_profit / gross_loss

        return profit_factor

    @staticmethod
    def calculate_trade_statistics(trades: List[Trade]) -> Dict[str, Any]:
        """
        Calculate detailed trade statistics.

        Args:
            trades: List of Trade objects

        Returns:
            Dictionary with trade statistics:
                - total_trades: Total number of trades
                - winning_trades: Number of winning trades
                - losing_trades: Number of losing trades
                - avg_win: Average winning trade P&L
                - avg_loss: Average losing trade P&L
                - largest_win: Largest winning trade P&L
                - largest_loss: Largest losing trade P&L
                - avg_trade_duration: Average trade duration in hours
                - avg_win_duration: Average winning trade duration
                - avg_loss_duration: Average losing trade duration
        """
        if not trades:
            return {
                "total_trades": 0,
                "winning_trades": 0,
                "losing_trades": 0,
                "avg_win": None,
                "avg_loss": None,
                "largest_win": None,
                "largest_loss": None,
                "avg_trade_duration": None,
                "avg_win_duration": None,
                "avg_loss_duration": None,
            }

        # Filter closed trades
        closed_trades = [t for t in trades if t.status == "closed" and t.pnl is not None]

        if not closed_trades:
            return {
                "total_trades": len(trades),
                "winning_trades": 0,
                "losing_trades": 0,
                "avg_win": None,
                "avg_loss": None,
                "largest_win": None,
                "largest_loss": None,
                "avg_trade_duration": None,
                "avg_win_duration": None,
                "avg_loss_duration": None,
            }

        # Separate winning and losing trades
        winning_trades = [t for t in closed_trades if t.pnl > 0]
        losing_trades = [t for t in closed_trades if t.pnl < 0]

        # Calculate P&L statistics
        avg_win = np.mean([t.pnl for t in winning_trades]) if winning_trades else None
        avg_loss = np.mean([t.pnl for t in losing_trades]) if losing_trades else None
        largest_win = max([t.pnl for t in winning_trades]) if winning_trades else None
        largest_loss = min([t.pnl for t in losing_trades]) if losing_trades else None

        # Calculate duration statistics
        def calculate_duration(trade: Trade) -> Optional[float]:
            """Calculate trade duration in hours."""
            if trade.entry_date and trade.exit_date:
                duration = trade.exit_date - trade.entry_date
                return duration.total_seconds() / 3600  # Convert to hours
            return None

        durations = [d for t in closed_trades if (d := calculate_duration(t)) is not None]
        win_durations = [d for t in winning_trades if (d := calculate_duration(t)) is not None]
        loss_durations = [d for t in losing_trades if (d := calculate_duration(t)) is not None]

        avg_trade_duration = np.mean(durations) if durations else None
        avg_win_duration = np.mean(win_durations) if win_durations else None
        avg_loss_duration = np.mean(loss_durations) if loss_durations else None

        return {
            "total_trades": len(closed_trades),
            "winning_trades": len(winning_trades),
            "losing_trades": len(losing_trades),
            "avg_win": float(avg_win) if avg_win is not None else None,
            "avg_loss": float(avg_loss) if avg_loss is not None else None,
            "largest_win": float(largest_win) if largest_win is not None else None,
            "largest_loss": float(largest_loss) if largest_loss is not None else None,
            "avg_trade_duration": float(avg_trade_duration) if avg_trade_duration is not None else None,
            "avg_win_duration": float(avg_win_duration) if avg_win_duration is not None else None,
            "avg_loss_duration": float(avg_loss_duration) if avg_loss_duration is not None else None,
        }

    @staticmethod
    def calculate_all_metrics(
        initial_capital: float,
        final_capital: float,
        equity_curve: List[Tuple[date, float]],
        trades: List[Trade],
        risk_free_rate: float = 0.02,
    ) -> Dict[str, Any]:
        """
        Calculate all performance metrics.

        Args:
            initial_capital: Starting capital
            final_capital: Ending capital
            equity_curve: List of (timestamp, equity) tuples
            trades: List of Trade objects
            risk_free_rate: Annual risk-free rate (default: 0.02 = 2%)

        Returns:
            Dictionary with all metrics
        """
        # Returns
        total_return, total_return_pct = MetricsCalculator.calculate_total_return(initial_capital, final_capital)

        # Risk metrics
        sharpe_ratio = MetricsCalculator.calculate_sharpe_ratio(equity_curve, risk_free_rate)
        max_dd, max_dd_pct = MetricsCalculator.calculate_max_drawdown(equity_curve)

        # Trade metrics
        win_rate = MetricsCalculator.calculate_win_rate(trades)
        profit_factor = MetricsCalculator.calculate_profit_factor(trades)
        trade_stats = MetricsCalculator.calculate_trade_statistics(trades)

        return {
            # Return metrics
            "total_return": total_return,
            "total_return_pct": total_return_pct,
            "final_capital": final_capital,
            # Risk metrics
            "sharpe_ratio": sharpe_ratio,
            "max_drawdown": max_dd,
            "max_drawdown_pct": max_dd_pct,
            # Trade metrics
            "win_rate": win_rate,
            "profit_factor": profit_factor,
            "total_trades": trade_stats["total_trades"],
            "winning_trades": trade_stats["winning_trades"],
            "losing_trades": trade_stats["losing_trades"],
            "avg_win": trade_stats["avg_win"],
            "avg_loss": trade_stats["avg_loss"],
            "largest_win": trade_stats["largest_win"],
            "largest_loss": trade_stats["largest_loss"],
            "avg_trade_duration": trade_stats["avg_trade_duration"],
        }
