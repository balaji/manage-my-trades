"""
Strategy API endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.db.session import get_db
from app.services.strategy_service import StrategyService
from app.schemas.strategy import (
    StrategyCreate,
    StrategyUpdate,
    StrategyResponse,
    StrategyListResponse,
)

router = APIRouter()


@router.post(
    "/",
    response_model=StrategyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new trading strategy",
    description="Create a new trading strategy with indicator configurations.",
)
async def create_strategy(
    strategy_data: StrategyCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new trading strategy.

    - **name**: Unique strategy name
    - **description**: Optional strategy description
    - **strategy_type**: Type of strategy (technical, ml, combined)
    - **config**: Strategy-specific configuration (thresholds, parameters, etc.)
    - **indicators**: List of indicators to use with their configurations

    Returns the created strategy with all indicator configurations.
    """
    service = StrategyService(db)
    try:
        strategy = await service.create_strategy(strategy_data)
        return strategy
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create strategy: {str(e)}",
        )


@router.get(
    "/",
    response_model=StrategyListResponse,
    summary="List all trading strategies",
    description="Get a list of all trading strategies with optional filtering.",
)
async def list_strategies(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    strategy_type: Optional[str] = Query(None, description="Filter by strategy type"),
    db: AsyncSession = Depends(get_db),
):
    """
    List all trading strategies.

    Supports pagination and filtering by:
    - **is_active**: Filter active or inactive strategies
    - **strategy_type**: Filter by strategy type (technical, ml, combined)

    Returns a list of strategies with their indicator configurations.
    """
    service = StrategyService(db)
    try:
        strategies, total = await service.list_strategies(
            skip=skip,
            limit=limit,
            is_active=is_active,
            strategy_type=strategy_type,
        )
        return StrategyListResponse(strategies=strategies, total=total)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list strategies: {str(e)}",
        )


@router.get(
    "/{strategy_id}",
    response_model=StrategyResponse,
    summary="Get strategy details",
    description="Get detailed information about a specific trading strategy.",
)
async def get_strategy(
    strategy_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Get a strategy by ID.

    Returns the complete strategy configuration including all indicators.
    """
    service = StrategyService(db)
    strategy = await service.get_strategy(strategy_id)
    if not strategy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Strategy with ID {strategy_id} not found",
        )
    return strategy


@router.put(
    "/{strategy_id}",
    response_model=StrategyResponse,
    summary="Update a trading strategy",
    description="Update an existing trading strategy's configuration.",
)
async def update_strategy(
    strategy_id: int,
    strategy_data: StrategyUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Update an existing strategy.

    All fields are optional. Only provided fields will be updated.
    - **name**: Update strategy name (must be unique)
    - **description**: Update description
    - **strategy_type**: Update strategy type
    - **is_active**: Activate or deactivate the strategy
    - **config**: Update configuration
    - **indicators**: Replace all indicators with new configuration

    Returns the updated strategy.
    """
    service = StrategyService(db)
    try:
        strategy = await service.update_strategy(strategy_id, strategy_data)
        if not strategy:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Strategy with ID {strategy_id} not found",
            )
        return strategy
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update strategy: {str(e)}",
        )


@router.delete(
    "/{strategy_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a trading strategy",
    description="Permanently delete a trading strategy and all its associated data.",
)
async def delete_strategy(
    strategy_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Delete a strategy by ID.

    This will permanently delete:
    - The strategy configuration
    - All indicator configurations
    - All generated signals
    - All backtests (if implemented)

    This action cannot be undone.
    """
    service = StrategyService(db)
    deleted = await service.delete_strategy(strategy_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Strategy with ID {strategy_id} not found",
        )


@router.post(
    "/{strategy_id}/activate",
    response_model=StrategyResponse,
    summary="Activate a trading strategy",
    description="Activate a strategy to start generating signals.",
)
async def activate_strategy(
    strategy_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Activate a strategy.

    An active strategy will:
    - Generate signals when run
    - Be included in paper trading execution
    - Appear in active strategy lists

    Returns the updated strategy.
    """
    service = StrategyService(db)
    strategy = await service.activate_strategy(strategy_id)
    if not strategy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Strategy with ID {strategy_id} not found",
        )
    return strategy


@router.post(
    "/{strategy_id}/deactivate",
    response_model=StrategyResponse,
    summary="Deactivate a trading strategy",
    description="Deactivate a strategy to stop generating signals.",
)
async def deactivate_strategy(
    strategy_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Deactivate a strategy.

    A deactivated strategy will:
    - Stop generating new signals
    - Be excluded from paper trading execution
    - Retain all historical data

    Returns the updated strategy.
    """
    service = StrategyService(db)
    strategy = await service.deactivate_strategy(strategy_id)
    if not strategy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Strategy with ID {strategy_id} not found",
        )
    return strategy
