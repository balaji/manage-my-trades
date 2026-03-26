# Project Overview

Next.js 16 (App Router) web application for managing trading strategies, running backtests, and performing technical analysis.

# Development

## Running Locally (Docker)

Start databases: `docker-compose up -d database backend`
Start frontend with hot reload: `docker-compose up --build --watch frontend`
View logs `docker-compose logs -f frontend`

## Running Locally (without Docker)

Install dependencies `npm install`
Start frontend (requires database and backend running) `npm run dev`

## Formatting & Linting

Format files `npm run format {staged_files}`
Lint with auto-fixes `npm run lint {staged_files}`
