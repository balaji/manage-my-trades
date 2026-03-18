# Project Overview
FastAPI backend for backtesting, signal generation, and paper trading of ETF strategies. Uses PostgreSQL/TimescaleDB for time-series data and integrates with Alpaca Markets for market data and order execution.

# Development

## Running Locally (Docker)
Start databases: `docker-compose up -d database`
Start backend with hot reload: `docker-compose up --build --watch backend`
Apply migrations `docker-compose exec backend uv run alembic upgrade head`
View logs `docker-compose logs -f backend`

## Running Locally (without Docker)
Install dependencies `uv sync`
Start backend (requires PostgreSQL running) `uv run fastapi dev --host 0.0.0.0`

There are two separate Alembic configs:
- `alembic_trade_data/` — trade DB (strategies, signals, backtests)
- `alembic_market_data/` — market data DB (OHLCV, indicator cache)

## Testing
Run tests via Docker: `docker-compose exec backend uv run pytest`
Run tests locally: `cd backend && uv run pytest`

## Formatting & Linting
Format Python files `uv tool run --directory backend ruff format {staged_files}`
Lint with auto-fixes `uv tool run --directory backend ruff check --fix {staged_files}`

# Project Domain
This project deals with Algotrading using Technical Analysis using Indicators, so keep in context the following
- Use precise definitions for strategies, signals, and indicators.
- Check with the operator if they want you to implement by hand or use a third-party library
