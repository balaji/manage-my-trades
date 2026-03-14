# Frontend — Manage My Trades

Next.js 16 (App Router) web application for managing trading strategies, running backtests, and performing technical analysis.

## Tech Stack

| Layer              | Technology                                                           |
| ------------------ | -------------------------------------------------------------------- |
| Framework          | Next.js 16 (App Router), React 19, TypeScript 5.3                    |
| Styling            | Tailwind CSS 3, CSS design tokens (shadcn/ui-compatible theming)     |
| Charting           | `lightweight-charts` v4 (candlestick), `recharts` v2 (equity curves) |
| HTTP               | Axios — singleton client configured via env var                      |
| Icons              | `lucide-react`                                                       |
| Utilities          | `clsx`, `tailwind-merge`, `class-variance-authority`, `date-fns`     |
| Installed (unused) | `@tanstack/react-query` v5, `zustand` v4                             |

## Project Structure

```
src/
├── app/                        # Next.js App Router pages
│   ├── layout.tsx              # Root layout (Inter font, metadata)
│   ├── page.tsx                # Home / navigation hub
│   ├── strategies/
│   │   ├── page.tsx            # Strategy list with filters & actions
│   │   ├── new/page.tsx        # Create strategy form
│   │   └── [id]/page.tsx       # Strategy detail, signals, actions
│   ├── backtests/
│   │   ├── page.tsx            # Backtest list table
│   │   ├── new/page.tsx        # Configure & run backtest
│   │   └── [id]/page.tsx       # Backtest results & trade log
│   └── technical-analysis/
│       └── page.tsx            # Interactive candlestick + indicator chart
├── components/
│   ├── charts/
│   │   ├── PriceChart.tsx      # Candlestick chart with indicator overlays
│   │   └── OscillatorChart.tsx # RSI / BB% sub-panel (synchronized axis)
│   └── strategies/
│       └── StrategyForm.tsx    # Strategy create/edit form
└── lib/
    ├── api/
    │   ├── client.ts           # Axios instance + error normalization
    │   ├── strategies.ts       # Strategy CRUD + signals
    │   ├── market-data.ts      # OHLCV bars, symbol search, quotes
    │   ├── technical-analysis.ts # Indicator calculation
    │   └── backtests.ts        # Backtest CRUD + trades
    └── types/
        ├── strategy.ts         # Strategy/Signal enums & interfaces
        ├── market-data.ts      # OHLCV interfaces
        └── backtest.ts         # Backtest & trade interfaces
```

## Pages

| Route                 | Description                                                                 |
| --------------------- | --------------------------------------------------------------------------- |
| `/`                   | Navigation hub; links to Strategies, Backtests, Technical Analysis          |
| `/strategies`         | List strategies; filter by status/type; activate, deactivate, delete        |
| `/strategies/new`     | Create strategy with indicators and raw JSON config                         |
| `/strategies/[id]`    | Strategy detail: indicators, signals, run backtest, export config           |
| `/backtests`          | Table of all backtests with key metrics and delete action                   |
| `/backtests/new`      | Configure backtest (strategy, symbols, date range, capital, fees)           |
| `/backtests/[id]`     | Results: 8 metric cards, equity curve chart, full trade log                 |
| `/technical-analysis` | Interactive chart: candlestick + SMA/EMA/Bollinger overlays + RSI/BB% panel |

## Development

```bash
npm install
npm run dev       # http://localhost:3000
npm run build
npm run lint
```

### Environment Variables

| Variable              | Default                           | Description          |
| --------------------- | --------------------------------- | -------------------- |
| `NEXT_PUBLIC_API_URL` | `http://bigmac.local:8000/api/v1` | Backend API base URL |

Create a `.env.local` to override:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

### Docker

A `Dockerfile` is included at the root of this directory for containerized deployment. See `docker-compose.yml` at the repo root.

## API Integration

All API calls go through a single Axios instance in `src/lib/api/client.ts` with a 30-second timeout. Each domain has its own module (`strategies.ts`, `market-data.ts`, etc.) that exports typed async functions. Errors are normalized via `handleApiError` before propagating to components.

Data fetching currently uses manual `useEffect` + `useState` patterns. `@tanstack/react-query` and `zustand` are installed and ready to adopt.

## Key Components

**`PriceChart`** — TradingView `lightweight-charts` candlestick chart. Accepts an `indicators` array for overlay series (SMA, EMA, Bollinger Bands). Exposes `onChartReady` for axis synchronization with the oscillator panel.

**`OscillatorChart`** — Sub-chart panel for RSI and BB% rendered below the price chart with a synchronized time axis. Supports configurable reference lines (e.g., overbought/oversold levels).

**`StrategyForm`** — Controlled form for strategy creation supporting dynamic indicator add/remove. Supports 7 indicator types: SMA, EMA, RSI, MACD, Bollinger Bands, Stochastic, ATR.

## Notes

- No global navigation shell; each page handles its own back-links.
- No authentication or protected routes.
- Theming infrastructure (CSS design tokens, dark mode class strategy) is shadcn/ui-ready but no shadcn components are installed yet.
