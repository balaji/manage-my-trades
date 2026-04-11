# Manage My Trades Frontend

Next.js 16 frontend for the Manage My Trades platform. The app provides a UI for trading strategy management, backtesting, and technical analysis, with Google-based authentication and a shared API client for the backend service.

## What this app does

- Technical analysis workspace for loading chart data and enabling indicators
- Strategy management for creating, listing, editing, activating, and deactivating strategies
- Backtest management for creating, running, listing, and deleting backtests
- Authenticated app shell with Google sign-in and sign-out

The home route redirects to `/technical-analysis`.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS
- Axios for backend requests
- Recharts, and lightweight-charts where needed
- Vitest and Testing Library for tests

## Project Structure

- `src/app` - App Router pages and layouts
- `src/components` - Shared UI, layout, and chart components
- `src/lib/api` - API client and endpoint wrappers
- `src/lib/types` - Shared TypeScript types
- `src/lib/technical-analysis` - Chart and indicator modeling helpers
- `src/test` - Test setup

## Requirements

- Node.js 20+ recommended
- npm
- A running backend service

## Environment Variables

Create a `.env` file in the frontend root if you need to override defaults:

```env
BACKEND_URL=http://myapp.net:8000
NEXT_PUBLIC_API_URL=http://myapp.net:8000/api/v1
```

- `BACKEND_URL` is used by `next.config.js` to rewrite `/api/v1/*` requests to the backend
- `NEXT_PUBLIC_API_URL` is used by the browser-side API client and auth flow

If you do not set these values, the app falls back to `http://myapp.net:8000` and `http://myapp.net:8000/api/v1`.

## Local Development

### Without Docker

1. Install dependencies:

```bash
npm install
```

2. Start the frontend:

```bash
npm run dev
```

This expects the backend and database to already be running.

### With Docker

Use the repository-level Docker setup described in the parent project if you prefer containerized development:

```bash
docker-compose up -d database backend
docker-compose up --build --watch frontend
```

## Common Scripts

- `npm run dev` - Start the Next.js development server
- `npm run build` - Build the app for production
- `npm run start` - Start the production server
- `npm run test` - Run the test suite once
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage output
- `npm run lint` - Lint and auto-fix supported issues
- `npm run format` - Format files with Prettier

## Authentication

- The app loads the current user from `/auth/me`
- Sign-in opens the backend Google OAuth flow in a popup
- A successful login sends an `AUTH_SUCCESS` message back to the app window
- Sign-out calls `/auth/logout`

## Backend API Surface

The frontend uses a single configured Axios client in `src/lib/api/client.ts`. Notable modules:

- `src/lib/api/auth.ts` - Current user and logout
- `src/lib/api/strategies.ts` - Strategy CRUD and activation
- `src/lib/api/backtests.ts` - Backtest CRUD, run, trades, and signals
- `src/lib/api/technical-analysis.ts` - Indicator discovery and calculation
- `src/lib/api/market-data.ts` - Market data access

## Main Pages

- `/technical-analysis` - Load a symbol, select a date range, and toggle supported indicators
- `/strategies` - Browse strategies with filters and quick stats
- `/strategies/new` - Create a new strategy
- `/strategies/[id]` - View a strategy
- `/strategies/[id]/edit` - Edit a strategy
- `/backtests` - View and delete backtests
- `/backtests/new` - Create a backtest
- `/backtests/[id]` - Inspect backtest details
- `/auth/callback` - OAuth callback handling

## Testing

Tests use Vitest with Testing Library and `jsdom`.

Useful patterns in the current suite:

- Route behavior is tested with mocked `next/navigation`
- Layout behavior is tested through rendered sidebar and auth state
- API and technical-analysis helpers have unit coverage

Run the full suite with:

```bash
npm run test
```

## Notes

- The app uses `src/app/page.tsx` as a redirect to the technical analysis workspace.
- `next.config.js` rewrites `/api/v1/:path*` to the backend URL, which keeps local browser requests simple.
- The codebase is strict TypeScript and expects API responses to match the shared type definitions.
