"""
Market data API endpoints.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.services.market_data_service import MarketDataService
from app.schemas.market_data import (
    MarketDataRequest,
    MarketDataResponse,
    SymbolSearchResponse,
    SymbolInfo,
    LatestQuote,
    OHLCVBar,
)

router = APIRouter()


@router.post(
    "/bars",
    response_model=List[MarketDataResponse],
    summary="Get OHLCV Bar Data",
    responses={
        200: {
            "description": "Successfully retrieved bar data",
            "content": {
                "application/json": {
                    "example": [
                        {
                            "symbol": "SPY",
                            "timeframe": "1d",
                            "bars": [
                                {
                                    "timestamp": "2024-01-01T00:00:00Z",
                                    "open": 450.5,
                                    "high": 452.0,
                                    "low": 449.0,
                                    "close": 451.5,
                                    "volume": 50000000,
                                }
                            ],
                        }
                    ]
                }
            },
        },
        500: {"description": "Internal server error"},
    },
)
async def get_market_data(
    request: MarketDataRequest,
    use_cache: bool = Query(True, description="Use cached data if available"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get OHLCV (Open, High, Low, Close, Volume) bar data for one or more symbols.

    Fetches historical market data from Alpaca Markets API with optional caching.

    **Request Body:**
    - **symbols**: List of ticker symbols (e.g., ["SPY", "QQQ", "IWM"])
    - **start_date**: Start date for data (ISO 8601 format)
    - **end_date**: End date for data (ISO 8601 format)
    - **timeframe**: Data timeframe - Options: 1m, 5m, 15m, 1h, 1d

    **Query Parameters:**
    - **use_cache**: Whether to use cached data if available (default: true)

    **Returns:**
    - List of market data responses, one per symbol with OHLCV bars
    """
    try:
        service = MarketDataService(db)
        data = await service.get_bars(
            symbols=request.symbols,
            start=request.start_date,
            end=request.end_date,
            timeframe=request.timeframe,
            use_cache=use_cache,
        )

        response = []
        for symbol, bars in data.items():
            response.append(
                MarketDataResponse(
                    symbol=symbol,
                    timeframe=request.timeframe,
                    bars=[OHLCVBar(**bar) for bar in bars],
                )
            )

        return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/search",
    response_model=SymbolSearchResponse,
    summary="Search Ticker Symbols",
    responses={
        200: {
            "description": "Successfully retrieved matching symbols",
            "content": {
                "application/json": {
                    "example": {
                        "symbols": [
                            {
                                "symbol": "SPY",
                                "name": "SPDR S&P 500 ETF Trust",
                                "exchange": "ARCA",
                                "asset_type": "ETF",
                            }
                        ]
                    }
                }
            },
        },
        500: {"description": "Internal server error"},
    },
)
async def search_symbols(
    query: str = Query(..., description="Search query (symbol or company name)", min_length=1),
    db: AsyncSession = Depends(get_db),
):
    """
    Search for ticker symbols by symbol code or company name.

    **Query Parameters:**
    - **query**: Search term (minimum 1 character)

    **Returns:**
    - List of matching symbols with their details (name, exchange, asset type)

    **Example:**
    - Query: "SPY" returns S&P 500 ETF
    - Query: "S&P" returns all symbols matching "S&P"
    """
    try:
        service = MarketDataService(db)
        symbols = await service.search_symbols(query)

        return SymbolSearchResponse(symbols=[SymbolInfo(**s) for s in symbols])

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/quote/{symbol}",
    response_model=LatestQuote,
    summary="Get Latest Quote",
    responses={
        200: {
            "description": "Successfully retrieved latest quote",
            "content": {
                "application/json": {
                    "example": {
                        "symbol": "SPY",
                        "bid": 450.25,
                        "ask": 450.30,
                        "last": 450.27,
                        "timestamp": "2024-01-01T15:59:00Z",
                    }
                }
            },
        },
        404: {"description": "Symbol not found"},
        500: {"description": "Internal server error"},
    },
)
async def get_latest_quote(symbol: str, db: AsyncSession = Depends(get_db)):
    """
    Get the most recent quote (bid/ask/last price) for a symbol.

    **Path Parameters:**
    - **symbol**: Ticker symbol (e.g., SPY, QQQ, IWM)

    **Returns:**
    - Latest quote with bid, ask, last price and timestamp

    **Note:**
    - Quote data is real-time during market hours
    - May return last available quote when market is closed
    """
    try:
        service = MarketDataService(db)
        quote = await service.get_latest_quote(symbol)

        if not quote:
            raise HTTPException(status_code=404, detail=f"Quote not found for {symbol}")

        return LatestQuote(**quote)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
