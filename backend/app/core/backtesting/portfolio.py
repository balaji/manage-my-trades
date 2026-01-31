"""Portfolio state management for backtesting."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Optional, Tuple
from app.models.trade import Trade


@dataclass
class Position:
    """Single position in a symbol."""

    symbol: str
    quantity: float  # Support fractional shares
    avg_entry_price: float
    entry_date: datetime
    current_price: float = 0.0

    @property
    def market_value(self) -> float:
        """Calculate current market value of position."""
        return self.quantity * self.current_price

    @property
    def cost_basis(self) -> float:
        """Calculate cost basis of position."""
        return self.quantity * self.avg_entry_price

    @property
    def unrealized_pnl(self) -> float:
        """Calculate unrealized profit/loss."""
        return self.market_value - self.cost_basis

    @property
    def unrealized_pnl_pct(self) -> float:
        """Calculate unrealized P&L percentage."""
        if self.cost_basis == 0:
            return 0.0
        return (self.unrealized_pnl / self.cost_basis) * 100

    def update_price(self, price: float):
        """Update current price."""
        self.current_price = price


@dataclass
class PortfolioState:
    """Portfolio state at a point in time."""

    cash: float
    positions: Dict[str, Position] = field(default_factory=dict)
    timestamp: Optional[datetime] = None

    def get_total_equity(self, current_prices: Dict[str, float]) -> float:
        """Calculate total portfolio value (cash + positions)."""
        # Update position prices
        for symbol, position in self.positions.items():
            if symbol in current_prices:
                position.update_price(current_prices[symbol])

        # Sum up all positions
        positions_value = sum(pos.market_value for pos in self.positions.values())
        return self.cash + positions_value

    def get_positions_value(self, current_prices: Dict[str, float]) -> float:
        """Calculate total value of all positions."""
        # Update position prices
        for symbol, position in self.positions.items():
            if symbol in current_prices:
                position.update_price(current_prices[symbol])

        return sum(pos.market_value for pos in self.positions.values())

    def can_buy(
        self, symbol: str, quantity: float, price: float, commission: float
    ) -> bool:
        """Check if buy order can be executed."""
        total_cost = (quantity * price) + commission
        return self.cash >= total_cost

    def execute_buy(
        self,
        symbol: str,
        quantity: float,
        price: float,
        commission: float,
        timestamp: datetime,
    ) -> Trade:
        """Execute buy and return Trade object."""
        total_cost = (quantity * price) + commission

        if not self.can_buy(symbol, quantity, price, commission):
            raise ValueError(
                f"Insufficient cash. Need ${total_cost:.2f}, have ${self.cash:.2f}"
            )

        # Deduct cash
        self.cash -= total_cost

        # Update or create position
        if symbol in self.positions:
            # Add to existing position (update average price)
            existing = self.positions[symbol]
            total_quantity = existing.quantity + quantity
            total_cost_basis = existing.cost_basis + (quantity * price)
            new_avg_price = total_cost_basis / total_quantity

            existing.quantity = total_quantity
            existing.avg_entry_price = new_avg_price
            existing.current_price = price
        else:
            # Create new position
            self.positions[symbol] = Position(
                symbol=symbol,
                quantity=quantity,
                avg_entry_price=price,
                entry_date=timestamp,
                current_price=price,
            )

        # Create trade record
        trade = Trade(
            symbol=symbol,
            side="buy",
            entry_date=timestamp,
            entry_price=price,
            quantity=quantity,
            commission=commission,
            status="open",
        )

        return trade

    def execute_sell(
        self,
        symbol: str,
        quantity: float,
        price: float,
        commission: float,
        timestamp: datetime,
    ) -> Tuple[Trade, float, float]:
        """
        Execute sell and return (Trade object, pnl, pnl_pct).

        Args:
            symbol: Symbol to sell
            quantity: Quantity to sell (if None or greater than position, sell entire position)
            price: Execution price
            commission: Commission cost
            timestamp: Execution timestamp

        Returns:
            Tuple of (Trade, realized_pnl, realized_pnl_pct)
        """
        if symbol not in self.positions:
            raise ValueError(f"No position in {symbol} to sell")

        position = self.positions[symbol]

        # Determine quantity to sell (sell entire position if quantity exceeds holdings)
        sell_quantity = min(quantity, position.quantity) if quantity else position.quantity

        if sell_quantity <= 0:
            raise ValueError(f"Invalid sell quantity: {sell_quantity}")

        # Calculate P&L
        proceeds = (sell_quantity * price) - commission
        cost_basis = sell_quantity * position.avg_entry_price
        realized_pnl = proceeds - cost_basis
        realized_pnl_pct = (realized_pnl / cost_basis) * 100 if cost_basis > 0 else 0.0

        # Add proceeds to cash
        self.cash += proceeds

        # Update position
        position.quantity -= sell_quantity

        # Remove position if fully closed
        if position.quantity <= 0.0001:  # Use small epsilon for floating point comparison
            del self.positions[symbol]

        # Create trade record
        trade = Trade(
            symbol=symbol,
            side="sell",
            entry_date=position.entry_date,
            entry_price=position.avg_entry_price,
            quantity=sell_quantity,
            exit_date=timestamp,
            exit_price=price,
            pnl=realized_pnl,
            pnl_pct=realized_pnl_pct,
            commission=commission,
            status="closed",
        )

        return trade, realized_pnl, realized_pnl_pct

    def get_position(self, symbol: str) -> Optional[Position]:
        """Get position for a symbol."""
        return self.positions.get(symbol)

    def has_position(self, symbol: str) -> bool:
        """Check if portfolio has a position in symbol."""
        return symbol in self.positions

    def get_available_cash(self) -> float:
        """Get available cash balance."""
        return self.cash

    def __repr__(self) -> str:
        """String representation of portfolio state."""
        return (
            f"PortfolioState(cash=${self.cash:.2f}, "
            f"positions={len(self.positions)}, "
            f"timestamp={self.timestamp})"
        )


# Alias for backward compatibility
Portfolio = PortfolioState
