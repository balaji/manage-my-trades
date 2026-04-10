import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { IndicatorToolbar } from './IndicatorToolbar';

const overlayOptions = [{ id: 'SMA:{"timeperiod":20}', color: '#2196F3', label: 'Simple Moving Average 20' }];

const oscillatorOptions = [
  { id: 'RSI:{"timeperiod":14}', color: '#FF5722', label: 'Relative Strength Index 14' },
  {
    id: 'MACD:{"fastperiod":12,"signalperiod":9,"slowperiod":26}',
    color: '#4CAF50',
    label: 'Moving Average Convergence/Divergence (12, 26, 9)',
  },
];

const otherOptions = [{ id: 'FLOOR:{}', color: '#9C27B0', label: 'Vector Floor' }];

describe('IndicatorToolbar', () => {
  it('keeps only one dropdown open at a time and resets filters when switching panes', async () => {
    const user = userEvent.setup();

    render(
      <IndicatorToolbar
        overlayOptions={overlayOptions}
        oscillatorOptions={oscillatorOptions}
        otherOptions={otherOptions}
        activeOverlayLegend={[]}
        enabledIndicatorIds={new Set()}
        loadingIndicatorIds={new Set()}
        loading={false}
        onSelect={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Oscillators' }));
    await user.type(screen.getByLabelText(/filter indicators/i), 'relative');

    expect(screen.getByRole('checkbox', { name: /Relative Strength Index 14/i })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Moving Average Convergence/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Others' }));

    expect(screen.getByRole('checkbox', { name: /Vector Floor/i })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Relative Strength Index 14/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Oscillators' }));

    expect(screen.getByRole('checkbox', { name: /Relative Strength Index 14/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Moving Average Convergence/i })).toBeInTheDocument();
  });

  it('renders legend entries only for enabled overlay indicators', () => {
    render(
      <IndicatorToolbar
        overlayOptions={overlayOptions}
        oscillatorOptions={oscillatorOptions}
        otherOptions={otherOptions}
        activeOverlayLegend={overlayOptions}
        enabledIndicatorIds={new Set(['SMA:{"timeperiod":20}', 'RSI:{"timeperiod":14}'])}
        loadingIndicatorIds={new Set()}
        loading={false}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText('Simple Moving Average 20')).toBeInTheDocument();
    expect(screen.queryByText('Relative Strength Index 14')).not.toBeInTheDocument();
  });
});
