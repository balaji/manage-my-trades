import { describe, expect, it } from 'vitest';

import { toChartUnixSeconds } from './chart-time';

describe('toChartUnixSeconds', () => {
  it('normalizes date-only strings to UTC midnight', () => {
    expect(toChartUnixSeconds('2024-01-02')).toBe(Date.UTC(2024, 0, 2, 0, 0, 0) / 1000);
  });

  it('normalizes naive datetimes to UTC instead of local time', () => {
    expect(toChartUnixSeconds('2024-01-02T00:00:00')).toBe(Date.UTC(2024, 0, 2, 0, 0, 0) / 1000);
  });

  it('preserves explicit UTC timestamps', () => {
    expect(toChartUnixSeconds('2024-01-02T12:30:00Z')).toBe(Date.UTC(2024, 0, 2, 12, 30, 0) / 1000);
  });
});
