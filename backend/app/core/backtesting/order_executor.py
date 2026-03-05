"""Order execution simulator with slippage and commission."""

from typing import Tuple
from app.core.backtesting.portfolio import PortfolioState


class OrderExecutor:
    """Simulates realistic order execution with slippage and commission."""

    def __init__(self, commission: float = 0.0, slippage: float = 0.001):
        """
        Initialize order executor.

        Args:
            commission: Commission per trade (default: 0.0 for Alpaca)
            slippage: Slippage percentage (default: 0.001 = 0.1%)
        """
        self.commission = commission
        self.slippage = slippage

    def calculate_execution_price(self, signal_price: float, side: str) -> float:
        """
        Apply slippage to signal price.

        Buy orders: price * (1 + slippage) - worse execution
        Sell orders: price * (1 - slippage) - worse execution

        Args:
            signal_price: Price from signal
            side: 'buy' or 'sell'

        Returns:
            Execution price with slippage applied
        """
        if side.lower() == "buy":
            return signal_price * (1 + self.slippage)
        elif side.lower() == "sell":
            return signal_price * (1 - self.slippage)
        else:
            raise ValueError(f"Invalid side: {side}. Must be 'buy' or 'sell'")

    def calculate_commission(self, price: float, quantity: float) -> float:
        """
        Calculate commission cost.

        Args:
            price: Execution price
            quantity: Order quantity

        Returns:
            Commission cost
        """
        # For Alpaca, commission is typically 0
        # This can be extended for other brokers with per-share or percentage-based fees
        return self.commission

    def can_execute_order(
        self,
        portfolio: PortfolioState,
        symbol: str,
        quantity: float,
        price: float,
        side: str,
    ) -> Tuple[bool, str]:
        """
        Validate order can execute.

        Args:
            portfolio: Current portfolio state
            symbol: Symbol to trade
            quantity: Order quantity
            price: Execution price (after slippage)
            side: 'buy' or 'sell'

        Returns:
            Tuple of (can_execute: bool, reason: str)
        """
        if quantity <= 0:
            return False, f"Invalid quantity: {quantity}"

        if price <= 0:
            return False, f"Invalid price: {price}"

        if side.lower() == "buy":
            commission = self.calculate_commission(price, quantity)
            total_cost = (quantity * price) + commission

            if portfolio.cash < total_cost:
                return (
                    False,
                    f"Insufficient cash. Need ${total_cost:.2f}, have ${portfolio.cash:.2f}",
                )

            return True, "OK"

        elif side.lower() == "sell":
            if not portfolio.has_position(symbol):
                return False, f"No position in {symbol} to sell"

            position = portfolio.get_position(symbol)
            if position.quantity < quantity:
                return (
                    False,
                    f"Insufficient shares. Trying to sell {quantity}, have {position.quantity}",
                )

            return True, "OK"

        else:
            return False, f"Invalid side: {side}. Must be 'buy' or 'sell'"

    def execute_buy(
        self,
        portfolio: PortfolioState,
        symbol: str,
        quantity: float,
        signal_price: float,
        timestamp,
    ):
        """
        Execute buy order with slippage and commission.

        Args:
            portfolio: Portfolio state to update
            symbol: Symbol to buy
            quantity: Quantity to buy
            signal_price: Price from signal
            timestamp: Execution timestamp

        Returns:
            Trade object
        """
        # Calculate execution price with slippage
        exec_price = self.calculate_execution_price(signal_price, "buy")
        commission = self.calculate_commission(exec_price, quantity)

        # Validate order
        can_execute, reason = self.can_execute_order(portfolio, symbol, quantity, exec_price, "buy")
        if not can_execute:
            raise ValueError(f"Cannot execute buy order: {reason}")

        # Execute on portfolio
        trade = portfolio.execute_buy(symbol, quantity, exec_price, commission, timestamp)

        return trade

    def execute_sell(
        self,
        portfolio: PortfolioState,
        symbol: str,
        quantity: float,
        signal_price: float,
        timestamp,
    ):
        """
        Execute sell order with slippage and commission.

        Args:
            portfolio: Portfolio state to update
            symbol: Symbol to sell
            quantity: Quantity to sell (None = sell all)
            signal_price: Price from signal
            timestamp: Execution timestamp

        Returns:
            Tuple of (Trade object, realized_pnl, realized_pnl_pct)
        """
        # Calculate execution price with slippage
        exec_price = self.calculate_execution_price(signal_price, "sell")
        commission = self.calculate_commission(exec_price, quantity)

        # Validate order
        can_execute, reason = self.can_execute_order(portfolio, symbol, quantity, exec_price, "sell")
        if not can_execute:
            raise ValueError(f"Cannot execute sell order: {reason}")

        # Execute on portfolio
        trade, pnl, pnl_pct = portfolio.execute_sell(symbol, quantity, exec_price, commission, timestamp)

        return trade, pnl, pnl_pct

    def __repr__(self) -> str:
        """String representation of order executor."""
        return f"OrderExecutor(commission=${self.commission:.4f}, slippage={self.slippage * 100:.2f}%)"
