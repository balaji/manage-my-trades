"""
Portfolio management API endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.services.portfolio_service import PortfolioService
from app.schemas.portfolio import (
    PortfolioCreate,
    PortfolioListResponse,
    PortfolioMetricsResponse,
    PortfolioPositionCreate,
    PortfolioPositionResponse,
    PortfolioResponse,
    PortfolioSnapshotResponse,
    PortfolioUpdate,
    PortfolioListItem,
)

router = APIRouter()


@router.get("", response_model=PortfolioListResponse, summary="List portfolios")
async def list_portfolios(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    service = PortfolioService(db)
    portfolios, total = await service.list_portfolios(skip=skip, limit=limit)
    return PortfolioListResponse(
        portfolios=[PortfolioListItem.model_validate(p) for p in portfolios],
        total=total,
    )


@router.post("", response_model=PortfolioResponse, status_code=status.HTTP_201_CREATED, summary="Create portfolio")
async def create_portfolio(data: PortfolioCreate, db: AsyncSession = Depends(get_db)):
    service = PortfolioService(db)
    try:
        portfolio = await service.create_portfolio(data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    return PortfolioResponse.model_validate(portfolio)


@router.get("/{portfolio_id}", response_model=PortfolioResponse, summary="Get portfolio")
async def get_portfolio(portfolio_id: int, db: AsyncSession = Depends(get_db)):
    service = PortfolioService(db)
    portfolio = await service.get_portfolio(portfolio_id)
    if not portfolio:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio not found")
    return PortfolioResponse.model_validate(portfolio)


@router.put("/{portfolio_id}", response_model=PortfolioResponse, summary="Update portfolio")
async def update_portfolio(portfolio_id: int, data: PortfolioUpdate, db: AsyncSession = Depends(get_db)):
    service = PortfolioService(db)
    portfolio = await service.update_portfolio(portfolio_id, data)
    if not portfolio:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio not found")
    return PortfolioResponse.model_validate(portfolio)


@router.delete("/{portfolio_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete portfolio")
async def delete_portfolio(portfolio_id: int, db: AsyncSession = Depends(get_db)):
    service = PortfolioService(db)
    deleted = await service.delete_portfolio(portfolio_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio not found")


@router.post(
    "/{portfolio_id}/positions",
    response_model=PortfolioPositionResponse,
    summary="Add or update a position",
)
async def upsert_position(portfolio_id: int, data: PortfolioPositionCreate, db: AsyncSession = Depends(get_db)):
    service = PortfolioService(db)
    portfolio = await service.get_portfolio(portfolio_id)
    if not portfolio:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio not found")
    position = await service.upsert_position(portfolio_id, data)
    return PortfolioPositionResponse.model_validate(position)


@router.delete(
    "/{portfolio_id}/positions/{symbol}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a position",
)
async def remove_position(portfolio_id: int, symbol: str, db: AsyncSession = Depends(get_db)):
    service = PortfolioService(db)
    removed = await service.remove_position(portfolio_id, symbol)
    if not removed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Position not found")


@router.get(
    "/{portfolio_id}/snapshots",
    response_model=list[PortfolioSnapshotResponse],
    summary="Get equity curve snapshots",
)
async def list_snapshots(
    portfolio_id: int,
    limit: int = Query(default=500, ge=1, le=2000),
    db: AsyncSession = Depends(get_db),
):
    service = PortfolioService(db)
    portfolio = await service.get_portfolio(portfolio_id)
    if not portfolio:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio not found")
    snapshots = await service.list_snapshots(portfolio_id, limit=limit)
    return [PortfolioSnapshotResponse.model_validate(s) for s in snapshots]


@router.post(
    "/{portfolio_id}/snapshot",
    response_model=PortfolioSnapshotResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record a portfolio snapshot",
)
async def record_snapshot(portfolio_id: int, db: AsyncSession = Depends(get_db)):
    service = PortfolioService(db)
    try:
        snapshot = await service.record_snapshot(portfolio_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return PortfolioSnapshotResponse.model_validate(snapshot)


@router.get(
    "/{portfolio_id}/metrics",
    response_model=PortfolioMetricsResponse,
    summary="Get or refresh portfolio performance metrics",
)
async def get_metrics(portfolio_id: int, db: AsyncSession = Depends(get_db)):
    service = PortfolioService(db)
    try:
        metrics = await service.calculate_metrics(portfolio_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return PortfolioMetricsResponse.model_validate(metrics)
