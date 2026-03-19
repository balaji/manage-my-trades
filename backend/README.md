# Backend — Algorithmic ETF Trading API

FastAPI backend for backtesting, signal generation, and paper trading of ETF strategies. Uses PostgreSQL/TimescaleDB for time-series data and integrates with Alpaca Markets for market data and order execution.

## Tech Stack

- **Python 3.13** with `uv` package manager
- **FastAPI** + **uvicorn** (ASGI)
- **SQLAlchemy 2.0** async + **asyncpg** driver
- **Alembic** for database migrations
- **Pandas / NumPy** for indicator calculations (no TA-Lib)
- **scikit-learn / joblib** for ML model support
- **alpaca-py** for market data and paper trading

## Architecture

```
app/
├── api/v1/endpoints/       # Route handlers (thin controllers)
├── services/               # Business logic + I/O coordination
├── core/                   # Pure algorithms (no I/O)
│   ├── indicators/         # Custom technical indicator implementations
│   ├── backtesting/        # Backtesting engine, portfolio, metrics
│   ├── strategies/         # Strategy pattern implementations
│   └── ml/                 # ML model wrappers
├── models/                 # SQLAlchemy ORM models
├── schemas/                # Pydantic request/response models
├── db/session.py           # Dual-database session management
├── config.py               # Pydantic Settings (env-based)
└── main.py                 # FastAPI app, lifespan, CORS
```

### Dual Database Design

The application uses two separate PostgreSQL databases to separate concerns:

| Database | Managed By | Contains |
|---|---|---|
| **Trade Data DB** | `get_db()` | Strategies, signals, backtests, trades, orders, positions, ML models |
| **Market Data DB** | `get_market_db()` | OHLCV bars (cached), indicator cache |

Both databases use TimescaleDB hypertables on time-series tables (`market_data`, `indicator_cache`) for optimized range queries and compression.

### Request Flow

```
HTTP Request → API Endpoint → Service (I/O + orchestration) → Core (pure logic) → DB / Alpaca API
```

## API Endpoints

Base URL: `http://localhost:8000/api/v1`

### Market Data — `/market-data`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/bars` | Fetch OHLCV bars for symbols (cache-first) |
| `GET` | `/search?query=` | Search ticker symbols |
| `GET` | `/quote/{symbol}` | Get latest real-time quote |

### Technical Analysis — `/technical-analysis`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/calculate` | Calculate indicators for a symbol and date range |
| `GET` | `/indicators` | List all supported indicators with parameters |

### Strategies — `/strategies`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/` | Create a new strategy |
| `GET` | `/` | List strategies (filter: `is_active`, `strategy_type`) |
| `GET` | `/{id}` | Get strategy details |
| `PUT` | `/{id}` | Update strategy |
| `DELETE` | `/{id}` | Delete strategy (cascades to signals, backtests) |
| `POST` | `/{id}/activate` | Activate strategy |
| `POST` | `/{id}/deactivate` | Deactivate strategy |
| `POST` | `/{id}/signals` | Generate signals for a symbol |
| `GET` | `/{id}/signals` | Get historical signals (filter: `symbol`, `signal_type`, date range) |

### Backtests — `/backtests`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/` | Create a backtest record (status: `pending`) |
| `POST` | `/{id}/run` | Execute the backtest |
| `GET` | `/` | List backtests (filter: `strategy_id`, `status`) |
| `GET` | `/{id}` | Get backtest with full results |
| `GET` | `/{id}/trades` | Get individual trade records |
| `DELETE` | `/{id}` | Delete backtest |

API documentation is auto-generated at `http://localhost:8000/docs`.

## Database Models

### Trade Data DB

| Model | Key Fields | Purpose |
|-------|-----------|---------|
| `Strategy` | `name`, `strategy_type`, `is_active`, `config` (JSON) | Strategy definitions |
| `StrategyIndicator` | `indicator_name`, `parameters` (JSON), `usage` | Per-strategy indicator config |
| `Signal` | `symbol`, `signal_type`, `timestamp`, `price`, `strength`, `indicators` (JSON) | Generated trading signals |
| `Backtest` | `symbols`, `start_date`, `end_date`, `initial_capital`, `status` | Backtest execution records |
| `BacktestResult` | `total_return`, `sharpe_ratio`, `max_drawdown`, `win_rate`, `equity_curve` (JSON) | Performance metrics |
| `Trade` | `symbol`, `side`, `entry_price`, `exit_price`, `pnl`, `status` | Individual executed trades |
| `Position` | `symbol`, `quantity`, `avg_entry_price`, `unrealized_pnl` | Paper trading positions |
| `Order` | `alpaca_order_id`, `symbol`, `quantity`, `status`, `filled_avg_price` | Paper trading orders |
| `MLModel` | `model_type`, `features`, `file_path`, `trained_at` | ML model metadata |

### Market Data DB

| Model | Key Fields | Purpose |
|-------|-----------|---------|
| `MarketData` | `symbol`, `timeframe`, `trade_date`, `open`, `high`, `low`, `close`, `volume` | Cached OHLCV bars |
| `IndicatorCache` | `symbol`, `indicator_name`, `indicator_params_hash`, `timestamp`, `value` | Cached indicator values |

## Technical Indicators

All indicators are **custom implementations** using pandas/numpy. No TA-Lib dependency.

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

The backtest engine (`app/core/backtesting/`) simulates trading a strategy on historical data:

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
