export const DEFAULT_SYMBOL = 'SPY';
export const DEFAULT_RANGE_DAYS = 90;
export const INDICATOR_LOOKBACK_DAYS = 30;

export const RANGES = [
  { label: '90 days', days: 90 },
  { label: '6 months', days: 180 },
  { label: '1 year', days: 365 },
  { label: '3 years', days: 1095 },
  { label: '10 years', days: 3650 },
] as const;
