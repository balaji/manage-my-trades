"""Service for managing backtests."""

import logging
from typing import List, Optional, Tuple

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.backtesting.engine import BacktestEngine
from app.models.backtest import Backtest
from app.models.signal import Signal
from app.models.trade import Trade
from app.schemas.backtest import BacktestCreate
from app.services.strategy_service import StrategyService

logger = logging.getLogger(__name__)


class BacktestService:
    """Service for managing backtests."""

    def __init__(self, db: AsyncSession, market_db: AsyncSession):
        """Initialize backtest service."""
        self.db = db
        self.market_db = market_db
        self.strategy_service = StrategyService(db)

    async def create_backtest(self, backtest_data: BacktestCreate) -> Backtest:
        """
        Create backtest record with status='pending'.

        Args:
            backtest_data: Backtest creation data

        Returns:
            Created Backtest object

        Raises:
            ValueError: If validation fails
        """
        # Validate strategy exists
        strategy = await self.strategy_service.get_strategy(backtest_data.strategy_id)
        if not strategy:
            raise ValueError(f"Strategy {backtest_data.strategy_id} not found")

        # Validate date range
        if backtest_data.end_date <= backtest_data.start_date:
            raise ValueError("end_date must be after start_date")

        # Validate symbols
        if not backtest_data.symbols or len(backtest_data.symbols) == 0:
            raise ValueError("At least one symbol is required")

        # Create backtest record
        backtest = Backtest(
            strategy_id=backtest_data.strategy_id,
            name=backtest_data.name,
            symbols=backtest_data.symbols,
            start_date=backtest_data.start_date,
            end_date=backtest_data.end_date,
            initial_capital=backtest_data.initial_capital,
            timeframe=backtest_data.timeframe,
            commission=backtest_data.commission,
            slippage=backtest_data.slippage,
            status="pending",
        )

        self.db.add(backtest)
        await self.db.commit()
        await self.db.refresh(backtest)

        logger.info(f"Created backtest {backtest.id}: {backtest.name}")

        return await self.get_backtest(backtest.id)

    async def run_backtest(self, backtest_id: int) -> Backtest:
        """
        Execute backtest simulation.

        Args:
            backtest_id: ID of backtest to run

        Returns:
            Updated Backtest object

        Raises:
            ValueError: If backtest not found or in invalid state
        """
        # Load backtest with strategy
        backtest = await self.get_backtest(backtest_id)
        if not backtest:
            raise ValueError(f"Backtest {backtest_id} not found")

        if backtest.status != "pending":
            raise ValueError(f"Backtest must be pending (current: {backtest.status})")

        if not backtest.strategy:
            raise ValueError(f"Strategy not found for backtest {backtest_id}")

        try:
            # Update status
            backtest.status = "running"
            backtest.error_message = None
            await self.db.commit()

            logger.info(f"Starting backtest {backtest_id}")

            # Run backtest engine
            engine = BacktestEngine(backtest, backtest.strategy)
            result = await engine.run(self.db, self.market_db)

            # Save results
            result.backtest_id = backtest.id
            self.db.add(result)
            await self.db.flush()  # Materialize result.id

            # Save signals with backtest_result_id
            for signal in engine.signals:
                signal.backtest_result_id = result.id
                self.db.add(signal)

            # Save trades
            for trade in engine.trades:
                self.db.add(trade)

            # Update status
            backtest.status = "completed"
            await self.db.commit()

            logger.info(
                f"Backtest {backtest_id} completed successfully: "
                f"{result.total_trades} trades, "
                f"{result.total_return_pct:.2f}% return"
            )

        except Exception as e:
            backtest.status = "failed"
            backtest.error_message = str(e)
            await self.db.commit()
            logger.exception(f"Backtest {backtest_id} failed: {e}")
            raise

        # Reload with results
        backtest = await self.get_backtest(backtest_id)
        return backtest

    async def get_backtest(self, backtest_id: int) -> Optional[Backtest]:
        """
        Get backtest with results and strategy.

        Args:
            backtest_id: ID of backtest

        Returns:
            Backtest object or None if not found
        """
        result = await self.db.execute(
            select(Backtest)
            .options(selectinload(Backtest.results))
            .options(selectinload(Backtest.strategy))
            .where(Backtest.id == backtest_id)
        )
        return result.scalar_one_or_none()

    async def list_backtests(
        self,
        strategy_id: Optional[int] = None,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[Backtest], int]:
        """
        List backtests with filtering and pagination.

        Args:
            strategy_id: Filter by strategy ID
            status: Filter by status
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            Tuple of (backtests list, total count)
        """
        # Build query
        query = select(Backtest).options(selectinload(Backtest.results), selectinload(Backtest.strategy))

        # Apply filters
        filters = []
        if strategy_id is not None:
            filters.append(Backtest.strategy_id == strategy_id)
        if status is not None:
            filters.append(Backtest.status == status)

        if filters:
            query = query.where(and_(*filters))

        # Get total count
        count_query = select(func.count()).select_from(Backtest)
        if filters:
            count_query = count_query.where(and_(*filters))

        total_result = await self.db.execute(count_query)
        total = total_result.scalar_one()

        # Apply pagination and ordering
        query = query.order_by(Backtest.created_at.desc()).offset(skip).limit(limit)

        # Execute query
        result = await self.db.execute(query)
        backtests = result.scalars().all()

        return list(backtests), total

    async def delete_backtest(self, backtest_id: int) -> bool:
        """
        Delete backtest (cascade deletes results and trades).

        Args:
            backtest_id: ID of backtest to delete

        Returns:
            True if deleted, False if not found
        """
        backtest = await self.get_backtest(backtest_id)
        if not backtest:
            return False

        await self.db.delete(backtest)
        await self.db.commit()

        logger.info(f"Deleted backtest {backtest_id}")

        return True

    async def get_backtest_trades(self, backtest_id: int, skip: int = 0, limit: int = 100) -> Tuple[List[Trade], int]:
        """
        Get trades for a backtest.

        Args:
            backtest_id: ID of backtest
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            Tuple of (trades list, total count)
        """
        # Get total count
        count_query = select(func.count()).select_from(Trade).where(Trade.backtest_id == backtest_id)
        total_result = await self.db.execute(count_query)
        total = total_result.scalar_one()

        # Get trades
        query = (
            select(Trade)
            .where(Trade.backtest_id == backtest_id)
            .order_by(Trade.entry_date.asc())
            .offset(skip)
            .limit(limit)
        )

        result = await self.db.execute(query)
        trades = result.scalars().all()

        return list(trades), total

    async def get_backtest_equity_curve(self, backtest_id: int) -> Optional[dict]:
        """
        Get equity curve data for a backtest.

        Args:
            backtest_id: ID of backtest

        Returns:
            Equity curve data dict or None if not found
        """
        backtest = await self.get_backtest(backtest_id)
        if not backtest or not backtest.results:
            return None

        return backtest.results.equity_curve

    async def get_backtest_signals(self, backtest_id: int, skip: int = 0, limit: int = 100) -> Tuple[List[Signal], int]:
        """
        Get signals for a backtest.

        Args:
            backtest_id: ID of backtest
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            Tuple of (signals list, total count)
        """
        # Get backtest to find its result id
        backtest = await self.get_backtest(backtest_id)
        if not backtest or not backtest.results:
            return [], 0

        # Get total count
        count_query = select(func.count()).select_from(Signal).where(Signal.backtest_result_id == backtest.results.id)
        total_result = await self.db.execute(count_query)
        total = total_result.scalar_one()

        # Get signals
        query = (
            select(Signal)
            .where(Signal.backtest_result_id == backtest.results.id)
            .order_by(Signal.timestamp.asc())
            .offset(skip)
            .limit(limit)
        )

        result = await self.db.execute(query)
        signals = result.scalars().all()

        return list(signals), total
