import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StrategyForm } from './StrategyForm';
import { StrategyType } from '@/lib/types/strategy';
import { compileStrategy } from '@/lib/api/strategies';

vi.mock('@/lib/api/strategies', () => ({
  compileStrategy: vi.fn(),
}));

describe('StrategyForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render glossary content inside the form', () => {
    render(<StrategyForm onSubmit={vi.fn().mockResolvedValue(undefined)} />);

    expect(screen.queryByText('Glossary')).not.toBeInTheDocument();
    expect(screen.queryByText('RSI Mean Reversion')).not.toBeInTheDocument();
  });

  it('shows a validation error and blocks submit when the JSON spec is invalid', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    vi.mocked(compileStrategy).mockResolvedValue({
      normalized_spec: {
        kind: 'technical',
        metadata: { name: 'Mean Reversion', description: '', version: 1 },
        market: { timeframe: '1d', symbols: [] },
        indicators: [],
        rules: {
          entry: {
            type: 'compare',
            left: { type: 'price', field: 'close' },
            operator: '>',
            right: { type: 'constant', value: 0 },
          },
          exit: {
            type: 'compare',
            left: { type: 'price', field: 'close' },
            operator: '<',
            right: { type: 'constant', value: 0 },
          },
          filters: [],
        },
        risk: { position_sizing: { method: 'fixed_percentage', percentage: 0.1 }, long_only: true },
        execution: {},
      },
      summary: 'Compiled strategy summary',
      warnings: [],
      prompt_warnings: [],
    });
    render(<StrategyForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/strategy name/i), 'Mean Reversion');
    await user.type(screen.getByLabelText(/strategy request/i), 'Generate a momentum strategy');
    await user.click(screen.getByRole('button', { name: 'Compile' }));
    const specTextarea = await screen.findByDisplayValue(/"kind": "technical"/);
    fireEvent.change(specTextarea, { target: { value: '{invalid json' } });

    await user.click(screen.getByRole('button', { name: 'Create Strategy' }));

    expect(await screen.findByText('Invalid JSON in strategy specification')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits normalized form data with metadata updated from the form fields', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    vi.mocked(compileStrategy).mockResolvedValue({
      normalized_spec: {
        kind: 'technical',
        metadata: { name: 'Compiled Name', description: 'Compiled description', version: 1 },
        market: { timeframe: '1d', symbols: [] },
        indicators: [],
        rules: {
          entry: {
            type: 'compare',
            left: { type: 'price', field: 'close' },
            operator: '>',
            right: { type: 'constant', value: 0 },
          },
          exit: {
            type: 'compare',
            left: { type: 'price', field: 'close' },
            operator: '<',
            right: { type: 'constant', value: 0 },
          },
          filters: [],
        },
        risk: { position_sizing: { method: 'fixed_percentage', percentage: 0.1 }, long_only: true },
        execution: {},
      },
      summary: 'Compiled strategy summary',
      warnings: [],
      prompt_warnings: [],
    });

    render(<StrategyForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/strategy name/i), 'Trend Follower');
    await user.type(screen.getByLabelText(/^description$/i), 'Follows breakouts');
    await user.type(screen.getByLabelText(/strategy request/i), 'Generate a momentum strategy');

    await user.click(screen.getByRole('button', { name: 'Compile' }));
    expect(await screen.findByText('Compiled strategy summary')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Create Strategy' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Trend Follower',
      description: 'Follows breakouts',
      strategy_type: StrategyType.TECHNICAL,
      spec: expect.objectContaining({
        metadata: expect.objectContaining({
          name: 'Trend Follower',
          description: 'Follows breakouts',
        }),
      }),
    });
  });

  it('compiles a natural-language prompt and updates the summary and form fields', async () => {
    const user = userEvent.setup();
    vi.mocked(compileStrategy).mockResolvedValue({
      normalized_spec: {
        kind: 'technical',
        metadata: {
          name: 'Compiled Strategy',
          description: 'Generated by compiler',
          version: 1,
        },
      },
      summary: 'Compiled strategy summary',
      warnings: ['Compiler warning'],
      prompt_warnings: ['Prompt warning'],
    });

    render(<StrategyForm onSubmit={vi.fn().mockResolvedValue(undefined)} />);

    await user.type(screen.getByLabelText(/strategy request/i), 'Generate a momentum strategy');

    await user.click(screen.getByRole('button', { name: 'Compile' }));

    expect(await screen.findByText('Compiled strategy summary')).toBeInTheDocument();
    expect(screen.getByText('Prompt warning')).toBeInTheDocument();
    expect(screen.getByText('Compiler warning')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Compiled Strategy')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Generated by compiler')).toBeInTheDocument();

    expect(compileStrategy).toHaveBeenCalledWith({
      prompt: 'Generate a momentum strategy',
      name: undefined,
      description: undefined,
    });
  });

  it('wires accessible labels and field metadata for the editable inputs', () => {
    render(<StrategyForm onSubmit={vi.fn().mockResolvedValue(undefined)} />);

    expect(screen.getByLabelText(/strategy name/i)).toHaveAttribute('name', 'name');
    expect(screen.getByLabelText(/strategy name/i)).toHaveAttribute('autocomplete', 'off');
    expect(screen.getByLabelText(/^description$/i)).toHaveAttribute('name', 'description');
    expect(screen.getByLabelText(/^description$/i)).toHaveAttribute('autocomplete', 'off');
    expect(screen.getByLabelText(/strategy request/i)).toHaveAttribute('name', 'prompt');
    expect(screen.getByLabelText(/strategy request/i)).toHaveAttribute('autocomplete', 'off');
  });
});
