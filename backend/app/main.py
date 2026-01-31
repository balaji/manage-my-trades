"""
FastAPI application entry point.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.config import get_settings
from app.db.session import init_db
from app.api.v1 import api_router

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    logger.info("Starting up application...")
    try:
        await init_db()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise

    yield

    # Shutdown
    logger.info("Shutting down application...")


# OpenAPI tags metadata
tags_metadata = [
    {
        "name": "market-data",
        "description": "Operations for fetching and searching market data including OHLCV bars, quotes, and symbol search.",
    },
    {
        "name": "technical-analysis",
        "description": "Technical indicator calculations including SMA, EMA, RSI, MACD, Bollinger Bands, and more.",
    },
    {
        "name": "strategies",
        "description": "Create and manage trading strategies with indicator configurations. Generate and retrieve trading signals.",
    },
    {
        "name": "backtests",
        "description": "Create and run backtests to test strategies on historical data. Includes performance metrics and trade history.",
    },
    {
        "name": "health",
        "description": "Health check and system status endpoints.",
    },
]

# Create FastAPI application with enhanced OpenAPI configuration
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="""
## Algorithmic ETF Trading Platform API

A comprehensive API for algorithmic trading with support for:

* **Market Data** - Real-time and historical OHLCV data via Alpaca Markets
* **Technical Analysis** - Calculate various technical indicators
* **Strategy Management** - Create and manage trading strategies
* **Backtesting** - Test strategies against historical data
* **Paper Trading** - Simulate live trading without real money
* **Portfolio Management** - Track positions and performance

### Getting Started

1. Obtain API credentials from [Alpaca Markets](https://alpaca.markets)
2. Configure your environment variables
3. Use the `/api/v1/market-data` endpoints to fetch data
4. Calculate indicators using `/api/v1/technical-analysis`
5. Create and test strategies

### Authentication

Currently, API authentication is managed through environment variables.
Future versions will include API key authentication for endpoints.
    """,
    debug=settings.DEBUG,
    lifespan=lifespan,
    openapi_tags=tags_metadata,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    contact={
        "name": "Trading Platform Support",
        "email": "support@example.com",
    },
    license_info={
        "name": "MIT",
    },
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["health"])
async def health_check():
    """
    Health check endpoint.

    Returns the current health status of the API and system information.
    """
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Algorithmic ETF Trading API",
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": "/health",
    }
