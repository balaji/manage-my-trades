import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type DropdownKey = 'overlay' | 'oscillator' | 'other';

type DropdownCounts = Record<DropdownKey, number>;

const DROPDOWN_KEYS: DropdownKey[] = ['overlay', 'oscillator', 'other'];

export function useIndicatorDropdowns() {
  const [openDropdown, setOpenDropdown] = useState<DropdownKey | null>(null);
  const [openCounts, setOpenCounts] = useState<DropdownCounts>({
    overlay: 0,
    oscillator: 0,
    other: 0,
  });

  const overlayRef = useRef<HTMLDivElement>(null);
  const oscillatorRef = useRef<HTMLDivElement>(null);
  const otherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const refMap = {
        overlay: overlayRef,
        oscillator: oscillatorRef,
        other: otherRef,
      };

      if (DROPDOWN_KEYS.every((key) => !refMap[key].current?.contains(target))) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  const toggleDropdown = useCallback((key: DropdownKey) => {
    setOpenDropdown((current) => {
      if (current === key) {
        return null;
      }

      setOpenCounts((counts) => ({
        ...counts,
        [key]: counts[key] + 1,
      }));
      return key;
    });
  }, []);

  const closeAllDropdowns = useCallback(() => {
    setOpenDropdown(null);
  }, []);

  const dropdownState = useMemo(
    () => ({
      overlay: openDropdown === 'overlay',
      oscillator: openDropdown === 'oscillator',
      other: openDropdown === 'other',
    }),
    [openDropdown]
  );

  return {
    overlayRef,
    oscillatorRef,
    otherRef,
    openCounts,
    dropdownState,
    toggleDropdown,
    closeAllDropdowns,
  };
}
