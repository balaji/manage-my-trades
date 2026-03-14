# Manage My Trades — Algorithmic ETF Trading Platform

A full-stack platform for managing trading strategies, running backtests, and performing technical analysis. Features a Next.js frontend for strategy management and technical analysis visualization, and a FastAPI backend for signal generation, backtesting, and paper trading with Alpaca Markets.

## Features

- **Strategy Management**: Create, activate, and deactivate strategies with dynamic indicator configuration
- **Backtesting Engine**: Simulate strategies on historical data with comprehensive metrics (Sharpe ratio, max drawdown, win rate, etc.)
- **Technical Analysis**: Interactive charting with candlestick + SMA/EMA/Bollinger Bands overlays and RSI/BB% sub-panels
- **Signal Generation**: Generate trading signals based on strategy indicator conditions
- **Paper Trading**: Execute orders through Alpaca Markets API
- **Technical Indicators**: SMA, EMA, RSI, MACD, Bollinger Bands, Stochastic, ATR
- **Market Data Integration**: Symbol search, real-time quotes, historical OHLCV bars

## Tech Stack

| Layer | Frontend | Backend |
|-------|----------|---------|
| **Framework** | Next.js 16 (App Router), React 19, TypeScript 5.3 | FastAPI, Python 3.13, uvicorn |
| **Database** | — | PostgreSQL/TimescaleDB (dual: trade + market data) |
| **ORM** | — | SQLAlchemy 2.0 + asyncpg |
| **Styling** | Tailwind CSS 3, CSS design tokens | — |
| **Charting** | lightweight-charts v4, recharts v2 | — |
| **HTTP** | Axios (singleton) | FastAPI + CORS |
| **Indicators** | — | Pandas/NumPy (custom implementations) |
| **ML/Backtesting** | — | scikit-learn, joblib |
| **Market Data** | — | alpaca-py |
| **Utilities** | clsx, tailwind-merge, class-variance-authority, date-fns | Alembic (migrations) |

## Project Structure

```
.
├── frontend/                           # Next.js web application
│   ├── src/
│   │   ├── app/                        # Pages (strategies, backtests, technical-analysis)
│   │   ├── components/                 # Charts, forms, UI components
│   │   └── lib/                        # API client, types, utilities
│   ├── Dockerfile
│   └── package.json
├── backend/                            # FastAPI service
│   ├── app/
│   │   ├── api/v1/endpoints/           # Route handlers
│   │   ├── services/                   # Business logic
│   │   ├── core/                       # Pure algorithms (indicators, backtesting)
│   │   ├── models/                     # SQLAlchemy ORM models
│   │   ├── schemas/                    # Pydantic request/response models
│   │   ├── db/                         # Dual database session management
│   │   └── main.py                     # FastAPI app, CORS, lifespan
│   ├── tests/
│   ├── alembic_trade_data/             # Trade DB migrations
│   ├── alembic_market_data/            # Market data DB migrations
│   ├── Dockerfile
│   └── pyproject.toml
├── docker-compose.yml
└── README.md
```

## Getting Started

### Prerequisites

- **Node.js 18+** (frontend)
- **Python 3.13** with `uv` (backend)
- **Docker & Docker Compose** (optional, recommended for databases)
- **Alpaca paper trading account** (free at https://alpaca.markets)

### Option 1: Docker Compose (Recommended)

```bash
# Start databases
docker-compose up -d database

# Start backend
docker-compose up --build --watch backend

# In another terminal, apply migrations
docker-compose exec backend uv run alembic upgrade head

# In another terminal, start frontend
docker-compose up --build --watch frontend

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

**Access:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Option 2: Local Development (without Docker)

**Backend:**
```bash
cd backend

# Install dependencies
uv sync

# Requires PostgreSQL running locally
# Start backend with auto-reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend:**
```bash
cd frontend

# Install dependencies
npm install

# Start frontend (requires backend running)
npm run dev
```

### Environment Variables

**Frontend** (`.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

**Backend** (`.env`):
```env
APP_NAME=Algorithmic ETF Trading
DEBUG=true
LOG_LEVEL=INFO

# Databases
TRADE_DATA_DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/trade_db
MARKET_DATA_DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5433/market_db

# Alpaca (paper trading only — never use live keys)
ALPACA_API_KEY=your_key
ALPACA_SECRET_KEY=your_secret
ALPACA_BASE_URL=https://paper-api.alpaca.markets

# Backtest defaults
DEFAULT_COMMISSION=0.0
DEFAULT_SLIPPAGE=0.001

# CORS
CORS_ORIGINS=["http://localhost:3000"]
```

## Development Workflow

### Backend

```bash
cd backend

# Format code
uv tool run ruff format

# Lint with auto-fixes
uv tool run ruff check --fix

# Run tests
uv run pytest

# Run specific test
uv run pytest tests/unit/test_indicator_calculator.py -v

# Database migrations
uv run alembic -c alembic_trade_data/alembic_trade_data.ini revision --autogenerate -m "description"
uv run alembic -c alembic_trade_data/alembic_trade_data.ini upgrade head
uv run alembic -c alembic_trade_data/alembic_trade_data.ini downgrade -1
```

### Frontend

```bash
cd frontend

# Development
npm run dev

# Build
npm run build

# Lint
npm run lint

# Format (staged files)
npm run format
```

### API Documentation

Auto-generated Swagger/OpenAPI docs available at http://localhost:8000/docs with interactive testing.

## API Endpoints

Base URL: `http://localhost:8000/api/v1`

| Domain | Method | Path | Description |
|--------|--------|------|-------------|
| **Market Data** | `POST` | `/market-data/bars` | Fetch OHLCV bars (cache-first) |
| | `GET` | `/market-data/search` | Search ticker symbols |
| | `GET` | `/market-data/quote/{symbol}` | Get latest real-time quote |
| **Technical Analysis** | `POST` | `/technical-analysis/calculate` | Calculate indicators |
| | `GET` | `/technical-analysis/indicators` | List supported indicators |
| **Strategies** | `POST` | `/strategies/` | Create strategy |
| | `GET` | `/strategies/` | List strategies (filter: `is_active`, `strategy_type`) |
| | `GET` | `/strategies/{id}` | Get strategy details |
| | `PUT` | `/strategies/{id}` | Update strategy |
| | `DELETE` | `/strategies/{id}` | Delete strategy (cascades) |
| | `POST` | `/strategies/{id}/activate` | Activate strategy |
| | `POST` | `/strategies/{id}/deactivate` | Deactivate strategy |
| | `POST` | `/strategies/{id}/signals` | Generate signals |
| | `GET` | `/strategies/{id}/signals` | Get historical signals (filter: `symbol`, `signal_type`, date range) |
| **Backtests** | `POST` | `/backtests/` | Create backtest record |
| | `POST` | `/backtests/{id}/run` | Execute backtest |
| | `GET` | `/backtests/` | List backtests (filter: `strategy_id`, `status`) |
| | `GET` | `/backtests/{id}` | Get backtest with results |
| | `GET` | `/backtests/{id}/trades` | Get trade records |
| | `DELETE` | `/backtests/{id}` | Delete backtest |

Auto-generated API docs available at `http://localhost:8000/docs`.

## Database Architecture

### Dual Database Design

Two separate PostgreSQL/TimescaleDB databases separate concerns and optimize queries:

| Database | Contains | Use Case |
|----------|----------|----------|
| **Trade Data DB** | Strategies, signals, backtests, trades, orders, positions, ML models | Strategy definition and execution |
| **Market Data DB** | OHLCV bars (cached), indicator cache | Time-series queries and compression |

TimescaleDB hypertables optimize range queries and compression on time-series tables.

### Core Models

**Trade Data:**
- `Strategy` — Strategy definitions with configuration
- `StrategyIndicator` — Per-strategy indicator configuration
- `Signal` — Generated trading signals
- `Backtest` — Backtest execution records
- `BacktestResult` — Performance metrics and equity curves
- `Trade` — Individual executed trades
- `Position` — Paper trading positions
- `Order` — Alpaca paper trading orders
- `MLModel` — ML model metadata

**Market Data:**
- `MarketData` — Cached OHLCV bars (TimescaleDB hypertable)
- `IndicatorCache` — Cached indicator values

## Technical Indicators

All indicators are custom implementations using pandas/numpy. No TA-Lib dependency.

| Indicator | Parameters | Output |
|-----------|-----------|--------|
| **SMA** | `length` (default: 20) | Series |
| **EMA** | `length` (default: 20) | Series |
| **RSI** | `length` (default: 14) | Series (0–100) |
| **MACD** | `fast` (12), `slow` (26), `signal` (9) | DataFrame: macd, signal, histogram |
| **Bollinger Bands** | `length` (20), `std` (2.0) | DataFrame: upper, middle, lower, bandwidth, percent_b |
| **Stochastic** | `k` (14), `d` (3), `smooth_k` (3) | DataFrame: %K, %D |
| **ATR** | `length` (default: 14) | Series |

## Backtesting Engine

The backtest engine simulates trading a strategy on historical data:

1. **Fetch bars** from market data service (cached or Alpaca API)
2. **Generate signals** using the strategy's indicator conditions
3. **Build chronological timeline** merging all symbol timestamps
4. **Simulate bar-by-bar**: process sell signals first (free cash), then buy signals
5. **Apply commission and slippage** via `OrderExecutor`
6. **Size positions** via `PositionSizer` (strategy config: `fixed_percentage`, `kelly`, `fixed_shares`)
7. **Record equity snapshots** for curve and drawdown calculation
8. **Compute metrics**: total return, Sharpe ratio, max drawdown, win rate, profit factor

### Metrics

- **Total Return**: `(final - initial) / initial * 100`
- **Sharpe Ratio**: `mean_daily_return / std_daily_return * sqrt(252)` (2% risk-free rate)
- **Max Drawdown**: Largest peak-to-trough decline in equity curve
- **Win Rate**: `winning_trades / total_trades * 100`
- **P&L per trade**: `(exit - entry) * qty - 2 * commission`

## Key Components

**Backend:**
- **Backtesting Engine** — Bar-by-bar simulation with signal processing, order execution, position sizing
- **Technical Indicators** — Custom pandas/numpy implementations
- **Signal Generator** — Evaluates strategy rules against market data
- **Position Sizer** — Supports fixed %, Kelly criterion, and fixed share strategies

**Frontend:**
- **PriceChart** — TradingView `lightweight-charts` candlestick with overlay series and axis synchronization
- **OscillatorChart** — RSI and BB% sub-panel with synchronized time axis
- **StrategyForm** — Dynamic form for strategy creation with 7 indicator types
- **API Client** — Unified Axios singleton with error normalization

## Notes

- No authentication or protected routes currently implemented
- Frontend uses manual `useEffect` + `useState` patterns; `@tanstack/react-query` and `zustand` are installed and ready to adopt
- Frontend theming infrastructure is shadcn/ui-ready but no shadcn components installed yet
- Backend test fixtures provide synthetic OHLCV data for unit testing without network/database dependencies
- This is a single-user application; use paper trading API keys only (never live trading keys)
