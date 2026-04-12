from pathlib import Path

from scripts.populate_assets import build_asset_rows, load_denylist


def test_build_asset_rows_skips_symbols_missing_from_market_data_and_denylist():
    raw_assets = [
        {"symbol": "SPY", "name": "SPDR S&P 500 ETF Trust", "status": "active", "exchange": "ARCA"},
        {"symbol": "QQQ", "name": "Invesco QQQ Trust", "status": "inactive", "exchange": "NASDAQ"},
        {"symbol": "IWM", "name": "iShares Russell 2000 ETF", "status": "active", "exchange": "ARCA"},
    ]

    rows = build_asset_rows(
        raw_assets=raw_assets,
        market_data_symbols={"SPY", "QQQ"},
        denylist={"QQQ"},
    )

    assert rows == [
        {
            "symbol": "SPY",
            "name": "SPDR S&P 500 ETF Trust",
            "status": True,
            "exchange": "ARCA",
        }
    ]


def test_load_denylist_ignores_blank_lines(tmp_path: Path):
    denylist_path = tmp_path / "alpaca_denylist.txt"
    denylist_path.write_text("\nSPY\n\nQQQ\n", encoding="utf-8")

    assert load_denylist(denylist_path) == {"SPY", "QQQ"}
