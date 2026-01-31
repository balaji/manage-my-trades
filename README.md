# Algorithmic ETF Trading Application

A full-stack algorithmic trading application for ETFs with Python FastAPI backend and Next.js TypeScript frontend, featuring backtesting, paper trading, technical analysis, and machine learning capabilities.

## Features

- **Strategy System**: Create and manage technical, ML-based, and combined trading strategies
- **Backtesting Engine**: Test strategies on historical data with comprehensive performance metrics
- **Paper Trading**: Execute strategies in real-time using Alpaca's paper trading API
- **Technical Analysis**: Built-in indicators (SMA, EMA, RSI, MACD, Bollinger Bands, ATR, Stochastic)
- **Machine Learning**: Train and deploy ML models for trading signals
- **Real-time Data**: WebSocket support for live market data and order updates
- **Portfolio Tracking**: Monitor performance with equity curves and detailed metrics

## Tech Stack

### Backend
- **FastAPI 0.109.0**: Modern async Python web framework
- **PostgreSQL + TimescaleDB**: Optimized time-series database
- **SQLAlchemy 2.0 + Alembic**: ORM and database migrations
- **pandas + numpy**: Custom technical indicators implementation
- **scikit-learn 1.4.0**: Machine learning framework
- **alpaca-py 0.15.0**: Alpaca trading API client

### Frontend
- **Next.js 14.1**: React framework with App Router
- **TypeScript 5.3**: Type-safe JavaScript
- **Tailwind CSS + shadcn/ui**: Modern UI components
- **Recharts + lightweight-charts**: Data visualization
- **Zustand + React Query**: State management

## Prerequisites

- Docker and Docker Compose
- Git
- Alpaca paper trading account (free at https://alpaca.markets)
- Node.js and `npm` for frontend development
- `uv` for backend development

## Quick Start

### 1. Clone the Repository

```bash
cd /home/balaji/projects/manage-my-trades
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and add your Alpaca API credentials:

```env
ALPACA_API_KEY=your_alpaca_api_key_here
ALPACA_SECRET_KEY=your_alpaca_secret_key_here
```

You can get free paper trading API keys from: https://app.alpaca.markets/paper/dashboard/overview

### 3. Start the Application

```bash
docker-compose up -d
```

This will start three services:
- PostgreSQL with TimescaleDB (port 5432)
- Backend API (port 8000)
- Frontend (port 3000)

### 4. Initialize the Database

Run database migrations:

```bash
docker-compose exec backend alembic upgrade head
```

### 5. Access the Application

- **Frontend**: http://localhost:3000
- **API Documentation (Swagger UI)**: http://localhost:8000/docs
- **API Documentation (ReDoc)**: http://localhost:8000/redoc
- **OpenAPI Schema**: http://localhost:8000/openapi.json
- **API Health**: http://localhost:8000/health

## Project Structure

```
manage-my-trades/
├── backend/
│   ├── app/
│   │   ├── main.py                    # FastAPI entry point
│   │   ├── config.py                  # Configuration
│   │   ├── api/v1/endpoints/          # API routes
│   │   ├── models/                    # SQLAlchemy models
│   │   ├── schemas/                   # Pydantic schemas
│   │   ├── services/                  # Business logic
│   │   ├── core/
│   │   │   ├── indicators/            # Technical indicators
│   │   │   ├── backtesting/           # Backtesting engine
│   │   │   ├── strategies/            # Strategy implementations
│   │   │   └── ml/                    # ML models
│   │   └── db/                        # Database session
│   ├── alembic/                       # Database migrations
│   ├── tests/                         # Tests
│   ├── storage/                       # ML models and cache
│   ├── pyproject.toml
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── app/                       # Next.js pages
│   │   ├── components/                # React components
│   │   └── lib/                       # Utilities and types
│   ├── package.json
│   └── Dockerfile
│
├── docker-compose.yml
├── init-db.sql
└── README.md
```

## Development

### Backend Development

To work on the backend with hot reload:

```bash
cd backend

# Create virtual environment (optional, for local development)
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
uv sync

# Run locally (make sure PostgreSQL is running)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Access the auto-generated API documentation at http://localhost:8000/docs

### Frontend Development

To work on the frontend with hot reload:

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

Access the frontend at http://localhost:3000

### Database Migrations

Create a new migration:

```bash
docker-compose exec backend alembic revision --autogenerate -m "Description"
```

Apply migrations:

```bash
docker-compose exec backend alembic upgrade head
```

Rollback migration:

```bash
docker-compose exec backend alembic downgrade -1
```

## API Documentation

The backend API includes comprehensive Swagger/OpenAPI documentation with interactive testing capabilities.

### Accessing API Documentation

- **Swagger UI** (Interactive): http://localhost:8000/docs
  - Full interactive API documentation
  - Test endpoints directly from the browser
  - View request/response schemas and examples
  - Organized by tags (Market Data, Technical Analysis, etc.)

- **ReDoc** (Alternative): http://localhost:8000/redoc
  - Clean, three-panel documentation layout
  - Better for reading and understanding API structure
  - Includes example requests and responses

- **OpenAPI Schema**: http://localhost:8000/openapi.json
  - Raw OpenAPI 3.0 specification in JSON format
  - Use with code generators and API tools

### API Features

- **Automatic Schema Generation**: All endpoints have auto-generated schemas from Pydantic models
- **Request Validation**: Built-in validation with helpful error messages
- **Response Examples**: Each endpoint includes example responses
- **Tag Organization**: Endpoints grouped by functionality
- **Status Codes**: Clear documentation of all possible response codes

### Using Swagger UI

1. Navigate to http://localhost:8000/docs
2. Browse endpoints by category (Market Data, Technical Analysis, etc.)
3. Click on any endpoint to expand details
4. Click "Try it out" to test the endpoint
5. Fill in parameters and request body
6. Click "Execute" to send the request
7. View the response with status code, headers, and body

## API Endpoints

### Market Data
- `POST /api/v1/market-data/bars` - Get OHLCV bar data for symbols
- `GET /api/v1/market-data/search` - Search for ticker symbols
- `GET /api/v1/market-data/quote/{symbol}` - Get latest quote for a symbol

### Strategies
- `GET /api/v1/strategies/` - List all strategies
- `POST /api/v1/strategies/` - Create new strategy
- `GET /api/v1/strategies/{id}` - Get strategy details
- `PUT /api/v1/strategies/{id}` - Update strategy
- `DELETE /api/v1/strategies/{id}` - Delete strategy
- `GET /api/v1/strategies/{id}/signals` - Get strategy signals

### Backtests
- `GET /api/v1/backtests/` - List all backtests
- `POST /api/v1/backtests/` - Create and run backtest
- `GET /api/v1/backtests/{id}` - Get backtest details
- `GET /api/v1/backtests/{id}/results` - Get backtest results
- `GET /api/v1/backtests/{id}/trades` - Get backtest trades

### Paper Trading
- `GET /api/v1/paper-trading/account` - Get account info
- `GET /api/v1/paper-trading/positions` - Get current positions
- `POST /api/v1/paper-trading/orders` - Place order
- `GET /api/v1/paper-trading/orders` - Get orders
- `DELETE /api/v1/paper-trading/orders/{id}` - Cancel order

### Technical Analysis
- `POST /api/v1/technical-analysis/calculate` - Calculate technical indicators for a symbol
- `GET /api/v1/technical-analysis/indicators` - Get list of supported indicators

### ML Models
- `GET /api/v1/ml-models/` - List ML models
- `POST /api/v1/ml-models/` - Create ML model
- `POST /api/v1/ml-models/{id}/train` - Train model
- `POST /api/v1/ml-models/{id}/predict` - Get predictions

### Portfolio
- `GET /api/v1/portfolio/summary` - Get portfolio summary
- `GET /api/v1/portfolio/history` - Get equity curve

### WebSockets
- `ws://localhost:8000/ws/market-data` - Real-time market data
- `ws://localhost:8000/ws/signals` - Real-time trading signals
- `ws://localhost:8000/ws/orders` - Order updates

## Database Schema

### Core Tables

- **strategies**: Strategy definitions with configuration
- **strategy_indicators**: Indicator configuration per strategy
- **backtests**: Backtest run metadata
- **backtest_results**: Performance metrics and equity curves
- **trades**: All trades (backtest and paper)
- **signals**: Trading signals generated by strategies
- **positions**: Current paper trading positions
- **orders**: Paper trading orders
- **ml_models**: ML model metadata
- **ml_model_metrics**: Model performance metrics
- **market_data**: OHLCV data cache (TimescaleDB hypertable)
- **indicator_cache**: Computed indicator values
- **portfolio_history**: Portfolio equity curve

## Implementation Phases

The application is designed to be implemented in phases:

1. ✅ **Phase 1**: Foundation (Docker, database, basic API)
2. ✅ **Phase 2**: Market Data & Indicators
3. ✅ **Phase 3**: Strategy System
4. **Phase 4**: Backtesting Engine
5. **Phase 5**: Paper Trading
6. **Phase 6**: Machine Learning
7. **Phase 7**: Testing & Polish

## Testing

Run backend tests:

```bash
docker-compose exec backend pytest
```

Run frontend tests:

```bash
cd frontend
npm test
```

## Performance Considerations

- TimescaleDB hypertables optimize time-series queries for market data
- Indicator caching reduces redundant calculations
- Async database operations for better concurrency
- WebSocket connections for real-time updates without polling

## Security Notes

- This is a single-user application with no authentication
- Never commit `.env` files with real API keys
- Use paper trading API keys only (not live trading keys)
- Keep your Alpaca API credentials secure

## Troubleshooting

### Database Connection Issues

If you can't connect to the database:

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# View PostgreSQL logs
docker-compose logs postgres

# Restart the database
docker-compose restart postgres
```

### Backend API Issues

```bash
# View backend logs
docker-compose logs backend

# Restart backend
docker-compose restart backend

# Rebuild backend image
docker-compose up -d --build backend
```

### Frontend Issues

```bash
# View frontend logs
docker-compose logs frontend

# Restart frontend
docker-compose restart frontend

# Rebuild frontend image
docker-compose up -d --build frontend
```

## Stopping the Application

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes database data)
docker-compose down -v
```

## Contributing

This is a personal project. Feel free to fork and customize for your own use.

## License

This project is for educational and personal use only. Use at your own risk.

## Disclaimer

This software is for educational purposes only. Do not use it for actual trading without proper testing and risk management. Trading involves substantial risk of loss. Past performance does not guarantee future results.

## Resources

- [Alpaca API Documentation](https://alpaca.markets/docs/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [pandas Documentation](https://pandas.pydata.org/docs/)
- [TimescaleDB Documentation](https://docs.timescale.com/)

## Support

For issues and questions, please check:
1. API documentation at http://localhost:8000/docs
2. Application logs: `docker-compose logs -f`
3. Database status: `docker-compose ps`

## Next Steps

After completing Phase 1 setup, proceed with:

1. Implement Alpaca service for market data (Phase 2)
2. Build technical indicator calculations (Phase 2)
3. Create strategy system (Phase 3)
4. Develop backtesting engine (Phase 4)
5. Integrate paper trading (Phase 5)
6. Add ML capabilities (Phase 6)
7. Comprehensive testing (Phase 7)
