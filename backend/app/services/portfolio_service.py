"""
Portfolio service — CRUD and analytics for portfolios.
"""

import math
from datetime import datetime
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.portfolio import Portfolio, PortfolioMetrics, PortfolioPosition, PortfolioSnapshot
from app.schemas.portfolio import PortfolioCreate, PortfolioPositionCreate, PortfolioUpdate


class PortfolioService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ------------------------------------------------------------------
    # Portfolio CRUD
    # ------------------------------------------------------------------

    async def create_portfolio(self, data: PortfolioCreate) -> Portfolio:
        existing = await self.db.execute(select(Portfolio).where(Portfolio.name == data.name))
        if existing.scalar_one_or_none():
            raise ValueError(f"Portfolio with name '{data.name}' already exists")

        portfolio = Portfolio(
            name=data.name,
            description=data.description,
            portfolio_type=data.portfolio_type,
            initial_capital=data.initial_capital,
            current_cash=data.initial_capital,
            currency=data.currency,
            is_active=True,
        )
        self.db.add(portfolio)
        await self.db.flush()
        await self.db.commit()
        await self.db.refresh(portfolio)
        return await self.get_portfolio(portfolio.id)

    async def get_portfolio(self, portfolio_id: int) -> Optional[Portfolio]:
        result = await self.db.execute(
            select(Portfolio)
            .where(Portfolio.id == portfolio_id)
            .options(
                selectinload(Portfolio.positions),
                selectinload(Portfolio.metrics),
            )
        )
        return result.scalar_one_or_none()

    async def list_portfolios(self, skip: int = 0, limit: int = 100) -> tuple[List[Portfolio], int]:
        query = select(Portfolio).offset(skip).limit(limit)
        result = await self.db.execute(query)
        portfolios = list(result.scalars().all())

        count_result = await self.db.execute(select(Portfolio))
        total = len(count_result.scalars().all())
        return portfolios, total

    async def update_portfolio(self, portfolio_id: int, data: PortfolioUpdate) -> Optional[Portfolio]:
        portfolio = await self.get_portfolio(portfolio_id)
        if not portfolio:
            return None

        if data.name is not None:
            portfolio.name = data.name
        if data.description is not None:
            portfolio.description = data.description
        if data.is_active is not None:
            portfolio.is_active = data.is_active

        await self.db.commit()
        await self.db.refresh(portfolio)
        return await self.get_portfolio(portfolio_id)

    async def delete_portfolio(self, portfolio_id: int) -> bool:
        portfolio = await self.get_portfolio(portfolio_id)
        if not portfolio:
            return False
        await self.db.delete(portfolio)
        await self.db.commit()
        return True

    # ------------------------------------------------------------------
    # Positions
    # ------------------------------------------------------------------

    async def upsert_position(self, portfolio_id: int, data: PortfolioPositionCreate) -> PortfolioPosition:
        result = await self.db.execute(
            select(PortfolioPosition).where(
                PortfolioPosition.portfolio_id == portfolio_id,
                PortfolioPosition.symbol == data.symbol,
            )
        )
        position = result.scalar_one_or_none()

        if position is None:
            position = PortfolioPosition(
                portfolio_id=portfolio_id,
                symbol=data.symbol,
                quantity=data.quantity,
                avg_entry_price=data.avg_entry_price,
                cost_basis=data.cost_basis,
                current_price=data.current_price,
                side=data.side,
            )
            self.db.add(position)
            await self.db.flush()
        else:
            position.quantity = data.quantity
            position.avg_entry_price = data.avg_entry_price
            position.cost_basis = data.cost_basis
            if data.current_price is not None:
                position.current_price = data.current_price
            position.side = data.side

        self._update_position_pnl(position)

        await self.db.commit()
        await self.db.refresh(position)
        return position

    async def remove_position(self, portfolio_id: int, symbol: str) -> bool:
        result = await self.db.execute(
            select(PortfolioPosition).where(
                PortfolioPosition.portfolio_id == portfolio_id,
                PortfolioPosition.symbol == symbol.upper(),
            )
        )
        position = result.scalar_one_or_none()
        if not position:
            return False
        await self.db.delete(position)
        await self.db.commit()
        return True

    # ------------------------------------------------------------------
    # Snapshots
    # ------------------------------------------------------------------

    async def record_snapshot(self, portfolio_id: int) -> PortfolioSnapshot:
        portfolio = await self.get_portfolio(portfolio_id)
        if not portfolio:
            raise ValueError(f"Portfolio {portfolio_id} not found")

        positions_value = sum(
            (p.market_value if p.market_value is not None else p.quantity * p.avg_entry_price)
            for p in portfolio.positions
        )
        equity = portfolio.current_cash + positions_value

        total_return = equity - portfolio.initial_capital
        total_return_pct = (total_return / portfolio.initial_capital * 100) if portfolio.initial_capital else None

        snapshot = PortfolioSnapshot(
            portfolio_id=portfolio_id,
            timestamp=datetime.utcnow(),
            equity=equity,
            cash=portfolio.current_cash,
            positions_value=positions_value,
            total_return=total_return,
            total_return_pct=total_return_pct,
            positions_count=len(portfolio.positions),
        )
        self.db.add(snapshot)
        await self.db.commit()
        await self.db.refresh(snapshot)
        return snapshot

    async def list_snapshots(self, portfolio_id: int, limit: int = 500) -> List[PortfolioSnapshot]:
        result = await self.db.execute(
            select(PortfolioSnapshot)
            .where(PortfolioSnapshot.portfolio_id == portfolio_id)
            .order_by(PortfolioSnapshot.timestamp)
            .limit(limit)
        )
        return list(result.scalars().all())

    # ------------------------------------------------------------------
    # Metrics
    # ------------------------------------------------------------------

    async def calculate_metrics(self, portfolio_id: int) -> PortfolioMetrics:
        portfolio = await self.get_portfolio(portfolio_id)
        if not portfolio:
            raise ValueError(f"Portfolio {portfolio_id} not found")

        equity_curve = [s.equity for s in portfolio.snapshots]

        total_return = None
        total_return_pct = None
        sharpe_ratio = None
        max_drawdown = None
        max_drawdown_pct = None
        volatility = None

        if len(equity_curve) >= 2:
            total_return = equity_curve[-1] - portfolio.initial_capital
            total_return_pct = (total_return / portfolio.initial_capital * 100) if portfolio.initial_capital else None

            returns = [
                (equity_curve[i] - equity_curve[i - 1]) / equity_curve[i - 1]
                for i in range(1, len(equity_curve))
                if equity_curve[i - 1] != 0
            ]

            if returns:
                mean_r = sum(returns) / len(returns)
                variance = sum((r - mean_r) ** 2 for r in returns) / len(returns)
                std_r = math.sqrt(variance) if variance > 0 else 0
                volatility = std_r * math.sqrt(252) * 100
                sharpe_ratio = (mean_r / std_r * math.sqrt(252)) if std_r > 0 else None

            peak = equity_curve[0]
            max_dd = 0.0
            for e in equity_curve:
                if e > peak:
                    peak = e
                dd = (peak - e) / peak if peak > 0 else 0
                if dd > max_dd:
                    max_dd = dd
            max_drawdown = (equity_curve[0] * max_dd) if equity_curve else None
            max_drawdown_pct = max_dd * 100

        # Upsert metrics record
        result = await self.db.execute(
            select(PortfolioMetrics).where(PortfolioMetrics.portfolio_id == portfolio_id)
        )
        metrics = result.scalar_one_or_none()

        if metrics is None:
            metrics = PortfolioMetrics(portfolio_id=portfolio_id)
            self.db.add(metrics)

        metrics.total_return = total_return
        metrics.total_return_pct = total_return_pct
        metrics.sharpe_ratio = sharpe_ratio
        metrics.max_drawdown = max_drawdown
        metrics.max_drawdown_pct = max_drawdown_pct
        metrics.volatility = volatility
        metrics.calculated_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(metrics)
        return metrics

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _update_position_pnl(self, position: PortfolioPosition) -> None:
        if position.current_price is not None:
            position.market_value = position.quantity * position.current_price
            position.unrealized_pnl = (position.current_price - position.avg_entry_price) * position.quantity
            if position.avg_entry_price:
                position.unrealized_pnl_pct = (
                    (position.current_price - position.avg_entry_price) / position.avg_entry_price * 100
                )
