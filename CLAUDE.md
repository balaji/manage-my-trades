# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a full-stack algorithmic ETF trading application with a Python FastAPI backend and Next.js TypeScript frontend. The application supports backtesting, paper trading, technical analysis, and machine learning capabilities for trading strategies.

## Development Commands

### Starting the Application

```bash
# Start all services (PostgreSQL, backend, frontend)
docker-compose up -d

# Initialize database (required on first run)
docker-compose exec backend alembic upgrade head

# View logs
docker-compose logs -f [service_name]

# Stop all services
docker-compose down
```

### Backend Development

```bash
cd backend

# Install dependencies (using uv package manager)
uv sync

# Run backend locally (requires PostgreSQL running)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run tests
docker-compose exec backend pytest
# OR locally:
pytest

# Create database migration
docker-compose exec backend alembic revision --autogenerate -m "description"

# Apply migrations
docker-compose exec backend alembic upgrade head

# Rollback last migration
docker-compose exec backend alembic downgrade -1
```

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm build

# Run linting
npm run lint
```

## Architecture Overview

### Backend Architecture

The backend follows a layered architecture pattern:

**API Layer** (`app/api/v1/endpoints/`): FastAPI route handlers that accept HTTP requests, validate input via Pydantic schemas, and coordinate with services.

**Service Layer** (`app/services/`): Business logic components that orchestrate between external APIs, database models, and core algorithms. Key services:
- `alpaca_service.py`: Interfaces with Alpaca Markets API for market data and trading
- `market_data_service.py`: Caches and retrieves OHLCV data
- `strategy_service.py`: Manages strategy CRUD operations and configuration
- `signal_service.py`: Generates trading signals based on strategies
- `technical_analysis_service.py`: Coordinates indicator calculations

**Core Layer** (`app/core/`): Pure business logic and algorithms, isolated from I/O:
- `indicators/calculator.py`: Technical indicator implementations (SMA, EMA, RSI, MACD, Bollinger Bands, ATR, Stochastic) - all indicators are custom implementations using pandas/numpy
- `backtesting/`: Backtesting engine for strategy validation
- `strategies/`: Strategy pattern implementations (technical, ML-based, combined)
- `ml/`: Machine learning models for trading signals

**Data Layer** (`app/models/`, `app/db/`): SQLAlchemy ORM models and database session management using async patterns.

**Schemas** (`app/schemas/`): Pydantic models for request/response validation and serialization.

### Database Architecture

The application uses **PostgreSQL with TimescaleDB** for optimized time-series data storage:

- **TimescaleDB hypertables** are used for `market_data` and `indicator_cache` tables to optimize time-series queries
- Database migrations managed via Alembic
- Async database operations using SQLAlchemy 2.0 with asyncpg driver
- Connection pooling configured in `db/session.py`

### Strategy System

Strategies are defined with three types:
1. **Technical**: Based on technical indicators and price action
2. **ML**: Machine learning model predictions
3. **Combined**: Hybrid of technical and ML signals

Each strategy:
- Has multiple `StrategyIndicator` configurations (many-to-one relationship)
- Generates `Signal` records when conditions are met
- Can be backtested before activation
- Configuration stored as JSONB for flexibility

### Frontend Architecture

**Next.js 14 App Router** structure:
- `frontend/src/app/`: Next.js pages using App Router
- `frontend/src/components/`: Reusable React components
- `frontend/src/lib/`: API client utilities, types, and state management

**State Management**: Zustand for global state, React Query (@tanstack/react-query) for server state caching

**UI Components**: Built with shadcn/ui (Tailwind CSS + Radix UI primitives)

**Charts**: Recharts for performance metrics, lightweight-charts for candlestick charts

## Key Technical Patterns

### Async Database Operations

All database operations use async/await patterns:

```python
async with AsyncSessionLocal() as session:
    result = await session.execute(select(Model).where(...))
    return result.scalars().all()
```

The `get_db()` dependency function handles session lifecycle with automatic commit/rollback.

### Service Dependency Injection

Services are instantiated per request with database session injection:

```python
@router.get("/endpoint")
async def endpoint(db: AsyncSession = Depends(get_db)):
    service = SomeService(db)
    return await service.method()
```

### Technical Indicator Calculation

Indicators are calculated using pandas DataFrames in `app/core/indicators/calculator.py`. All indicators are **custom implementations** (not using TA-Lib) for full control and transparency. The calculator accepts OHLCV data and indicator configurations, returning computed values as time-series data.

### Configuration Management

Settings use Pydantic Settings with environment variable loading:
- `.env` file for local development
- Environment variables in docker-compose.yml for containers
- Cached settings via `@lru_cache()` decorator

### API Documentation

FastAPI auto-generates OpenAPI documentation:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- OpenAPI JSON: http://localhost:8000/openapi.json

Endpoints are organized by tags (market-data, technical-analysis, strategies, health).

## Important Implementation Details

### Alpaca Integration

- Uses `alpaca-py` library for market data and paper trading
- API credentials configured via environment variables (ALPACA_API_KEY, ALPACA_SECRET_KEY)
- Paper trading only - never use live API keys
- WebSocket support for real-time market data and order updates

### No Authentication System

This is a single-user application with no authentication layer. All API endpoints are publicly accessible when running locally.

### TimescaleDB Setup

The PostgreSQL container uses TimescaleDB extension. The `init-db.sql` script enables the extension on startup. Market data and indicator cache tables should be converted to hypertables for optimal performance.

### Model Storage

ML models are persisted using joblib to `/app/storage/models` directory. Model metadata and metrics are stored in the database (`ml_models` and `ml_model_metrics` tables).

## Development Workflow

1. **Make schema changes**: Modify SQLAlchemy models in `app/models/`
2. **Create migration**: `docker-compose exec backend alembic revision --autogenerate -m "description"`
3. **Review migration**: Check generated file in `backend/alembic/versions/`
4. **Apply migration**: `docker-compose exec backend alembic upgrade head`
5. **Update Pydantic schemas**: Modify request/response models in `app/schemas/`
6. **Implement service logic**: Add business logic to `app/services/`
7. **Create API endpoint**: Add route handler in `app/api/v1/endpoints/`
8. **Test via Swagger UI**: http://localhost:8000/docs

## Common Troubleshooting

### Database connection issues
```bash
docker-compose ps postgres  # Check if running
docker-compose logs postgres  # View logs
docker-compose restart postgres  # Restart
```

### Backend not starting
```bash
docker-compose logs backend  # Check error messages
docker-compose up -d --build backend  # Rebuild image
```

### Migration conflicts
```bash
# Rollback to specific version
docker-compose exec backend alembic downgrade <revision>
# Or reset to head
docker-compose exec backend alembic upgrade head
```

## Project Phase Status

✅ **Phase 1**: Foundation (Docker, database, basic API)
✅ **Phase 2**: Market Data & Indicators
✅ **Phase 3**: Strategy System
🔄 **Phase 4**: Backtesting Engine (in progress)
⏳ **Phase 5**: Paper Trading
⏳ **Phase 6**: Machine Learning
⏳ **Phase 7**: Testing & Polish

## External Dependencies

- **Alpaca Markets API**: Market data and paper trading (free tier available)
- **PostgreSQL/TimescaleDB**: Time-series optimized database
- **Python 3.13**: Backend runtime
- **Node.js**: Frontend development
- **uv**: Python package manager for backend
