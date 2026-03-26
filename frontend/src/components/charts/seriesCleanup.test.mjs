import test from 'node:test';
import assert from 'node:assert/strict';

import { getRemovedSeriesNames } from './seriesCleanup.js';

test('returns oscillator series that should be removed when they are unchecked', () => {
  const removed = getRemovedSeriesNames(['RSI 14', 'MACD (Signal)'], ['MACD (Signal)']);

  assert.deepEqual(removed, ['RSI 14']);
});

test('returns an empty list when all oscillator series remain active', () => {
  const removed = getRemovedSeriesNames(['RSI 14'], ['RSI 14']);

  assert.deepEqual(removed, []);
});
