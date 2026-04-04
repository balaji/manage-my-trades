# Manage My Trades Backend

FastAPI backend for ETF strategy research, backtesting, market-data caching, and paper-trading workflows.

## What This Service Does

- Fetches and caches OHLCV market data from Alpaca Markets.
- Calculates technical indicators with TA-Lib.
- Stores and manages trading strategies and their generated signals.
- Runs historical backtests and persists trades, results, and signals.
- Supports Google OAuth login with session cookies.
- Compiles natural-language strategy prompts into validated strategy specs using OpenAI and Langfuse.

## Tech Stack

- Python 3.13+
- FastAPI
- SQLAlchemy 2.x with async sessions
- PostgreSQL / TimescaleDB
- Alembic
- Alpaca Markets
- TA-Lib
- OpenAI
- Langfuse

## Project Layout

- `app/main.py` - FastAPI app entry point and router wiring
- `app/api/v1/endpoints/` - HTTP endpoints
- `app/core/` - backtesting, indicators, and strategy primitives
- `app/services/` - business logic and external integrations
- `app/models/` - SQLAlchemy models
- `app/schemas/` - request/response models
- `app/db/` - async session and database initialization
- `alembic_trade_data/` - migrations for strategies, backtests, users, signals, trades
- `alembic_market_data/` - migrations for market-data tables
- `scripts/` - maintenance utilities for Alpaca market data

## API Areas

The API is mounted under `/api/v1`.

- `/api/v1/market-data`
  - Fetch OHLCV bars
  - Search symbols
  - Get latest quotes
- `/api/v1/technical-analysis`
  - Calculate indicators
  - List supported indicators
- `/api/v1/strategies`
  - Create, list, update, delete strategies
  - Activate/deactivate strategies
  - Compile a natural-language strategy prompt
- `/api/v1/backtests`
  - Create and run backtests
  - List results, trades, and generated signals
- `/api/v1/auth`
  - Google login/callback
  - Session logout
  - Current user lookup

Health and root endpoints are available at `/health` and `/`.

## Configuration

Settings are loaded from environment variables, with `.env` support via `pydantic-settings`.

Required environment variables:

- `TRADE_DATA_DATABASE_URL`
- `MARKET_DATA_DATABASE_URL`
- `CORS_ORIGINS`

Common optional variables:

- `ALPACA_API_KEY`
- `ALPACA_SECRET_KEY`
- `ALPACA_BASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_BASE_URL`
- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`
- `LANGFUSE_BASE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `FRONTEND_CALLBACK_URL`
- `SESSION_SECRET_KEY`
- `SESSION_COOKIE_NAME`

Default trading constants:

- Commission: `0.0`
- Slippage: `0.001`

## Local Setup

Install dependencies:

```bash
uv sync
```

Run the API:

```bash
uv run fastapi dev --host 0.0.0.0
```

Or with Docker:

```bash
docker-compose up -d database
docker-compose up --build --watch backend
```

## Database Setup

This project uses two separate databases:

- Trade data DB for strategies, users, backtests, trades, and signals
- Market data DB for OHLCV bars and indicator cache

Apply migrations:

```bash
uv run alembic -c alembic_trade_data.ini upgrade head
uv run alembic -c alembic_market_data.ini upgrade head
```

With Docker:

```bash
docker-compose exec backend uv run alembic upgrade head
```

The app also initializes tables on startup via SQLAlchemy metadata creation.

## Testing

Run the test suite locally:

```bash
uv run pytest
```

The repository currently includes unit tests for:

- strategy schema and serialization contracts
- strategy spec validation
- technical indicator calculation
- user ownership and access control

## Formatting and Linting

Use Ruff for formatting and linting:

```bash
uv tool run --directory backend ruff format
uv tool run --directory backend ruff check --fix
```

## Maintenance Scripts

- `uv run python scripts/update_market_data.py`
  - Fetches new Alpaca bars for tracked symbol/timeframe pairs and bulk inserts them.
- `uv run python scripts/retry_failed_symbols.py`
  - Retries failed symbols from `failed_symbols.txt` and adds persistent failures to `alpaca_denylist.txt`.

## Notes

- Authentication is session-based and currently tied to Google OAuth.
- Strategy compilation requires `OPENAI_API_KEY`.
- Market-data endpoints fetch from Alpaca and cache locally in the market-data database.
- Backtests are user-scoped and operate on stored strategy specs.
