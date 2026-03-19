"""API endpoints for backtesting."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db, get_market_db
from app.schemas.backtest import (
    BacktestCreate,
    BacktestListResponse,
    BacktestResponse,
    BacktestTradesResponse,
    SignalResponse,
    BacktestSignalsResponse,
)
from app.services.backtest_service import BacktestService

router = APIRouter()


@router.post("/", response_model=BacktestResponse, status_code=201)
async def create_backtest(
    backtest_data: BacktestCreate,
    db: AsyncSession = Depends(get_db),
    market_db: AsyncSession = Depends(get_market_db),
):
    """
    Create a new backtest (status='pending').
    Use POST /backtests/{id}/run to execute it.

    Args:
        backtest_data: Backtest configuration

    Returns:
        Created backtest object

    Raises:
        400: Invalid input data
    """
    service = BacktestService(db, market_db)
    try:
        backtest = await service.create_backtest(backtest_data)
        return backtest
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{backtest_id}/run", response_model=BacktestResponse)
async def run_backtest(
    backtest_id: int,
    db: AsyncSession = Depends(get_db),
    market_db: AsyncSession = Depends(get_market_db),
):
    """
    Execute a backtest. Updates status to 'running', then 'completed' or 'failed'.

    Args:
        backtest_id: ID of backtest to run

    Returns:
        Updated backtest object with results

    Raises:
        400: Backtest is not in 'pending' state
        404: Backtest not found
        500: Backtest execution failed
    """
    service = BacktestService(db, market_db)
    try:
        backtest = await service.run_backtest(backtest_id)
        return backtest
    except ValueError as e:
        # Check if it's a "not found" error
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        else:
            raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backtest failed: {str(e)}")


@router.get("/", response_model=BacktestListResponse)
async def list_backtests(
    strategy_id: Optional[int] = None,
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    market_db: AsyncSession = Depends(get_market_db),
):
    """
    List all backtests with optional filtering.

    Args:
        strategy_id: Filter by strategy ID
        status: Filter by status (pending, running, completed, failed)
        skip: Number of records to skip (pagination)
        limit: Maximum number of records to return (pagination)

    Returns:
        List of backtests with total count
    """
    service = BacktestService(db, market_db)
    backtests, total = await service.list_backtests(strategy_id, status, skip, limit)
    return {"backtests": backtests, "total": total}


@router.get("/{backtest_id}", response_model=BacktestResponse)
async def get_backtest(
    backtest_id: int,
    db: AsyncSession = Depends(get_db),
    market_db: AsyncSession = Depends(get_market_db),
):
    """
    Get backtest details with results.

    Args:
        backtest_id: ID of backtest

    Returns:
        Backtest object with results

    Raises:
        404: Backtest not found
    """
    service = BacktestService(db, market_db)
    backtest = await service.get_backtest(backtest_id)
    if not backtest:
        raise HTTPException(status_code=404, detail="Backtest not found")
    return backtest


@router.get("/{backtest_id}/trades", response_model=BacktestTradesResponse)
async def get_backtest_trades(
    backtest_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    market_db: AsyncSession = Depends(get_market_db),
):
    """
    Get all trades for a backtest.

    Args:
        backtest_id: ID of backtest
        skip: Number of records to skip (pagination)
        limit: Maximum number of records to return (pagination)

    Returns:
        List of trades with total count
    """
    service = BacktestService(db, market_db)
    trades, total = await service.get_backtest_trades(backtest_id, skip, limit)
    return {"trades": trades, "total": total}


@router.get("/{backtest_id}/signals", response_model=BacktestSignalsResponse)
async def get_backtest_signals(
    backtest_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    market_db: AsyncSession = Depends(get_market_db),
):
    """
    Get all signals generated in a backtest.

    Args:
        backtest_id: ID of backtest
        skip: Number of records to skip (pagination)
        limit: Maximum number of records to return (pagination)

    Returns:
        List of signals with total count
    """
    service = BacktestService(db, market_db)
    signals, total = await service.get_backtest_signals(backtest_id, skip, limit)
    # Convert ORM objects to dictionaries, ensuring metadata_ is a proper dict
    signal_responses = []
    for signal in signals:
        signal_dict = {
            "id": signal.id,
            "symbol": signal.symbol,
            "signal_type": signal.signal_type,
            "timestamp": signal.timestamp,
            "price": signal.price,
            "strength": signal.strength,
            "indicators": signal.indicators if signal.indicators else None,
            "metadata": signal.metadata_ if isinstance(signal.metadata_, dict) else (signal.metadata_ or {}),
        }
        signal_responses.append(SignalResponse(**signal_dict))
    return {"signals": signal_responses, "total": total}


@router.delete("/{backtest_id}", status_code=204)
async def delete_backtest(
    backtest_id: int,
    db: AsyncSession = Depends(get_db),
    market_db: AsyncSession = Depends(get_market_db),
):
    """
    Delete a backtest and all associated data (results, trades).

    Args:
        backtest_id: ID of backtest to delete

    Raises:
        404: Backtest not found
    """
    service = BacktestService(db, market_db)
    deleted = await service.delete_backtest(backtest_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Backtest not found")
