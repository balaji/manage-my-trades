import { describe, expect, it, vi } from 'vitest';

import HomePage from './page';
import { redirect } from 'next/navigation';

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

describe('HomePage', () => {
  it('redirects to technical analysis', () => {
    HomePage();

    expect(redirect).toHaveBeenCalledWith('/technical-analysis');
  });
});
