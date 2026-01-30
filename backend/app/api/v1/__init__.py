"""
API v1 router.
"""
from fastapi import APIRouter

api_router = APIRouter()

# Import and include endpoint routers as they are created
# from app.api.v1.endpoints import market_data, strategies, backtests, etc.

@api_router.get("/")
async def api_root():
    """API v1 root endpoint."""
    return {
        "message": "API v1",
        "endpoints": {
            "market_data": "/market-data",
            "strategies": "/strategies",
            "backtests": "/backtests",
            "paper_trading": "/paper-trading",
            "technical_analysis": "/technical-analysis",
            "ml_models": "/ml-models",
            "portfolio": "/portfolio"
        }
    }
