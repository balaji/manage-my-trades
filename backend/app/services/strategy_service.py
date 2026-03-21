"""
Strategy service for managing trading strategies.
"""

from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
import logging

from app.core.strategies.legacy import build_legacy_spec, indicator_rows_from_spec
from app.models.strategy import Strategy, StrategyIndicator
from app.schemas.strategy import StrategyCreate, StrategyUpdate

logger = logging.getLogger(__name__)


class StrategyService:
    """Service for managing trading strategies."""

    def __init__(self, db: AsyncSession):
        """Initialize strategy service."""
        self.db = db

    async def create_strategy(self, strategy_data: StrategyCreate) -> Strategy:
        """
        Create a new trading strategy with indicators.

        Args:
            strategy_data: Strategy creation data

        Returns:
            Created strategy with indicators

        Raises:
            ValueError: If strategy name already exists
        """
        # Check if strategy name already exists
        existing = await self.db.execute(select(Strategy).where(Strategy.name == strategy_data.name))
        if existing.scalar_one_or_none():
            raise ValueError(f"Strategy with name '{strategy_data.name}' already exists")

        # Create strategy
        strategy = Strategy(
            name=strategy_data.name,
            description=strategy_data.description,
            strategy_type="technical",
            is_active=False,  # New strategies start inactive
            config=strategy_data.spec,
        )
        self.db.add(strategy)
        await self.db.flush()  # Flush to get strategy ID

        # Create indicators
        for indicator_config in indicator_rows_from_spec(strategy_data.spec):
            indicator = StrategyIndicator(
                strategy_id=strategy.id,
                indicator_name=indicator_config["indicator_name"],
                parameters=indicator_config["parameters"],
                usage=indicator_config["usage"],
            )
            self.db.add(indicator)

        await self.db.commit()
        await self.db.refresh(strategy)

        # Load relationships
        result = await self.db.execute(
            select(Strategy).where(Strategy.id == strategy.id).options(selectinload(Strategy.indicators))
        )
        return result.scalar_one()

    async def get_strategy(self, strategy_id: int) -> Optional[Strategy]:
        """
        Get a strategy by ID.

        Args:
            strategy_id: Strategy ID

        Returns:
            Strategy if found, None otherwise
        """
        result = await self.db.execute(
            select(Strategy).where(Strategy.id == strategy_id).options(selectinload(Strategy.indicators))
        )
        return result.scalar_one_or_none()

    async def list_strategies(
        self,
        skip: int = 0,
        limit: int = 100,
        is_active: Optional[bool] = None,
        strategy_type: Optional[str] = None,
    ) -> tuple[List[Strategy], int]:
        """
        List all strategies with optional filtering.

        Args:
            skip: Number of records to skip
            limit: Maximum number of records to return
            is_active: Filter by active status
            strategy_type: Filter by strategy type

        Returns:
            Tuple of (list of strategies, total count)
        """
        # Build query
        query = select(Strategy).options(selectinload(Strategy.indicators))

        # Apply filters
        if is_active is not None:
            query = query.where(Strategy.is_active == is_active)
        if strategy_type:
            query = query.where(Strategy.strategy_type == strategy_type)

        # Get total count
        count_query = select(Strategy)
        if is_active is not None:
            count_query = count_query.where(Strategy.is_active == is_active)
        if strategy_type:
            count_query = count_query.where(Strategy.strategy_type == strategy_type)

        count_result = await self.db.execute(count_query)
        total = len(count_result.scalars().all())

        # Apply pagination and execute
        query = query.offset(skip).limit(limit)
        result = await self.db.execute(query)
        strategies = result.scalars().all()

        return list(strategies), total

    async def update_strategy(self, strategy_id: int, strategy_data: StrategyUpdate) -> Optional[Strategy]:
        """
        Update an existing strategy.

        Args:
            strategy_id: Strategy ID
            strategy_data: Strategy update data

        Returns:
            Updated strategy if found, None otherwise

        Raises:
            ValueError: If updated name conflicts with another strategy
        """
        # Get existing strategy
        strategy = await self.get_strategy(strategy_id)
        if not strategy:
            return None

        # Check name uniqueness if name is being updated
        if strategy_data.name and strategy_data.name != strategy.name:
            existing = await self.db.execute(
                select(Strategy).where(Strategy.name == strategy_data.name, Strategy.id != strategy_id)
            )
            if existing.scalar_one_or_none():
                raise ValueError(f"Strategy with name '{strategy_data.name}' already exists")

        # Update strategy fields
        if strategy_data.name:
            strategy.name = strategy_data.name
        if strategy_data.description is not None:
            strategy.description = strategy_data.description
        if strategy_data.strategy_type:
            strategy.strategy_type = "technical"
        if strategy_data.is_active is not None:
            strategy.is_active = strategy_data.is_active
        if strategy_data.spec is not None:
            strategy.config = strategy_data.spec
        elif strategy_data.config is not None:
            spec = build_legacy_spec(
                name=strategy_data.name or strategy.name,
                description=(
                    strategy_data.description if strategy_data.description is not None else strategy.description
                ),
                config=strategy_data.config,
                indicators=[indicator.model_dump() for indicator in (strategy_data.indicators or [])],
            )
            strategy.config = spec

        # Update indicators if provided
        if strategy_data.indicators is not None or strategy_data.spec is not None or strategy_data.config is not None:
            # Delete existing indicators
            await self.db.execute(delete(StrategyIndicator).where(StrategyIndicator.strategy_id == strategy_id))
            await self.db.flush()

            # Create new indicators from the updated spec (already a StrategySpec on strategy.config)
            for indicator_config in indicator_rows_from_spec(strategy.config):
                indicator = StrategyIndicator(
                    strategy_id=strategy_id,
                    indicator_name=indicator_config["indicator_name"],
                    parameters=indicator_config["parameters"],
                    usage=indicator_config["usage"],
                )
                self.db.add(indicator)

        await self.db.commit()
        await self.db.refresh(strategy)

        # Reload with relationships
        return await self.get_strategy(strategy_id)

    async def delete_strategy(self, strategy_id: int) -> bool:
        """
        Delete a strategy.

        Args:
            strategy_id: Strategy ID

        Returns:
            True if deleted, False if not found
        """
        strategy = await self.get_strategy(strategy_id)
        if not strategy:
            return False

        await self.db.delete(strategy)
        await self.db.commit()
        logger.info(f"Deleted strategy {strategy_id}: {strategy.name}")
        return True

    async def activate_strategy(self, strategy_id: int) -> Optional[Strategy]:
        """
        Activate a strategy.

        Args:
            strategy_id: Strategy ID

        Returns:
            Updated strategy if found, None otherwise
        """
        strategy = await self.get_strategy(strategy_id)
        if not strategy:
            return None

        strategy.is_active = True
        await self.db.commit()
        await self.db.refresh(strategy)
        logger.info(f"Activated strategy {strategy_id}: {strategy.name}")

        return await self.get_strategy(strategy_id)

    async def deactivate_strategy(self, strategy_id: int) -> Optional[Strategy]:
        """
        Deactivate a strategy.

        Args:
            strategy_id: Strategy ID

        Returns:
            Updated strategy if found, None otherwise
        """
        strategy = await self.get_strategy(strategy_id)
        if not strategy:
            return None

        strategy.is_active = False
        await self.db.commit()
        await self.db.refresh(strategy)
        logger.info(f"Deactivated strategy {strategy_id}: {strategy.name}")

        return await self.get_strategy(strategy_id)
