# Manage My Trades

Manage My Trades is a full-stack platform for ETF strategy research, technical analysis, backtesting, and paper-trading workflows.

## Overview

The repository is split into two primary applications:

- [`backend/`](backend/README.md) - FastAPI service for market data, indicators, strategies, backtests, authentication, and supporting services
- [`frontend/`](frontend/README.md) - Next.js app for strategy management, technical analysis, and backtest exploration

The backend and frontend are designed to work together as a single product, with the frontend consuming the backend API and the backend persisting strategy, market-data, and backtest state.

## What You Can Do

- Research and compare ETF strategies
- Inspect OHLCV data and technical indicators
- Create, edit, activate, and deactivate strategies
- Run historical backtests and review results
- Manage authenticated sessions through Google OAuth
- Cache and reuse market data for analysis workflows

## Repository Layout

- `backend/` - API, services, database models, migrations, and backend tests
- `frontend/` - App Router UI, shared components, API client, and frontend tests
- `README.md` - This project-level index

## Documentation

- Backend setup, environment variables, migrations, tests, and scripts: [`backend/README.md`](backend/README.md)
- Frontend setup, environment variables, scripts, routes, and testing: [`frontend/README.md`](frontend/README.md)
- Backend contributor guidance: [`backend/AGENTS.md`](backend/AGENTS.md)
- Frontend contributor guidance: [`frontend/AGENTS.md`](frontend/AGENTS.md)
- Repo-wide contributor guidance: [`AGENTS.md`](AGENTS.md)

## Status

This project is under active development.

## Notes

- Use the backend and frontend readmes for day-to-day development instructions.
- This root README is intentionally kept short to avoid duplicating service-specific setup details.
