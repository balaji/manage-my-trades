export interface StrategyInspiration {
  id: string;
  title: string;
  description: string;
}

export const strategyInspirations: StrategyInspiration[] = [
  {
    id: 'rsi-mean-reversion',
    title: 'RSI Mean Reversion',
    description: 'Buys after oversold RSI readings and exits as momentum normalizes back toward the middle range.',
  },
  {
    id: 'moving-average-crossover',
    title: 'Moving Average Crossover',
    description:
      'Enters when a faster moving average crosses above a slower trend line and exits on the reverse cross.',
  },
  {
    id: 'bollinger-band-reversion',
    title: 'Bollinger Band Reversion',
    description:
      'Looks for price stretches beyond the outer band, then targets a move back toward the Bollinger midline.',
  },
  {
    id: 'macd-momentum',
    title: 'MACD Momentum',
    description: 'Follows momentum when MACD turns positive with confirmation from a rising signal line or histogram.',
  },
  {
    id: 'donchian-breakout',
    title: 'Donchian Breakout',
    description: 'Buys when price clears a recent channel high and steps aside once it loses the breakout range.',
  },
  {
    id: 'stochastic-reversal',
    title: 'Stochastic Reversal',
    description:
      'Seeks reversals when stochastic leaves oversold territory and confirms with improving short-term price action.',
  },
];
