'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { IndicatorPresetOption } from '@/lib/technical-analysis/chart-model';
import type { RegimeType } from '@/lib/api/technical-analysis';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { IndicatorDropdown } from './IndicatorDropdown';
import { useClickOutside } from '../hooks/useClickOutside';

type IndicatorSelectionOption = Pick<IndicatorPresetOption, 'id' | 'color' | 'label'>;
type IndicatorPane = 'overlay' | 'oscillator' | 'other';

interface IndicatorToolbarProps {
  overlayOptions: IndicatorSelectionOption[];
  oscillatorOptions: IndicatorSelectionOption[];
  otherOptions: IndicatorSelectionOption[];
  activeOverlayLegend: IndicatorSelectionOption[];
  enabledIndicatorIds: Set<string>;
  loadingIndicatorIds: Set<string>;
  loading: boolean;
  onSelect: (id: string) => void | Promise<void>;
  regimeType?: RegimeType | null;
  onRegimeTypeChange?: (type: RegimeType | null) => void;
  regimeLoading?: boolean;
}

const PANE_CONFIG: Array<{ key: IndicatorPane; buttonLabel: string }> = [
  { key: 'overlay', buttonLabel: 'Technicals' },
  { key: 'oscillator', buttonLabel: 'Oscillators' },
  { key: 'other', buttonLabel: 'Others' },
];

export function IndicatorToolbar({
  overlayOptions,
  oscillatorOptions,
  otherOptions,
  activeOverlayLegend,
  enabledIndicatorIds,
  loadingIndicatorIds,
  loading,
  onSelect,
  regimeType = null,
  onRegimeTypeChange,
  regimeLoading = false,
}: IndicatorToolbarProps) {
  const [activePane, setActivePane] = useState<IndicatorPane | null>(null);
  const [filterByPane, setFilterByPane] = useState<Record<IndicatorPane, string>>({
    overlay: '',
    oscillator: '',
    other: '',
  });
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(
    containerRef,
    useCallback(() => {
      if (!activePane) {
        return;
      }

      setFilterByPane((prev) => ({ ...prev, [activePane]: '' }));
      setActivePane(null);
    }, [activePane]),
    activePane !== null
  );

  const optionsByPane = useMemo(
    () => ({
      overlay: overlayOptions,
      oscillator: oscillatorOptions,
      other: otherOptions,
    }),
    [otherOptions, oscillatorOptions, overlayOptions]
  );

  const handleOpenChange = useCallback((pane: IndicatorPane, open: boolean) => {
    setFilterByPane((prev) => {
      const next = { ...prev };

      if (!open) {
        next[pane] = '';
        return next;
      }

      for (const key of Object.keys(next) as IndicatorPane[]) {
        next[key] = '';
      }

      return next;
    });

    setActivePane(open ? pane : null);
  }, []);

  const handleFilterChange = useCallback((pane: IndicatorPane, value: string) => {
    setFilterByPane((prev) => ({ ...prev, [pane]: value }));
  }, []);

  return (
    <div ref={containerRef} className="mt-4 flex flex-wrap items-center gap-4">
      {PANE_CONFIG.map(({ key, buttonLabel }) => (
        <IndicatorDropdown
          key={key}
          buttonLabel={buttonLabel}
          open={activePane === key}
          filterText={filterByPane[key]}
          onFilterTextChange={(value) => handleFilterChange(key, value)}
          onOpenChange={(open) => handleOpenChange(key, open)}
          options={optionsByPane[key]}
          enabledIndicatorIds={enabledIndicatorIds}
          loadingIndicatorIds={loadingIndicatorIds}
          loading={loading}
          onSelect={onSelect}
        />
      ))}

      {onRegimeTypeChange && (
        <div className="inline-flex items-center gap-1.5">
          {regimeLoading && (
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
          )}
          <select
            value={regimeType ?? ''}
            onChange={(e) => onRegimeTypeChange(e.target.value ? (e.target.value as RegimeType) : null)}
            disabled={loading || regimeLoading}
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'cursor-pointer',
              regimeType && 'border-indigo-500 text-indigo-600 dark:border-indigo-700 dark:text-indigo-400'
            )}
          >
            <option value="">Regimes: None</option>
            <option value="directional">Regimes: Directional</option>
            <option value="volatility">Regimes: Volatility</option>
            <option value="combined">Regimes: Combined</option>
          </select>
        </div>
      )}

      {activeOverlayLegend.map(({ id, color, label }) => (
        <span key={id} className="flex items-center gap-1.5 text-sm text-slate-600">
          <span className="inline-block h-0.5 w-6 rounded" style={{ backgroundColor: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}
