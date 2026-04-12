import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TechnicalAnalysisControls } from './TechnicalAnalysisControls';
import { marketDataApi } from '@/lib/api/market-data';

vi.mock('@/lib/api/market-data', () => ({
  marketDataApi: {
    searchSymbols: vi.fn(),
  },
}));

function TestHarness({
  onSymbolChange,
  ...props
}: Omit<ComponentProps<typeof TechnicalAnalysisControls>, 'symbol' | 'onSymbolChange'> & {
  onSymbolChange: ReturnType<typeof vi.fn>;
}) {
  const [symbol, setSymbol] = useState('');

  return (
    <TechnicalAnalysisControls
      symbol={symbol}
      onSymbolChange={(value) => {
        setSymbol(value);
        onSymbolChange(value);
      }}
      {...props}
    />
  );
}

function renderControls(overrides: Partial<ComponentProps<typeof TechnicalAnalysisControls>> = {}) {
  const onSymbolChange = vi.fn();
  const onLoad = vi.fn();
  const onClear = vi.fn();
  const onRangeChange = vi.fn();

  render(
    <TestHarness
      rangeDays={30}
      loading={false}
      loadDisabled={false}
      onSymbolChange={onSymbolChange}
      onLoad={onLoad}
      onClear={onClear}
      onRangeChange={onRangeChange}
      {...overrides}
    />
  );

  return {
    onSymbolChange,
    onLoad,
    onClear,
    onRangeChange,
  };
}

async function advanceAutocompleteDebounce() {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 250));
  });
}

describe('TechnicalAnalysisControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(marketDataApi.searchSymbols).mockResolvedValue({ symbols: [] });
  });

  it('does not search until at least three characters are typed', async () => {
    const user = userEvent.setup();
    const { onSymbolChange } = renderControls();

    const input = screen.getByLabelText(/symbol/i);

    await user.type(input, 'Al');
    await advanceAutocompleteDebounce();

    expect(onSymbolChange).toHaveBeenCalledTimes(2);
    expect(marketDataApi.searchSymbols).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox', { name: /symbol suggestions/i })).not.toBeInTheDocument();
  });

  it('shows suggestions after three characters and normalizes the selection to the symbol', async () => {
    const user = userEvent.setup();
    const { onLoad, onSymbolChange } = renderControls();

    vi.mocked(marketDataApi.searchSymbols).mockResolvedValueOnce({
      symbols: [{ symbol: 'GOOG', name: 'Alphabet Inc. Class C' }],
    });

    const input = screen.getByLabelText(/symbol/i);
    await user.type(input, 'Alp');
    await advanceAutocompleteDebounce();

    expect(marketDataApi.searchSymbols).toHaveBeenCalledWith('Alp');

    const option = await screen.findByRole('option');
    expect(option).toHaveTextContent('GOOG');
    expect(option).toHaveTextContent('Alphabet Inc. Class C');
    await user.click(option);

    expect(onSymbolChange).toHaveBeenLastCalledWith('GOOG');
    expect(onLoad).toHaveBeenCalledWith('GOOG');
    await waitFor(() => expect(screen.queryByRole('listbox', { name: /symbol suggestions/i })).not.toBeInTheDocument());
  });

  it('renders suggestions in a fixed overlay layer so parent overflow does not clip them', async () => {
    const user = userEvent.setup();
    renderControls();

    vi.mocked(marketDataApi.searchSymbols).mockResolvedValueOnce({
      symbols: [{ symbol: 'GOOG', name: 'Alphabet Inc. Class C' }],
    });

    const input = screen.getByLabelText(/symbol/i);
    await user.type(input, 'Alp');
    await advanceAutocompleteDebounce();

    const listbox = await screen.findByRole('listbox', { name: /symbol suggestions/i });
    expect(listbox).toHaveClass('fixed', 'z-50');
  });

  it('pressing enter with a typed symbol still loads chart data', async () => {
    const user = userEvent.setup();
    const { onLoad } = renderControls();

    const input = screen.getByLabelText(/symbol/i);
    await user.type(input, 'AAPL');
    await advanceAutocompleteDebounce();
    await user.keyboard('{Enter}');

    expect(onLoad).toHaveBeenCalledTimes(1);
  });

  it('ignores stale autocomplete responses', async () => {
    const user = userEvent.setup();
    renderControls();
    let resolveFirstRequest: ((value: { symbols: Array<{ symbol: string; name: string }> }) => void) | undefined;

    vi.mocked(marketDataApi.searchSymbols)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstRequest = resolve;
          })
      )
      .mockResolvedValueOnce({
        symbols: [{ symbol: 'GOOG', name: 'Alphabet Inc. Class C' }],
      });

    const input = screen.getByLabelText(/symbol/i);
    await user.type(input, 'Alp');
    await advanceAutocompleteDebounce();

    await user.clear(input);
    await user.type(input, 'Goo');
    await advanceAutocompleteDebounce();

    const option = await screen.findByRole('option');
    expect(option).toHaveTextContent('GOOG');
    expect(option).toHaveTextContent('Alphabet Inc. Class C');

    await act(async () => {
      resolveFirstRequest?.({
        symbols: [{ symbol: 'AAPL', name: 'Apple Inc.' }],
      });
    });

    await waitFor(() => {
      expect(screen.getByRole('option')).toHaveTextContent('GOOG');
    });
    expect(screen.queryByText('Apple Inc.')).not.toBeInTheDocument();
  });
});
