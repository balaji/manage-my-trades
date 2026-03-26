import { describe, expect, it } from 'vitest';

import { buildChartSeries, buildDefaultIndicatorRequests, buildIndicatorPresetOptions } from './chart-model';
import type { IndicatorResult, SupportedIndicator } from '@/lib/api/technical-analysis';

const supportedIndicators: SupportedIndicator[] = [
  {
    name: 'SMA',
    display_name: 'Simple Moving Average',
    description: 'Overlay moving average',
    group: 'Overlap Studies',
    inputs: ['close'],
    parameters: [{ name: 'timeperiod', default: 20 }],
    output_names: ['real'],
    chart: {
      pane: 'overlay',
      default_enabled: true,
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
      pane: 'oscillator',
      default_enabled: false,
      reference_lines: [
        { value: 30, color: '#f59e0b' },
        { value: 70, color: '#ef4444' },
      ],
    },
  },
  {
    name: 'MACD',
    display_name: 'Moving Average Convergence Divergence',
    description: 'Trend oscillator',
    group: 'Momentum Indicators',
    inputs: ['close'],
    parameters: [
      { name: 'fastperiod', default: 12 },
      { name: 'slowperiod', default: 26 },
      { name: 'signalperiod', default: 9 },
    ],
    output_names: ['macd', 'signal'],
    chart: {
      pane: 'oscillator',
      default_enabled: false,
      output_labels: {
        macd: 'MACD',
        signal: 'Signal',
      },
    },
  },
];

describe('chart-model', () => {
  it('builds preset options and default requests from supported indicators', () => {
    const options = buildIndicatorPresetOptions(supportedIndicators);

    expect(options).toHaveLength(3);
    expect(options[0]).toMatchObject({
      name: 'SMA',
      label: 'Simple Moving Average 20',
      pane: 'overlay',
      defaultSelected: true,
    });
    expect(options[1]).toMatchObject({
      name: 'RSI',
      label: 'Relative Strength Index 14',
      pane: 'oscillator',
      defaultSelected: false,
    });

    expect(buildDefaultIndicatorRequests(supportedIndicators)).toEqual([{ name: 'SMA', params: { timeperiod: 20 } }]);
  });

  it('builds overlay and oscillator series with filtering and labels', () => {
    const definitions = buildIndicatorPresetOptions(supportedIndicators).map(({ id, name, params, label, color }) => ({
      id,
      name,
      params,
      label,
      color,
    }));

    const results: IndicatorResult[] = [
      {
        name: 'SMA',
        params: { timeperiod: 20 },
        outputs: {
          real: [
            { timestamp: '2024-01-01', value: 100 },
            { timestamp: '2024-01-02', value: 101 },
          ],
        },
      },
      {
        name: 'MACD',
        params: { fastperiod: 12, signalperiod: 9, slowperiod: 26 },
        outputs: {
          macd: [
            { timestamp: '2024-01-01', value: 1 },
            { timestamp: '2024-01-02', value: 2 },
          ],
          signal: [
            { timestamp: '2024-01-01', value: 0.5 },
            { timestamp: '2024-01-02', value: 1.5 },
          ],
        },
      },
      {
        name: 'RSI',
        params: { timeperiod: 14 },
        outputs: {
          real: [
            { timestamp: '2023-12-31', value: 40 },
            { timestamp: '2024-01-02', value: 55 },
          ],
        },
      },
    ];

    const series = buildChartSeries(results, supportedIndicators, definitions, '2024-01-01');

    expect(series.overlays).toEqual([
      {
        id: `${definitions[0].id}:real`,
        selectionId: definitions[0].id,
        name: 'Simple Moving Average 20',
        data: [
          { timestamp: '2024-01-01', value: 100 },
          { timestamp: '2024-01-02', value: 101 },
        ],
        color: definitions[0].color,
      },
    ]);

    expect(series.oscillators).toEqual([
      {
        id: `${definitions[2].id}:macd`,
        selectionId: definitions[2].id,
        name: 'Moving Average Convergence Divergence (12, 26, 9) (MACD)',
        data: [
          { timestamp: '2024-01-01', value: 1 },
          { timestamp: '2024-01-02', value: 2 },
        ],
        color: definitions[2].color,
        referenceLines: undefined,
      },
      {
        id: `${definitions[2].id}:signal`,
        selectionId: definitions[2].id,
        name: 'Moving Average Convergence Divergence (12, 26, 9) (Signal)',
        data: [
          { timestamp: '2024-01-01', value: 0.5 },
          { timestamp: '2024-01-02', value: 1.5 },
        ],
        color: definitions[2].color,
        referenceLines: undefined,
      },
      {
        id: `${definitions[1].id}:real`,
        selectionId: definitions[1].id,
        name: 'Relative Strength Index 14',
        data: [{ timestamp: '2024-01-02', value: 55 }],
        color: definitions[1].color,
        referenceLines: [
          { value: 30, color: '#f59e0b' },
          { value: 70, color: '#ef4444' },
        ],
      },
    ]);
  });
});
