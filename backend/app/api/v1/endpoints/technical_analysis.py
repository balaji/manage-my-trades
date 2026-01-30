"""
Technical analysis API endpoints.
"""
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.services.technical_analysis_service import TechnicalAnalysisService
from app.schemas.technical_analysis import (
    IndicatorRequest,
    SupportedIndicatorsResponse,
)

router = APIRouter()


@router.post("/calculate")
async def calculate_indicators(
    request: IndicatorRequest,
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Calculate technical indicators for a symbol.

    - **symbol**: Ticker symbol (e.g., SPY)
    - **timeframe**: Timeframe (1m, 5m, 15m, 1h, 1d)
    - **start_date**: Start date for data
    - **end_date**: End date for data
    - **indicators**: List of indicators to calculate

    Example request body:
    ```json
    {
        "symbol": "SPY",
        "timeframe": "1d",
        "start_date": "2024-01-01T00:00:00Z",
        "end_date": "2024-12-31T00:00:00Z",
        "indicators": [
            {"name": "sma", "params": {"length": 20}},
            {"name": "rsi", "params": {"length": 14}},
            {"name": "macd", "params": {"fast": 12, "slow": 26, "signal": 9}}
        ]
    }
    ```
    """
    try:
        service = TechnicalAnalysisService(db)
        result = await service.calculate_indicators(
            symbol=request.symbol,
            timeframe=request.timeframe,
            start=request.start_date,
            end=request.end_date,
            indicators=request.indicators
        )

        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/indicators", response_model=SupportedIndicatorsResponse)
async def get_supported_indicators(db: AsyncSession = Depends(get_db)):
    """
    Get list of supported technical indicators.

    Returns information about all available indicators including their
    parameters and default values.
    """
    try:
        service = TechnicalAnalysisService(db)
        indicators = service.get_supported_indicators()

        return SupportedIndicatorsResponse(indicators=indicators)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
