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


@router.post("/bars", response_model=List[MarketDataResponse])
async def get_market_data(
    request: MarketDataRequest,
    use_cache: bool = Query(True, description="Use cached data if available"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get OHLCV bar data for symbols.

    - **symbols**: List of ticker symbols (e.g., ["SPY", "QQQ"])
    - **start_date**: Start date for data
    - **end_date**: End date for data
    - **timeframe**: Timeframe (1m, 5m, 15m, 1h, 1d)
    - **use_cache**: Whether to use cached data
    """
    try:
        service = MarketDataService(db)
        data = await service.get_bars(
            symbols=request.symbols,
            start=request.start_date,
            end=request.end_date,
            timeframe=request.timeframe,
            use_cache=use_cache
        )

        response = []
        for symbol, bars in data.items():
            response.append(
                MarketDataResponse(
                    symbol=symbol,
                    timeframe=request.timeframe,
                    bars=[OHLCVBar(**bar) for bar in bars]
                )
            )

        return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search", response_model=SymbolSearchResponse)
async def search_symbols(
    query: str = Query(..., description="Search query"),
    db: AsyncSession = Depends(get_db)
):
    """
    Search for ticker symbols.

    - **query**: Search query (symbol or name)
    """
    try:
        service = MarketDataService(db)
        symbols = await service.search_symbols(query)

        return SymbolSearchResponse(
            symbols=[SymbolInfo(**s) for s in symbols]
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/quote/{symbol}", response_model=LatestQuote)
async def get_latest_quote(
    symbol: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get latest quote for a symbol.

    - **symbol**: Ticker symbol (e.g., SPY)
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
