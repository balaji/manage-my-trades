"""Position sizing strategies for backtesting."""

from typing import Dict, Any, Optional
import math


class PositionSizer:
    """Calculate position sizes based on different strategies."""

    @staticmethod
    def calculate_size(
        method: str,
        portfolio_equity: float,
        price: float,
        config: Optional[Dict[str, Any]] = None,
    ) -> float:
        """
        Calculate position size based on method.

        Args:
            method: Position sizing method ('fixed_percentage', 'fixed_amount', 'equal_weight')
            portfolio_equity: Total portfolio value
            price: Current price of the asset
            config: Configuration dictionary for the method

        Returns:
            Number of shares to buy (can be fractional)

        Raises:
            ValueError: If method is invalid or required config is missing
        """
        if config is None:
            config = {}

        method = method.lower()

        if method == "fixed_percentage":
            return PositionSizer._fixed_percentage(portfolio_equity, price, config)

        elif method == "fixed_amount":
            return PositionSizer._fixed_amount(price, config)

        elif method == "equal_weight":
            return PositionSizer._equal_weight(portfolio_equity, price, config)

        else:
            raise ValueError(
                f"Unknown position sizing method: {method}. "
                f"Supported: 'fixed_percentage', 'fixed_amount', 'equal_weight'"
            )

    @staticmethod
    def _fixed_percentage(
        portfolio_equity: float, price: float, config: Dict[str, Any]
    ) -> float:
        """
        Allocate a fixed percentage of portfolio equity.

        Config keys:
            - percentage: Percentage of portfolio (default: 0.1 = 10%)

        Example:
            Portfolio: $10,000, percentage: 0.1, price: $100
            Position value: $10,000 * 0.1 = $1,000
            Shares: $1,000 / $100 = 10 shares
        """
        percentage = config.get("percentage", 0.1)  # Default 10%

        if not 0 < percentage <= 1.0:
            raise ValueError(f"Percentage must be between 0 and 1, got: {percentage}")

        if price <= 0:
            raise ValueError(f"Price must be positive, got: {price}")

        if portfolio_equity <= 0:
            return 0.0

        position_value = portfolio_equity * percentage
        shares = position_value / price

        return shares

    @staticmethod
    def _fixed_amount(price: float, config: Dict[str, Any]) -> float:
        """
        Use a fixed dollar amount per position.

        Config keys:
            - amount: Dollar amount to allocate (required)

        Example:
            Amount: $1,000, price: $50
            Shares: $1,000 / $50 = 20 shares
        """
        amount = config.get("amount")

        if amount is None:
            raise ValueError("'amount' is required for 'fixed_amount' method")

        if amount <= 0:
            raise ValueError(f"Amount must be positive, got: {amount}")

        if price <= 0:
            raise ValueError(f"Price must be positive, got: {price}")

        shares = amount / price

        return shares

    @staticmethod
    def _equal_weight(
        portfolio_equity: float, price: float, config: Dict[str, Any]
    ) -> float:
        """
        Divide portfolio equally across N symbols.

        Config keys:
            - num_positions: Number of positions to maintain (required)

        Example:
            Portfolio: $10,000, num_positions: 5, price: $100
            Per position: $10,000 / 5 = $2,000
            Shares: $2,000 / $100 = 20 shares
        """
        num_positions = config.get("num_positions")

        if num_positions is None:
            raise ValueError("'num_positions' is required for 'equal_weight' method")

        if num_positions <= 0:
            raise ValueError(
                f"num_positions must be positive, got: {num_positions}"
            )

        if price <= 0:
            raise ValueError(f"Price must be positive, got: {price}")

        if portfolio_equity <= 0:
            return 0.0

        position_value = portfolio_equity / num_positions
        shares = position_value / price

        return shares

    @staticmethod
    def round_shares(shares: float, allow_fractional: bool = True) -> float:
        """
        Round shares to appropriate precision.

        Args:
            shares: Number of shares (can be fractional)
            allow_fractional: If True, keep fractional shares; if False, round down to integer

        Returns:
            Rounded number of shares
        """
        if allow_fractional:
            # Round to 6 decimal places for fractional shares
            return round(shares, 6)
        else:
            # Round down to whole shares
            return math.floor(shares)

    @staticmethod
    def calculate_max_position_size(
        cash: float, price: float, commission: float = 0.0
    ) -> float:
        """
        Calculate maximum shares that can be bought with available cash.

        Args:
            cash: Available cash
            price: Price per share
            commission: Commission per trade

        Returns:
            Maximum number of shares (fractional)
        """
        if price <= 0:
            return 0.0

        if cash <= commission:
            return 0.0

        # Total cost = (shares * price) + commission
        # cash = (shares * price) + commission
        # shares = (cash - commission) / price
        available_for_shares = cash - commission
        max_shares = available_for_shares / price

        return max(0.0, max_shares)

    def __repr__(self) -> str:
        """String representation."""
        return "PositionSizer()"
