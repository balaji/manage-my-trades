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
    TRADING_BASE_URL = "https://paper-api.alpaca.markets"

    def __init__(self):
        settings = get_settings()
        self._auth_headers = {
            "APCA-API-KEY-ID": settings.ALPACA_API_KEY,
            "APCA-API-SECRET-KEY": settings.ALPACA_SECRET_KEY,
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

    async def get_account(self) -> Dict[str, Any]:
        """Get account information."""
        try:
            response = await self._client.get(f"{self.TRADING_BASE_URL}/v2/account")
            response.raise_for_status()
            a = response.json()
            return {
                "account_number": a.get("account_number"),
                "status": a.get("status"),
                "currency": a.get("currency"),
                "cash": float(a["cash"]),
                "portfolio_value": float(a["portfolio_value"]),
                "buying_power": float(a["buying_power"]),
                "equity": float(a["equity"]),
                "last_equity": float(a["last_equity"]),
                "initial_margin": float(a["initial_margin"]) if a.get("initial_margin") else 0,
                "maintenance_margin": float(a["maintenance_margin"]) if a.get("maintenance_margin") else 0,
                "daytrade_count": a.get("daytrade_count"),
                "pattern_day_trader": a.get("pattern_day_trader"),
            }
        except Exception as e:
            logger.error(f"Error fetching account: {e}")
            raise

    async def get_positions(self) -> List[Dict[str, Any]]:
        """Get all open positions."""
        try:
            response = await self._client.get(f"{self.TRADING_BASE_URL}/v2/positions")
            response.raise_for_status()
            positions = response.json()
            return [
                {
                    "symbol": pos["symbol"],
                    "quantity": float(pos["qty"]),
                    "side": pos.get("side"),
                    "market_value": float(pos["market_value"]),
                    "cost_basis": float(pos["cost_basis"]),
                    "unrealized_pl": float(pos["unrealized_pl"]),
                    "unrealized_plpc": float(pos["unrealized_plpc"]),
                    "current_price": float(pos["current_price"]),
                    "avg_entry_price": float(pos["avg_entry_price"]),
                }
                for pos in positions
            ]
        except Exception as e:
            logger.error(f"Error fetching positions: {e}")
            raise

    async def place_market_order(
        self, symbol: str, quantity: float, side: str, time_in_force: str = "day"
    ) -> Dict[str, Any]:
        """Place a market order."""
        try:
            payload = {
                "symbol": symbol,
                "qty": str(quantity),
                "side": side.lower(),
                "type": "market",
                "time_in_force": time_in_force.lower(),
            }
            response = await self._client.post(f"{self.TRADING_BASE_URL}/v2/orders", json=payload)
            response.raise_for_status()
            order = response.json()
            return {
                "id": order.get("id"),
                "symbol": order.get("symbol"),
                "quantity": float(order["qty"]) if order.get("qty") else None,
                "side": order.get("side"),
                "order_type": order.get("type"),
                "time_in_force": order.get("time_in_force"),
                "status": order.get("status"),
                "filled_qty": float(order["filled_qty"]) if order.get("filled_qty") else 0,
                "filled_avg_price": float(order["filled_avg_price"]) if order.get("filled_avg_price") else None,
                "submitted_at": order.get("submitted_at"),
            }
        except Exception as e:
            logger.error(f"Error placing market order: {e}")
            raise

    async def get_orders(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get orders filtered by status."""
        try:
            params = {"status": status or "all"}
            response = await self._client.get(f"{self.TRADING_BASE_URL}/v2/orders", params=params)
            response.raise_for_status()
            orders = response.json()
            return [
                {
                    "id": order.get("id"),
                    "symbol": order.get("symbol"),
                    "quantity": float(order["qty"]) if order.get("qty") else None,
                    "side": order.get("side"),
                    "order_type": order.get("type"),
                    "time_in_force": order.get("time_in_force"),
                    "status": order.get("status"),
                    "filled_qty": float(order["filled_qty"]) if order.get("filled_qty") else 0,
                    "filled_avg_price": float(order["filled_avg_price"]) if order.get("filled_avg_price") else None,
                    "submitted_at": order.get("submitted_at"),
                    "filled_at": order.get("filled_at"),
                    "canceled_at": order.get("canceled_at"),
                    "failed_at": order.get("failed_at"),
                }
                for order in orders
            ]
        except Exception as e:
            logger.error(f"Error fetching orders: {e}")
            raise

    async def cancel_order(self, order_id: str) -> bool:
        """Cancel an order by ID. Returns True on success."""
        try:
            response = await self._client.delete(f"{self.TRADING_BASE_URL}/v2/orders/{order_id}")
            response.raise_for_status()
            logger.info(f"Cancelled order {order_id}")
            return True
        except Exception as e:
            logger.error(f"Error cancelling order {order_id}: {e}")
            raise


# Singleton instance
_alpaca_service_http: Optional[AlpacaServiceHttp] = None


def get_alpaca_service_http() -> AlpacaServiceHttp:
    """Get or create AlpacaServiceHttp singleton instance."""
    global _alpaca_service_http
    if _alpaca_service_http is None:
        _alpaca_service_http = AlpacaServiceHttp()
    return _alpaca_service_http
