import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import GlossaryPage from './page';

describe('GlossaryPage', () => {
  it('renders the glossary heading and predefined strategies', () => {
    render(<GlossaryPage />);

    expect(screen.getByRole('heading', { name: 'Glossary' })).toBeInTheDocument();
    expect(screen.getByText('RSI Mean Reversion')).toBeInTheDocument();
    expect(screen.getByText('Moving Average Crossover')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to Strategies/i })).toHaveAttribute('href', '/strategies');
  });
});
