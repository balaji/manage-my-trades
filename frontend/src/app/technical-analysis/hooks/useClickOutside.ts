import { RefObject, useEffect } from 'react';

export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onClickOutside: () => void,
  enabled = true
) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target || ref.current?.contains(target)) {
        return;
      }

      onClickOutside();
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [enabled, onClickOutside, ref]);
}
