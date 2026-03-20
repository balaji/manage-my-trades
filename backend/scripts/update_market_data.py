"""
Update market data by fetching latest OHLCV bars from Alpaca and bulk-inserting into market_data DB.

Script identifies all (symbol, timeframe) pairs already in the DB, finds each one's latest date,
fetches from latest_date + 1 to today via Alpaca, bulk-inserts new rows, and writes failures to file.

Usage:
    cd backend
    uv run python scripts/update_market_data.py
"""

import asyncio
import logging
from datetime import date, timedelta
from pathlib import Path
from random import shuffle

from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import insert

from app.db.session import MarketDataSessionLocal
from app.models.market_data import MarketData
from app.services.alpaca_service import get_alpaca_service

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")


async def get_market_data_pairs() -> list[tuple[str, str, date]]:
    """
    Query all (symbol, timeframe) pairs with their latest date.

    Returns:
        List of (symbol, timeframe, latest_date) tuples.
    """
    async with MarketDataSessionLocal() as session:
        stmt = (
            select(
                MarketData.symbol,
                MarketData.timeframe,
                func.max(MarketData.trade_date).label("latest_date"),
            )
            .group_by(MarketData.symbol, MarketData.timeframe)
            .order_by(MarketData.symbol, MarketData.timeframe)
        )
        result = await session.execute(stmt)
        return [(row[0], row[1], row[2]) for row in result.all()]


def load_denylist(path: Path) -> set[str]:
    if not path.exists():
        return set()
    return {line.strip() for line in path.read_text().splitlines() if line.strip()}


async def update_market_data():
    """Fetch and bulk-insert new market data for all (symbol, timeframe) pairs."""
    alpaca = get_alpaca_service()
    failures = []
    total_inserted = 0

    denylist = load_denylist(Path("alpaca_denylist.txt"))

    # Get all pairs with their latest date
    pairs = await get_market_data_pairs()

    if not pairs:
        logger.info("No market data pairs found in database.")
        return

    pairs = [(s, t, d) for s, t, d in pairs if s not in denylist]
    logger.info(f"Found {len(pairs)} (symbol, timeframe) pairs to update ({len(denylist)} denylisted).")

    yesterday = date.today() - timedelta(days=1)

    # Group pairs by timeframe
    timeframe_groups = {}
    for symbol, timeframe, latest_date in pairs:
        if timeframe not in timeframe_groups:
            timeframe_groups[timeframe] = []
        timeframe_groups[timeframe].append((symbol, latest_date))

    # Process each timeframe group
    limit = 10
    for timeframe, symbol_pairs in timeframe_groups.items():
        shuffle(symbol_pairs)
        for batch_idx in range(0, len(symbol_pairs), limit):
            await asyncio.sleep(1)
            batch = symbol_pairs[batch_idx : batch_idx + limit]
            symbols = [symbol for symbol, _ in batch]

            # Use the oldest start_date within the batch
            oldest_latest_date = min(latest_date for _, latest_date in batch)
            start = oldest_latest_date + timedelta(days=1)

            # Skip if already up-to-date
            if start > yesterday:
                logger.info(f"[{timeframe}, batch {batch_idx // limit + 1}] {len(symbols)} symbols already up-to-date")
                continue

            logger.info(
                f"[{timeframe}, batch {batch_idx // limit + 1}] fetching {len(symbols)} symbols from {start} to {yesterday}"
            )

            try:
                # Fetch bars for all symbols in batch
                bars_dict = await alpaca.get_bars(symbols, start, yesterday, timeframe)

                # Process results for each symbol
                for symbol, latest_date in batch:
                    if symbol not in bars_dict or not bars_dict[symbol]:
                        logger.info(f"[{symbol}, {timeframe}] no new bars returned")
                        continue

                    bars = bars_dict[symbol]

                    # Prepare rows for bulk insert
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

                    # Bulk insert with ON CONFLICT DO NOTHING (for idempotency)
                    async with MarketDataSessionLocal() as session:
                        stmt = insert(MarketData).values(rows)
                        # Use PostgreSQL-specific upsert to ignore duplicates on unique constraint
                        stmt = stmt.on_conflict_do_nothing(constraint="uq_market_data_symbol_timeframe_trade_date")
                        result = await session.execute(stmt)
                        await session.commit()

                        inserted = result.rowcount if result.rowcount else 0
                        total_inserted += inserted

                    logger.info(f"[{symbol}, {timeframe}] inserted {inserted} rows")

            except Exception as e:
                logger.error(f"[{timeframe}, batch {batch_idx // limit + 1}] error: {e}")
                for symbol, _ in batch:
                    failures.append(symbol)

    # Write failures file if any
    if failures:
        output_file = Path("failed_symbols.txt")
        with open(output_file, "w") as f:
            for symbol in failures:
                f.write(f"{symbol}\n")
        logger.warning(f"Wrote {len(failures)} failures to {output_file}")

    # Summary
    logger.info(
        f"Update complete: {len(pairs)} pairs processed, {total_inserted} rows inserted, {len(failures)} failures"
    )


async def main():
    """Main entry point."""
    await update_market_data()


if __name__ == "__main__":
    asyncio.run(main())
