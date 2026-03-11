"""
Alpaca API service for market data and trading.
"""

from datetime import date
from typing import List, Optional, Dict, Any
import logging

from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest, StockLatestQuoteRequest
from alpaca.data.timeframe import TimeFrame, TimeFrameUnit
from alpaca.trading.client import TradingClient
from alpaca.trading.requests import MarketOrderRequest
from alpaca.trading.enums import OrderSide, TimeInForce

from app.config import get_settings
from app.services.alpaca_service_base import AlpacaServiceBase
from app.services.alpaca_service_http import AlpacaServiceHttp

logger = logging.getLogger(__name__)
settings = get_settings()


class AlpacaService(AlpacaServiceBase):
    """Service for interacting with Alpaca API."""

    def __init__(self):
        """Initialize Alpaca clients."""
        self.data_client = StockHistoricalDataClient(
            api_key=settings.ALPACA_API_KEY, secret_key=settings.ALPACA_SECRET_KEY
        )
        self.trading_client = TradingClient(
            api_key=settings.ALPACA_API_KEY,
            secret_key=settings.ALPACA_SECRET_KEY,
            paper=True,  # Always use paper trading
        )

    def _convert_timeframe(self, timeframe: str) -> TimeFrame:
        """
        Convert timeframe string to Alpaca TimeFrame object.

        Args:
            timeframe: Timeframe string (1m, 5m, 15m, 1h, 1d)

        Returns:
            TimeFrame object
        """
        timeframe_map = {
            "1m": TimeFrame(1, TimeFrameUnit.Minute),
            "5m": TimeFrame(5, TimeFrameUnit.Minute),
            "15m": TimeFrame(15, TimeFrameUnit.Minute),
            "30m": TimeFrame(30, TimeFrameUnit.Minute),
            "1h": TimeFrame(1, TimeFrameUnit.Hour),
            "1d": TimeFrame(1, TimeFrameUnit.Day),
        }

        if timeframe not in timeframe_map:
            raise ValueError(f"Unsupported timeframe: {timeframe}")

        return timeframe_map[timeframe]

    async def get_bars(
        self, symbols: List[str], start: date, end: date, timeframe: str = "1d"
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Fetch OHLCV bar data for symbols.

        Args:
            symbols: List of ticker symbols
            start: Start datetime
            end: End datetime
            timeframe: Timeframe string (default: 1d)

        Returns:
            Dictionary mapping symbols to list of bar data
        """
        try:
            accumulated: Dict[str, list] = {}
            next_page_token = None
            page_count = 0

            while True:
                request = StockBarsRequest(
                    symbol_or_symbols=symbols,
                    timeframe=self._convert_timeframe(timeframe),
                    start=start,
                    end=end,
                    page_token=next_page_token,
                )
                response = self.data_client.get_stock_bars(request)
                page_count += 1

                for symbol, bars in response.data.items():
                    accumulated.setdefault(symbol, []).extend(bars)

                next_page_token = response.next_page_token
                if not next_page_token:
                    break

                logger.info(f"Fetching page {page_count + 1} for {len(symbols)} symbols")

            result = {}
            for symbol in symbols:
                if symbol in accumulated:
                    bars = accumulated[symbol]
                    result[symbol] = [
                        {
                            "timestamp": bar.timestamp.date(),
                            "open": float(bar.open),
                            "high": float(bar.high),
                            "low": float(bar.low),
                            "close": float(bar.close),
                            "volume": float(bar.volume),
                            "vwap": float(bar.vwap) if bar.vwap else None,
                            "trade_count": bar.trade_count,
                        }
                        for bar in bars
                    ]
                else:
                    result[symbol] = []

            total_bars = sum(len(v) for v in result.values())
            logger.info(
                f"Fetched {total_bars} bars for {len(symbols)} symbols from {start} to {end} ({page_count} page(s))"
            )
            return result

        except Exception as e:
            logger.error(f"Error fetching bars: {e}")
            raise

    async def get_latest_quote(self, symbol: str) -> Optional[Dict[str, Any]]:
        """
        Get latest quote for a symbol.

        Args:
            symbol: Ticker symbol

        Returns:
            Latest quote data or None
        """
        try:
            request = StockLatestQuoteRequest(symbol_or_symbols=symbol)
            quotes = self.data_client.get_stock_latest_quote(request)

            if symbol in quotes:
                quote = quotes[symbol]
                return {
                    "symbol": symbol,
                    "ask_price": float(quote.ask_price),
                    "bid_price": float(quote.bid_price),
                    "ask_size": float(quote.ask_size),
                    "bid_size": float(quote.bid_size),
                    "timestamp": quote.timestamp,
                }

            return None

        except Exception as e:
            logger.error(f"Error fetching latest quote for {symbol}: {e}")
            return None

    async def search_symbols(self, query: str) -> List[Dict[str, str]]:
        """
        Search for symbols (simplified - returns common ETFs).

        Args:
            query: Search query

        Returns:
            List of symbol information
        """
        # For now, return a curated list of popular ETFs
        # In production, you could use a separate API or database
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
        """
        Get account information.

        Returns:
            Account data
        """
        try:
            account = self.trading_client.get_account()
            return {
                "account_number": account.account_number,
                "status": account.status,
                "currency": account.currency,
                "cash": float(account.cash),
                "portfolio_value": float(account.portfolio_value),
                "buying_power": float(account.buying_power),
                "equity": float(account.equity),
                "last_equity": float(account.last_equity),
                "initial_margin": float(account.initial_margin) if account.initial_margin else 0,
                "maintenance_margin": float(account.maintenance_margin) if account.maintenance_margin else 0,
                "daytrade_count": account.daytrade_count,
                "pattern_day_trader": account.pattern_day_trader,
            }
        except Exception as e:
            logger.error(f"Error fetching account: {e}")
            raise

    async def get_positions(self) -> List[Dict[str, Any]]:
        """
        Get all open positions.

        Returns:
            List of position data
        """
        try:
            positions = self.trading_client.get_all_positions()
            return [
                {
                    "symbol": pos.symbol,
                    "quantity": float(pos.qty),
                    "side": pos.side,
                    "market_value": float(pos.market_value),
                    "cost_basis": float(pos.cost_basis),
                    "unrealized_pl": float(pos.unrealized_pl),
                    "unrealized_plpc": float(pos.unrealized_plpc),
                    "current_price": float(pos.current_price),
                    "avg_entry_price": float(pos.avg_entry_price),
                }
                for pos in positions
            ]
        except Exception as e:
            logger.error(f"Error fetching positions: {e}")
            raise

    async def place_market_order(
        self, symbol: str, quantity: float, side: str, time_in_force: str = "day"
    ) -> Dict[str, Any]:
        """
        Place a market order.

        Args:
            symbol: Ticker symbol
            quantity: Number of shares
            side: "buy" or "sell"
            time_in_force: Time in force (day, gtc, ioc, fok)

        Returns:
            Order data
        """
        try:
            order_side = OrderSide.BUY if side.lower() == "buy" else OrderSide.SELL
            tif_map = {
                "day": TimeInForce.DAY,
                "gtc": TimeInForce.GTC,
                "ioc": TimeInForce.IOC,
                "fok": TimeInForce.FOK,
            }

            request = MarketOrderRequest(
                symbol=symbol,
                qty=quantity,
                side=order_side,
                time_in_force=tif_map.get(time_in_force.lower(), TimeInForce.DAY),
            )

            order = self.trading_client.submit_order(request)

            return {
                "id": order.id,
                "symbol": order.symbol,
                "quantity": float(order.qty),
                "side": order.side,
                "order_type": order.order_type,
                "time_in_force": order.time_in_force,
                "status": order.status,
                "filled_qty": float(order.filled_qty) if order.filled_qty else 0,
                "filled_avg_price": float(order.filled_avg_price) if order.filled_avg_price else None,
                "submitted_at": order.submitted_at,
            }
        except Exception as e:
            logger.error(f"Error placing market order: {e}")
            raise

    async def get_orders(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get orders.

        Args:
            status: Filter by status (open, closed, all)

        Returns:
            List of order data
        """
        try:
            from alpaca.trading.enums import QueryOrderStatus

            status_map = {
                "open": QueryOrderStatus.OPEN,
                "closed": QueryOrderStatus.CLOSED,
                "all": QueryOrderStatus.ALL,
            }

            order_status = status_map.get(status, QueryOrderStatus.ALL) if status else QueryOrderStatus.ALL
            orders = self.trading_client.get_orders(filter={"status": order_status})

            return [
                {
                    "id": order.id,
                    "symbol": order.symbol,
                    "quantity": float(order.qty),
                    "side": order.side,
                    "order_type": order.order_type,
                    "time_in_force": order.time_in_force,
                    "status": order.status,
                    "filled_qty": float(order.filled_qty) if order.filled_qty else 0,
                    "filled_avg_price": float(order.filled_avg_price) if order.filled_avg_price else None,
                    "submitted_at": order.submitted_at,
                    "filled_at": order.filled_at,
                    "canceled_at": order.canceled_at,
                    "failed_at": order.failed_at,
                }
                for order in orders
            ]
        except Exception as e:
            logger.error(f"Error fetching orders: {e}")
            raise

    async def cancel_order(self, order_id: str) -> bool:
        """
        Cancel an order.

        Args:
            order_id: Order ID

        Returns:
            True if successful
        """
        try:
            self.trading_client.cancel_order_by_id(order_id)
            logger.info(f"Cancelled order {order_id}")
            return True
        except Exception as e:
            logger.error(f"Error cancelling order {order_id}: {e}")
            raise


# Singleton instance
_alpaca_service: Optional[AlpacaServiceBase] = None


def get_alpaca_service() -> AlpacaServiceBase:
    """Get or create Alpaca service instance."""
    global _alpaca_service
    if _alpaca_service is None:
        _alpaca_service = AlpacaServiceHttp()
    return _alpaca_service
