"""Main backtesting engine for strategy simulation."""

from typing import List, Dict, Tuple
from datetime import date
import logging
import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.backtest import Backtest, BacktestResult
from app.models.strategy import Strategy
from app.models.signal import Signal
from app.models.trade import Trade
from app.core.backtesting.portfolio import PortfolioState
from app.core.backtesting.order_executor import OrderExecutor
from app.core.backtesting.position_sizer import PositionSizer
from app.core.backtesting.metrics import MetricsCalculator
from app.services.signal_service import SignalService
from app.services.market_data_service import MarketDataService

logger = logging.getLogger(__name__)


class BacktestEngine:
    """Main backtesting engine for simulating trading strategies."""

    def __init__(self, backtest: Backtest, strategy: Strategy):
        """
        Initialize backtest engine.

        Args:
            backtest: Backtest configuration
            strategy: Trading strategy to test
        """
        self.backtest = backtest
        self.strategy = strategy
        self.portfolio = PortfolioState(cash=backtest.initial_capital, timestamp=backtest.start_date)
        self.executor = OrderExecutor(commission=backtest.commission, slippage=backtest.slippage)
        self.position_sizer = PositionSizer()
        self.trades: List[Trade] = []
        self.equity_curve: List[Tuple[date, float]] = []

        # Track open positions for signal matching
        self.open_positions: Dict[str, Trade] = {}  # symbol -> Trade

    async def run(self, db: AsyncSession) -> BacktestResult:
        """
        Execute full backtest simulation.

        Args:
            db: Database session

        Returns:
            BacktestResult with performance metrics
        """
        logger.info(f"Starting backtest {self.backtest.id} for strategy {self.strategy.id}")

        # 1. Fetch historical market data for all symbols
        market_data = await self._fetch_market_data(db)

        if not market_data:
            raise ValueError("No market data available for backtest")

        # 2. Generate signals using existing SignalService
        all_signals = await self._generate_signals(db)

        logger.info(f"Generated {len(all_signals)} total signals")

        # 3. Create unified timeline (merge all symbol timestamps)
        timeline = self._create_timeline(market_data)

        logger.info(f"Timeline has {len(timeline)} data points")

        # 4. Simulate trading: iterate through timeline
        for i, timestamp in enumerate(timeline):
            current_prices = self._get_current_prices(market_data, timestamp)
            signals_at_time = self._get_signals_at_timestamp(all_signals, timestamp)

            # Process sell signals first (free up cash)
            self._process_sell_signals(signals_at_time, current_prices, timestamp)

            # Process buy signals
            self._process_buy_signals(signals_at_time, current_prices, timestamp)

            # Record equity snapshot
            equity = self.portfolio.get_total_equity(current_prices)
            self.equity_curve.append((timestamp, equity))

            # Log progress every 10%
            if i % max(1, len(timeline) // 10) == 0:
                progress = (i / len(timeline)) * 100
                logger.info(f"Backtest progress: {progress:.1f}% - Equity: ${equity:.2f}")

        # 5. Calculate performance metrics
        result = self._calculate_results()

        logger.info(f"Backtest completed: {result.total_trades} trades executed")

        return result

    async def _fetch_market_data(self, db: AsyncSession) -> Dict[str, pd.DataFrame]:
        """
        Fetch OHLCV data for all symbols using MarketDataService.

        Returns:
            Dict mapping symbol to DataFrame with OHLCV data
        """
        market_data_service = MarketDataService(db)
        market_data = {}

        for symbol in self.backtest.symbols:
            try:
                bars = await market_data_service.get_bars(
                    symbols=[symbol],
                    start=self.backtest.start_date,
                    end=self.backtest.end_date,
                )

                if bars and symbol in bars:
                    # Convert to DataFrame
                    df = pd.DataFrame(bars[symbol])
                    df.set_index("timestamp", inplace=True)
                    market_data[symbol] = df
                    logger.info(f"Loaded {len(df)} bars for {symbol}")
                else:
                    logger.warning(f"No data found for {symbol}")

            except Exception as e:
                logger.error(f"Error fetching data for {symbol}: {e}")

        return market_data

    async def _generate_signals(self, db: AsyncSession) -> List[Signal]:
        """
        Generate signals using SignalService for all symbols.

        Returns:
            List of all signals across all symbols
        """
        signal_service = SignalService(db)
        all_signals = []

        for symbol in self.backtest.symbols:
            try:
                signals = await signal_service.generate_signals(
                    strategy=self.strategy,
                    symbol=symbol,
                    start_date=self.backtest.start_date,
                    end_date=self.backtest.end_date,
                )
                all_signals.extend(signals)
                logger.info(f"Generated {len(signals)} signals for {symbol}")

            except Exception as e:
                logger.error(f"Error generating signals for {symbol}: {e}")

        return all_signals

    def _create_timeline(self, market_data: Dict[str, pd.DataFrame]) -> List[date]:
        """
        Create chronologically ordered timeline merging all symbols.

        Args:
            market_data: Dict of symbol -> DataFrame

        Returns:
            Sorted list of unique timestamps
        """
        all_timestamps = set()

        for symbol, df in market_data.items():
            all_timestamps.update(df.index.tolist())

        return sorted(list(all_timestamps))

    def _get_current_prices(self, market_data: Dict[str, pd.DataFrame], timestamp: date) -> Dict[str, float]:
        """
        Get current prices for all symbols at timestamp.

        Uses forward-fill for missing data.

        Args:
            market_data: Dict of symbol -> DataFrame
            timestamp: Current timestamp

        Returns:
            Dict mapping symbol to price
        """
        prices = {}

        for symbol, df in market_data.items():
            # Try to get exact timestamp
            if timestamp in df.index:
                prices[symbol] = float(df.loc[timestamp, "close"])
            else:
                # Forward-fill: use last known price
                earlier_data = df[df.index <= timestamp]
                if not earlier_data.empty:
                    prices[symbol] = float(earlier_data.iloc[-1]["close"])
                else:
                    # Use first available price if timestamp is before data
                    if not df.empty:
                        prices[symbol] = float(df.iloc[0]["close"])

        return prices

    def _get_signals_at_timestamp(self, signals: List[Signal], timestamp: date) -> List[Signal]:
        """
        Get all signals at a specific timestamp.

        Args:
            signals: List of all signals
            timestamp: Target timestamp

        Returns:
            List of signals at timestamp
        """
        return [s for s in signals if s.timestamp == timestamp]

    def _process_buy_signals(self, signals: List[Signal], prices: Dict[str, float], timestamp: date):
        """
        Process buy signals, execute orders, create trades.

        Args:
            signals: Signals at current timestamp
            prices: Current prices for all symbols
            timestamp: Current timestamp
        """
        buy_signals = [s for s in signals if s.signal_type == "buy"]

        for signal in buy_signals:
            symbol = signal.symbol

            # Skip if already have a position
            if self.portfolio.has_position(symbol):
                logger.debug(f"Skipping buy signal for {symbol} - already have position")
                continue

            if symbol not in prices:
                logger.warning(f"No price data for {symbol} at {timestamp}")
                continue

            try:
                # Calculate position size
                size = self._calculate_position_size(symbol, prices[symbol])

                if size <= 0:
                    logger.debug(f"Position size is 0 for {symbol}, skipping")
                    continue

                # Calculate execution price with slippage
                exec_price = self.executor.calculate_execution_price(prices[symbol], "buy")
                commission = self.executor.calculate_commission(exec_price, size)

                # Check if we can execute
                if self.portfolio.can_buy(symbol, size, exec_price, commission):
                    trade = self.portfolio.execute_buy(symbol, size, exec_price, commission, timestamp)
                    trade.backtest_id = self.backtest.id
                    trade.strategy_id = self.strategy.id
                    trade.trade_type = "backtest"
                    self.trades.append(trade)
                    self.open_positions[symbol] = trade

                    logger.debug(f"BUY {size:.2f} {symbol} @ ${exec_price:.2f} (commission: ${commission:.2f})")
                else:
                    logger.debug(
                        f"Insufficient funds for {symbol}: need ${(size * exec_price) + commission:.2f}, "
                        f"have ${self.portfolio.cash:.2f}"
                    )

            except Exception as e:
                logger.error(f"Error processing buy signal for {symbol}: {e}")

    def _process_sell_signals(self, signals: List[Signal], prices: Dict[str, float], timestamp: date):
        """
        Process sell signals, close positions, update trades.

        Args:
            signals: Signals at current timestamp
            prices: Current prices for all symbols
            timestamp: Current timestamp
        """
        sell_signals = [s for s in signals if s.signal_type == "sell"]

        for signal in sell_signals:
            symbol = signal.symbol

            # Skip if no position
            if not self.portfolio.has_position(symbol):
                logger.debug(f"Skipping sell signal for {symbol} - no position")
                continue

            if symbol not in prices:
                logger.warning(f"No price data for {symbol} at {timestamp}")
                continue

            try:
                position = self.portfolio.get_position(symbol)
                quantity = position.quantity

                # Calculate execution price with slippage
                exec_price = self.executor.calculate_execution_price(prices[symbol], "sell")
                commission = self.executor.calculate_commission(exec_price, quantity)

                # Execute sell
                trade, pnl, pnl_pct = self.portfolio.execute_sell(symbol, quantity, exec_price, commission, timestamp)

                # Update the original trade if we're tracking it
                if symbol in self.open_positions:
                    original_trade = self.open_positions[symbol]
                    original_trade.exit_date = timestamp
                    original_trade.exit_price = exec_price
                    original_trade.pnl = pnl
                    original_trade.pnl_pct = pnl_pct
                    original_trade.status = "closed"
                    del self.open_positions[symbol]
                else:
                    # Add as new trade record
                    trade.backtest_id = self.backtest.id
                    trade.strategy_id = self.strategy.id
                    trade.trade_type = "backtest"
                    self.trades.append(trade)

                logger.debug(f"SELL {quantity:.2f} {symbol} @ ${exec_price:.2f} P&L: ${pnl:.2f} ({pnl_pct:.2f}%)")

            except Exception as e:
                logger.error(f"Error processing sell signal for {symbol}: {e}")

    def _calculate_position_size(self, symbol: str, price: float) -> float:
        """
        Calculate position size based on strategy configuration.

        Args:
            symbol: Symbol to size
            price: Current price

        Returns:
            Number of shares to buy
        """
        # Get position sizing config from strategy
        config = self.strategy.config or {}
        position_sizing = config.get("position_sizing", {})
        method = position_sizing.get("method", "fixed_percentage")

        # Get current equity
        current_prices = {symbol: price}
        # Add prices for existing positions
        for pos_symbol, position in self.portfolio.positions.items():
            if pos_symbol not in current_prices:
                current_prices[pos_symbol] = position.current_price

        equity = self.portfolio.get_total_equity(current_prices)

        # Calculate size
        try:
            size = self.position_sizer.calculate_size(
                method=method, portfolio_equity=equity, price=price, config=position_sizing
            )

            # Ensure we don't exceed available cash
            max_size = self.position_sizer.calculate_max_position_size(
                cash=self.portfolio.cash,
                price=price,
                commission=self.executor.commission,
            )

            size = min(size, max_size)

            return size

        except Exception as e:
            logger.error(f"Error calculating position size for {symbol}: {e}")
            return 0.0

    def _calculate_results(self) -> BacktestResult:
        """
        Calculate final metrics using MetricsCalculator.

        Returns:
            BacktestResult with all metrics
        """
        initial_capital = self.backtest.initial_capital
        final_capital = self.equity_curve[-1][1] if self.equity_curve else initial_capital

        # Calculate all metrics
        metrics = MetricsCalculator.calculate_all_metrics(
            initial_capital=initial_capital,
            final_capital=final_capital,
            equity_curve=self.equity_curve,
            trades=self.trades,
        )

        # Convert equity curve to JSON-serializable format
        equity_curve_data = [{"date": ts.strftime("%Y-%m-%d"), "value": float(val)} for ts, val in self.equity_curve]

        # Create result
        result = BacktestResult(
            backtest_id=self.backtest.id,
            total_return=metrics["total_return"],
            total_return_pct=metrics["total_return_pct"],
            sharpe_ratio=metrics["sharpe_ratio"],
            max_drawdown=metrics["max_drawdown"],
            max_drawdown_pct=metrics["max_drawdown_pct"],
            win_rate=metrics["win_rate"],
            profit_factor=metrics["profit_factor"],
            total_trades=metrics["total_trades"],
            winning_trades=metrics["winning_trades"],
            losing_trades=metrics["losing_trades"],
            avg_win=metrics["avg_win"],
            avg_loss=metrics["avg_loss"],
            avg_trade_duration=metrics["avg_trade_duration"],
            final_capital=metrics["final_capital"],
            equity_curve={"curve": equity_curve_data},
        )

        return result
