import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { buildIndicatorPresetOptions } from '@/lib/technical-analysis/chart-model';

import { useTechnicalAnalysisPriceChart } from './useTechnicalAnalysisPriceChart';

describe('useTechnicalAnalysisPriceChart', () => {
  it('derives PriceChart props from technical analysis state', () => {
    const supportedIndicators = [
      {
        name: 'SMA',
        display_name: 'Simple Moving Average',
        description: 'Overlay',
        group: 'Overlap Studies',
        inputs: ['close'],
        parameters: [{ name: 'timeperiod', default: 20 }],
        output_names: ['real'],
        chart: {
          pane: 'overlay' as const,
        },
      },
      {
        name: 'RSI',
        display_name: 'Relative Strength Index',
        description: 'Momentum oscillator',
        group: 'Momentum Indicators',
        inputs: ['close'],
        parameters: [{ name: 'timeperiod', default: 14 }],
        output_names: ['real'],
        chart: {
          pane: 'oscillator' as const,
          reference_lines: [
            { value: 30, color: '#f59e0b' },
            { value: 70, color: '#ef4444' },
          ],
        },
      },
    ];

    const { result } = renderHook(() =>
      useTechnicalAnalysisPriceChart({
        chartData: [
          {
            timestamp: '2024-01-02T00:00:00Z',
            open: 100,
            high: 101,
            low: 99,
            close: 100.5,
            volume: 1_000_000,
          },
        ],
        symbolDisplayName: 'SPDR S&P 500 ETF Trust',
        indicatorResults: [
          {
            name: 'SMA',
            params: { timeperiod: 20 },
            outputs: {
              real: [{ timestamp: '2024-01-02T00:00:00Z', value: 100.25 }],
            },
          },
          {
            name: 'RSI',
            params: { timeperiod: 14 },
            outputs: {
              real: [
                { timestamp: '2024-01-01T00:00:00Z', value: 42 },
                { timestamp: '2024-01-02T00:00:00Z', value: 48 },
              ],
            },
          },
        ],
        indicatorOptions: buildIndicatorPresetOptions(supportedIndicators),
        supportedIndicators,
        enabledIndicatorIds: new Set(['SMA:{"timeperiod":20}', 'RSI:{"timeperiod":14}']),
        loadedRequest: {
          symbol: 'SPY',
          startDate: '2024-01-02',
          endDate: '2024-01-31',
        },
        regimeSegments: [
          {
            start: 1,
            end: 2,
            regime: 'bullish',
          },
        ],
        regimeType: 'trend',
      })
    );

    expect(result.current.hasChartData).toBe(true);
    expect(result.current.priceChartProps).toEqual({
      data: [
        {
          timestamp: '2024-01-02T00:00:00Z',
          open: 100,
          high: 101,
          low: 99,
          close: 100.5,
          volume: 1_000_000,
        },
      ],
      symbolDisplayName: 'SPDR S&P 500 ETF Trust',
      indicators: [
        {
          id: 'SMA:{"timeperiod":20}:real',
          selectionId: 'SMA:{"timeperiod":20}',
          name: 'Simple Moving Average 20',
          data: [{ timestamp: '2024-01-02T00:00:00Z', value: 100.25 }],
          color: '#2196F3',
        },
      ],
      oscillators: [
        {
          id: 'RSI:{"timeperiod":14}:real',
          selectionId: 'RSI:{"timeperiod":14}',
          name: 'Relative Strength Index 14',
          data: [{ timestamp: '2024-01-02T00:00:00Z', value: 48 }],
          color: '#FF5722',
          referenceLines: [
            { value: 30, color: '#f59e0b' },
            { value: 70, color: '#ef4444' },
          ],
        },
      ],
      regimeSegments: [
        {
          start: 1,
          end: 2,
          regime: 'bullish',
        },
      ],
      showRegimes: true,
      timeRange: {
        from: '2024-01-02T00:00:00Z',
        to: '2024-01-31T23:59:59Z',
      },
    });
  });
});
