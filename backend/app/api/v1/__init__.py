"""
API v1 router.
"""

from fastapi import APIRouter
from app.api.v1.endpoints import market_data, technical_analysis, strategies, backtests, indicators, portfolios

api_router = APIRouter()

# Include endpoint routers
api_router.include_router(market_data.router, prefix="/market-data", tags=["market-data"])
api_router.include_router(technical_analysis.router, prefix="/technical-analysis", tags=["technical-analysis"])
api_router.include_router(strategies.router, prefix="/strategies", tags=["strategies"])
api_router.include_router(backtests.router, prefix="/backtests", tags=["backtests"])
api_router.include_router(indicators.router, prefix="/indicators", tags=["indicators"])
api_router.include_router(portfolios.router, prefix="/portfolios", tags=["portfolios"])


@api_router.get("/")
async def api_root():
    """API v1 root endpoint."""
    return {
        "message": "API v1",
        "endpoints": {
            "market_data": "/market-data",
            "strategies": "/strategies",
            "strategy_compile": "/strategies/compile",
            "backtests": "/backtests",
            "paper_trading": "/paper-trading",
            "technical_analysis": "/technical-analysis",
            "ml_models": "/ml-models",
            "portfolio": "/portfolio",
        },
    }
