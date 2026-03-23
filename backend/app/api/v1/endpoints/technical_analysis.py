"""Technical analysis API endpoints."""

from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_market_db
from app.services.technical_analysis_service import TechnicalAnalysisService
from app.schemas.technical_analysis import IndicatorRequest, IndicatorResponse, SupportedIndicatorsResponse

router = APIRouter()


@router.post(
    "/calculate",
    response_model=IndicatorResponse,
    summary="Calculate Technical Indicators",
    responses={
        200: {
            "description": "Successfully calculated indicators",
            "content": {
                "application/json": {
                    "example": {
                        "symbol": "SPY",
                        "timeframe": "1d",
                        "indicators": [
                            {
                                "name": "SMA",
                                "params": {"timeperiod": 20},
                                "outputs": {
                                    "real": [
                                        {"timestamp": "2024-01-01T00:00:00", "value": 448.2},
                                    ]
                                },
                            }
                        ],
                    }
                }
            },
        },
        400: {"description": "Invalid request parameters"},
        500: {"description": "Internal server error"},
    },
)
async def calculate_indicators(
    request: IndicatorRequest, market_db: AsyncSession = Depends(get_market_db)
) -> Dict[str, Any]:
    """
    Calculate one or more technical indicators for a symbol.

    Fetches historical data and computes requested technical indicators.
    Supports multiple indicators in a single request.

    **Request Body:**
    - **symbol**: Ticker symbol (e.g., SPY)
    - **timeframe**: Data timeframe (1m, 5m, 15m, 1h, 1d)
    - **start_date**: Start date for data (ISO 8601 format)
    - **end_date**: End date for data (ISO 8601 format)
    - **indicators**: List of indicators with their parameters

    **Supported Indicators:**
    - Uses TA-Lib-native function names such as `SMA`, `EMA`, `RSI`, `MACD`, `BBANDS`
    - Parameter names must match TA-Lib exactly, such as `timeperiod`, `fastperiod`, `slowperiod`
    - Output fields are returned exactly as TA-Lib names them

    **Example Request:**
    ```json
    {
        "symbol": "SPY",
        "timeframe": "1d",
        "start_date": "2024-01-01T00:00:00Z",
        "end_date": "2024-12-31T00:00:00Z",
        "indicators": [
            {"name": "SMA", "params": {"timeperiod": 20}},
            {"name": "RSI", "params": {"timeperiod": 14}},
            {"name": "MACD", "params": {"fastperiod": 12, "slowperiod": 26, "signalperiod": 9}}
        ]
    }
    ```

    **Returns:**
    - Time-series data with calculated indicator values
    """
    try:
        service = TechnicalAnalysisService(market_db)
        result = await service.calculate_indicators(
            symbol=request.symbol,
            timeframe=request.timeframe,
            start=request.start_date,
            end=request.end_date,
            indicators=request.indicators,
        )

        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/indicators",
    response_model=SupportedIndicatorsResponse,
    summary="List Supported Indicators",
    responses={
        200: {
            "description": "Successfully retrieved list of indicators",
            "content": {
                "application/json": {
                    "example": {
                        "indicators": [
                            {
                                "name": "SMA",
                                "display_name": "Simple Moving Average",
                                "inputs": ["close"],
                                "parameters": [{"name": "timeperiod", "default": 30}],
                                "output_names": ["real"],
                            },
                            {
                                "name": "MACD",
                                "display_name": "Moving Average Convergence/Divergence",
                                "inputs": ["close"],
                                "parameters": [{"name": "fastperiod", "default": 12}],
                                "output_names": ["macd", "macdsignal", "macdhist"],
                            },
                        ]
                    }
                }
            },
        },
        500: {"description": "Internal server error"},
    },
)
async def get_supported_indicators(market_db: AsyncSession = Depends(get_market_db)):
    """
    Get a comprehensive list of all supported technical indicators.

    Returns detailed information about each indicator including:
    - Indicator name and description
    - Required and optional parameters
    - Default parameter values
    - Parameter constraints

    **Returns:**
    - List of all available indicators with their specifications

    **Use Case:**
    - Call this endpoint first to discover available indicators
    - Use the returned information to construct requests for `/calculate`
    """
    try:
        service = TechnicalAnalysisService(market_db)
        indicators = service.get_supported_indicators()

        return SupportedIndicatorsResponse(indicators=indicators)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
