"""
Alpaca API service using direct HTTP calls via httpx (no alpaca-py SDK dependency).
"""

from datetime import datetime, date
from typing import List, Optional, Dict, Any
import logging

import httpx

from app.config import get_settings
from app.services.alpaca_service_base import AlpacaServiceBase

logger = logging.getLogger(__name__)


class AlpacaServiceHttp(AlpacaServiceBase):
    """Service for interacting with Alpaca API via direct HTTP calls."""

    DATA_BASE_URL = "https://data.alpaca.markets"

    def __init__(self, key_id: Optional[str] = None, secret_key: Optional[str] = None):
        settings = get_settings()
        self._auth_headers = {
            "APCA-API-KEY-ID": key_id or settings.ALPACA_API_KEY,
            "APCA-API-SECRET-KEY": secret_key or settings.ALPACA_SECRET_KEY,
        }
        self._client = httpx.AsyncClient(headers=self._auth_headers, timeout=30.0)

    def _convert_timeframe(self, timeframe: str) -> str:
        timeframe_map = {
            "1m": "1Min",
            "5m": "5Min",
            "15m": "15Min",
            "30m": "30Min",
            "1h": "1Hour",
            "1d": "1Day",
        }
        if timeframe not in timeframe_map:
            raise ValueError(f"Unsupported timeframe: {timeframe}")
        return timeframe_map[timeframe]

    async def get_bars(
        self, symbols: List[str], start: date, end: date, timeframe: str = "1d"
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Fetch OHLCV bar data for symbols."""
        try:
            accumulated: Dict[str, list] = {}
            next_page_token = None
            page_count = 0

            while True:
                params: Dict[str, Any] = {
                    "symbols": ",".join(symbols),
                    "timeframe": self._convert_timeframe(timeframe),
                    "start": start.isoformat(),
                    "end": end.isoformat(),
                }
                if next_page_token:
                    params["page_token"] = next_page_token

                response = await self._client.get(f"{self.DATA_BASE_URL}/v2/stocks/bars", params=params)
                response.raise_for_status()
                data = response.json()
                page_count += 1

                for symbol, bars in (data.get("bars") or {}).items():
                    accumulated.setdefault(symbol, []).extend(bars)

                next_page_token = data.get("next_page_token")
                if not next_page_token:
                    break

                logger.info(f"Fetching page {page_count + 1} for {len(symbols)} symbols")

            result: Dict[str, List[Dict[str, Any]]] = {}
            for symbol in symbols:
                raw_bars = accumulated.get(symbol, [])
                result[symbol] = [
                    {
                        "timestamp": datetime.fromisoformat(bar["t"].replace("Z", "+00:00")).date(),
                        "open": float(bar["o"]),
                        "high": float(bar["h"]),
                        "low": float(bar["l"]),
                        "close": float(bar["c"]),
                        "volume": float(bar["v"]),
                        "vwap": float(bar["vw"]) if bar.get("vw") is not None else None,
                        "trade_count": bar.get("n"),
                    }
                    for bar in raw_bars
                ]

            total_bars = sum(len(v) for v in result.values())
            logger.info(
                f"Fetched {total_bars} bars for {len(symbols)} symbols from {start} to {end} ({page_count} page(s))"
            )
            return result

        except Exception as e:
            logger.error(f"Error fetching bars: {e}")
            raise

    async def get_latest_quote(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Get latest quote for a symbol."""
        try:
            response = await self._client.get(
                f"{self.DATA_BASE_URL}/v2/stocks/quotes/latest",
                params={"symbols": symbol},
            )
            if response.status_code == 404:
                return None
            response.raise_for_status()
            data = response.json()

            quotes = data.get("quotes") or {}
            if symbol not in quotes:
                return None

            q = quotes[symbol]
            return {
                "symbol": symbol,
                "ask_price": float(q["ap"]),
                "bid_price": float(q["bp"]),
                "ask_size": float(q["as"]),
                "bid_size": float(q["bs"]),
                "timestamp": datetime.fromisoformat(q["t"].replace("Z", "+00:00")),
            }

        except Exception as e:
            logger.error(f"Error fetching latest quote for {symbol}: {e}")
            return None

    async def search_symbols(self, query: str) -> List[Dict[str, str]]:
        """Search for symbols (returns curated ETF list, no HTTP call)."""
        popular_etfs = [
            {"symbol": "SPY", "name": "SPDR S&P 500 ETF Trust"},
            {"symbol": "QQQ", "name": "Invesco QQQ Trust"},
            {"symbol": "IWM", "name": "iShares Russell 2000 ETF"},
            {"symbol": "DIA", "name": "SPDR Dow Jones Industrial Average ETF"},
            {"symbol": "VTI", "name": "Vanguard Total Stock Market ETF"},
            {"symbol": "VOO", "name": "Vanguard S&P 500 ETF"},
            {"symbol": "VEA", "name": "Vanguard FTSE Developed Markets ETF"},
            {"symbol": "VWO", "name": "Vanguard FTSE Emerging Markets ETF"},
            {"symbol": "AGG", "name": "iShares Core U.S. Aggregate Bond ETF"},
            {"symbol": "BND", "name": "Vanguard Total Bond Market ETF"},
            {"symbol": "GLD", "name": "SPDR Gold Trust"},
            {"symbol": "SLV", "name": "iShares Silver Trust"},
            {"symbol": "XLF", "name": "Financial Select Sector SPDR Fund"},
            {"symbol": "XLK", "name": "Technology Select Sector SPDR Fund"},
            {"symbol": "XLE", "name": "Energy Select Sector SPDR Fund"},
        ]
        query_lower = query.lower()
        return [
            etf for etf in popular_etfs if query_lower in etf["symbol"].lower() or query_lower in etf["name"].lower()
        ]


# Singleton instance
_alpaca_service_http: Optional[AlpacaServiceHttp] = None


def get_alpaca_service_http() -> AlpacaServiceHttp:
    """Get or create AlpacaServiceHttp singleton instance."""
    global _alpaca_service_http
    if _alpaca_service_http is None:
        _alpaca_service_http = AlpacaServiceHttp()
    return _alpaca_service_http
