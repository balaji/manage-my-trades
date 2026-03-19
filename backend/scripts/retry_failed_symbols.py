"""
Retry fetching market data for symbols from failed_symbols.txt, one at a time.

For each symbol, queries the DB for its (timeframe, latest_date) pairs, fetches
from Alpaca individually, and writes any persistent failures to alpaca_denylist.txt.

Usage:
    cd backend
    uv run python scripts/retry_failed_symbols.py
"""

import asyncio
import logging
from datetime import date, timedelta
from pathlib import Path

from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import insert

from app.db.session import MarketDataSessionLocal
from app.models.market_data import MarketData
from app.services.alpaca_service import get_alpaca_service

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

FAILED_SYMBOLS_FILE = Path("failed_symbols.txt")
DENYLIST_FILE = Path("alpaca_denylist.txt")


def load_failed_symbols() -> list[str]:
    if not FAILED_SYMBOLS_FILE.exists():
        logger.error(f"{FAILED_SYMBOLS_FILE} not found.")
        return []
    symbols = [line.strip() for line in FAILED_SYMBOLS_FILE.read_text().splitlines() if line.strip()]
    logger.info(f"Loaded {len(symbols)} symbols from {FAILED_SYMBOLS_FILE}")
    return symbols


async def get_pairs_for_symbols(symbols: list[str]) -> dict[str, list[tuple[str, date]]]:
    """
    Returns a dict mapping symbol -> list of (timeframe, latest_date).
    """
    async with MarketDataSessionLocal() as session:
        stmt = (
            select(
                MarketData.symbol,
                MarketData.timeframe,
                func.max(MarketData.trade_date).label("latest_date"),
            )
            .where(MarketData.symbol.in_(symbols))
            .group_by(MarketData.symbol, MarketData.timeframe)
            .order_by(MarketData.symbol, MarketData.timeframe)
        )
        result = await session.execute(stmt)
        pairs: dict[str, list[tuple[str, date]]] = {}
        for row in result.all():
            symbol, timeframe, latest_date = row[0], row[1], row[2]
            pairs.setdefault(symbol, []).append((timeframe, latest_date))
    return pairs


async def retry_failed_symbols():
    alpaca = get_alpaca_service()
    denylist: list[str] = []
    total_inserted = 0

    symbols = load_failed_symbols()
    if not symbols:
        return

    pairs_by_symbol = await get_pairs_for_symbols(symbols)
    yesterday = date.today() - timedelta(days=2)

    for symbol in symbols:
        if symbol not in pairs_by_symbol:
            logger.warning(f"[{symbol}] not found in DB, skipping")
            continue

        symbol_failed = False
        for timeframe, latest_date in pairs_by_symbol[symbol]:
            start = latest_date + timedelta(days=1)

            if start > yesterday:
                logger.info(f"[{symbol}, {timeframe}] already up-to-date")
                continue

            logger.info(f"[{symbol}, {timeframe}] fetching from {start} to {yesterday}")
            await asyncio.sleep(0.5)

            try:
                bars_dict = await alpaca.get_bars([symbol], start, yesterday, timeframe)

                if symbol not in bars_dict or not bars_dict[symbol]:
                    logger.info(f"[{symbol}, {timeframe}] no new bars returned")
                    continue

                bars = bars_dict[symbol]
                rows = [
                    {
                        "symbol": symbol,
                        "timeframe": timeframe,
                        "trade_date": bar["timestamp"],
                        "open": bar["open"],
                        "high": bar["high"],
                        "low": bar["low"],
                        "close": bar["close"],
                        "volume": bar["volume"],
                        "vwap": bar.get("vwap"),
                        "trade_count": bar.get("trade_count"),
                    }
                    for bar in bars
                ]

                async with MarketDataSessionLocal() as session:
                    stmt = insert(MarketData).values(rows)
                    stmt = stmt.on_conflict_do_nothing(constraint="uq_market_data_symbol_timeframe_trade_date")
                    result = await session.execute(stmt)
                    await session.commit()

                    inserted = result.rowcount if result.rowcount else 0
                    total_inserted += inserted

                logger.info(f"[{symbol}, {timeframe}] inserted {inserted} rows")

            except Exception as e:
                logger.error(f"[{symbol}, {timeframe}] error: {e}")
                symbol_failed = True

        if symbol_failed:
            denylist.append(symbol)

    if denylist:
        with open(DENYLIST_FILE, "w") as f:
            for symbol in denylist:
                f.write(f"{symbol}\n")
        logger.warning(f"Wrote {len(denylist)} symbols to {DENYLIST_FILE}")

    logger.info(
        f"Retry complete: {len(symbols)} symbols attempted, {total_inserted} rows inserted, {len(denylist)} added to denylist"
    )


async def main():
    await retry_failed_symbols()


if __name__ == "__main__":
    asyncio.run(main())
