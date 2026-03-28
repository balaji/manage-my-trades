import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useIndicatorDropdowns } from './useIndicatorDropdowns';

describe('useIndicatorDropdowns', () => {
  it('opens one dropdown at a time and increments remount count on reopen', () => {
    const { result } = renderHook(() => useIndicatorDropdowns());

    expect(result.current.dropdownState.overlay).toBe(false);

    act(() => {
      result.current.toggleDropdown('overlay');
    });

    expect(result.current.dropdownState.overlay).toBe(true);
    expect(result.current.openCounts.overlay).toBe(1);

    act(() => {
      result.current.toggleDropdown('oscillator');
    });

    expect(result.current.dropdownState.overlay).toBe(false);
    expect(result.current.dropdownState.oscillator).toBe(true);
    expect(result.current.openCounts.oscillator).toBe(1);

    act(() => {
      result.current.toggleDropdown('oscillator');
      result.current.toggleDropdown('oscillator');
    });

    expect(result.current.dropdownState.oscillator).toBe(true);
    expect(result.current.openCounts.oscillator).toBe(2);
  });
});
