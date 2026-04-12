"""
Populate the assets table from the bundled assets.json file.

Only assets whose symbol already exists in market_data are inserted. Symbols in
alpaca_denylist.txt are skipped as well.

Usage:
    cd backend
    uv run python -m scripts.populate_assets
"""

import asyncio
import json
import logging
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app.db.session import MarketDataSessionLocal
from app.models.market_data import Asset, MarketData

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

SCRIPT_DIR = Path(__file__).resolve().parent
ASSETS_FILE = SCRIPT_DIR / "assets.json"  # this is from alpaca's assets api, not committed.
DENYLIST_FILE = SCRIPT_DIR.parent / "alpaca_denylist.txt"


def load_assets(path: Path) -> list[dict[str, Any]]:
    return json.loads(path.read_text(encoding="utf-8"))


def load_denylist(path: Path) -> set[str]:
    if not path.exists():
        return set()
    return {line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()}


def build_asset_rows(
    raw_assets: list[dict[str, Any]],
    market_data_symbols: set[str],
    denylist: set[str],
) -> list[dict[str, Any]]:
    rows_by_symbol: dict[str, dict[str, Any]] = {}

    for asset in raw_assets:
        symbol = asset["symbol"]
        if symbol in denylist or symbol not in market_data_symbols:
            continue

        rows_by_symbol[symbol] = {
            "symbol": symbol,
            "name": asset["name"],
            "status": asset["status"] == "active",
            "exchange": asset["exchange"],
        }

    return list(rows_by_symbol.values())


async def get_market_data_symbols() -> set[str]:
    async with MarketDataSessionLocal() as session:
        result = await session.execute(select(MarketData.symbol).distinct())
        return set(result.scalars().all())


async def populate_assets() -> None:
    raw_assets = load_assets(ASSETS_FILE)
    denylist = load_denylist(DENYLIST_FILE)
    market_data_symbols = await get_market_data_symbols()

    rows = build_asset_rows(
        raw_assets=raw_assets,
        market_data_symbols=market_data_symbols,
        denylist=denylist,
    )

    logger.info("Loaded %s assets from %s", len(raw_assets), ASSETS_FILE)
    logger.info("Loaded %s market_data symbols and %s denylisted symbols", len(market_data_symbols), len(denylist))

    if not rows:
        logger.info("No asset rows qualified for insertion.")
        return

    async with MarketDataSessionLocal() as session:
        insert_stmt = insert(Asset).values(rows)
        stmt = insert_stmt.on_conflict_do_update(
            constraint="uq_assets_symbol",
            set_={
                "name": insert_stmt.excluded.name,
                "status": insert_stmt.excluded.status,
                "exchange": insert_stmt.excluded.exchange,
            },
        )
        result = await session.execute(stmt)
        await session.commit()

    logger.info("Upserted %s asset rows into assets", result.rowcount or 0)


async def main() -> None:
    await populate_assets()


if __name__ == "__main__":
    asyncio.run(main())
