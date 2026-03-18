# Position Sizing and Multiple Positions

## Overview

Understanding how position sizing and position management work in the backtesting engine is crucial for designing effective trading strategies.

## Position Sizing: The 10% Default

Your strategy uses a **default position sizing method** that allocates only **10% of your portfolio per trade**.

### How It Works

From `position_sizer.py:53-79`, the default behavior is:

```python
percentage = config.get("percentage", 0.1)  # Default 10%
position_value = portfolio_equity * percentage
shares = position_value / price
```

### Example: IBM Trade

For your first trade:
- Portfolio equity: $10,000
- Default percentage: 10%
- Position value: $10,000 × 0.1 = **$1,000**
- Entry price: $221.25
- Shares: $1,000 ÷ $221.25 = **4.52 shares** ✓

### Why 10% is Conservative

This conservative approach is intentional—it:
1. **Preserves capital** if a trade goes against you
2. **Allows multiple positions** without risking your whole account
3. **Reduces drawdown impact** during losing streaks

## Multiple Positions: One Per Symbol

**Important:** You can only have **ONE open position per symbol at a time**.

### The Position Check

From `engine.py:233-236`:

```python
# Skip if already have a position
if self.portfolio.has_position(symbol):
    logger.info(f"Skipping buy signal for {symbol} - already have position")
    continue
```

**For your IBM backtest:**
- You buy IBM on 4/8 (4.52 shares)
- Any new buy signal before you sell is **skipped/ignored**
- You only sell and close the position on 6/10
- Then you can buy again on 7/24

This is why you see only 3 trades over the year—not because of position sizing, but because the strategy prevents stacking multiple concurrent positions in the same symbol.

## How "Multiple Positions" Actually Works

"Multiple positions" refers to **different symbols**, not the same symbol.

### Example: 3-Symbol Portfolio

If your backtest traded 3 symbols (IBM, AAPL, MSFT) with 10% position sizing:

```
Portfolio: $10,000
├─ IBM:  $1,000 (10%) — open position
├─ AAPL: $1,000 (10%) — open position
├─ MSFT: $1,000 (10%) — open position
└─ Cash: $7,000 (70%)
```

Each symbol would have its own independent position that can only be opened once at a time.

## Configuring Position Sizing

You can customize position sizing in your strategy's `config` field. The supported methods are:

### 1. Fixed Percentage (Default)

```json
{
  "position_sizing": {
    "method": "fixed_percentage",
    "percentage": 0.25  // Use 25% instead of 10%
  }
}
```

### 2. Fixed Amount

Use a fixed dollar amount per trade:

```json
{
  "position_sizing": {
    "method": "fixed_amount",
    "amount": 2000  // Always allocate $2,000 per trade
  }
}
```

### 3. Equal Weight

Divide portfolio equally across N symbols:

```json
{
  "position_sizing": {
    "method": "equal_weight",
    "num_positions": 3  // Allocate 1/3 of capital per position
  }
}
```

## Portfolio State Management

The portfolio tracks positions using a dictionary with one entry per symbol (from `portfolio.py:51`):

```python
positions: Dict[str, Position] = field(default_factory=dict)
```

When you buy:
- If the position doesn't exist, a new one is created
- If the position exists, the buy quantity is added and the average entry price is recalculated

This means multiple buys in the same symbol get averaged together until the position is closed.

## Allowing Multiple Concurrent Positions (Advanced)

To hold multiple positions in the same symbol simultaneously, you would need to:

1. **Remove the position check** in `engine.py:234` (allows stacking)
2. **Add a position limit** (e.g., max 3 concurrent IBM positions)
3. **Track individual legs** instead of averaging them together
4. **Implement separate Trade records** for each concurrent position

This would require significant refactoring of the engine and portfolio management system.
