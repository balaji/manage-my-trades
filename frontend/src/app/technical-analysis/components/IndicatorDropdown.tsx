'use client';

import type { IndicatorPresetOption } from '@/lib/technical-analysis/chart-model';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type IndicatorSelectionOption = Pick<IndicatorPresetOption, 'id' | 'color' | 'label'>;

interface IndicatorDropdownProps {
  buttonLabel: string;
  open: boolean;
  filterText: string;
  onFilterTextChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  options: IndicatorSelectionOption[];
  enabledIndicatorIds: Set<string>;
  loadingIndicatorIds: Set<string>;
  loading: boolean;
  onSelect: (id: string) => void | Promise<void>;
}

export function IndicatorDropdown({
  buttonLabel,
  open,
  filterText,
  onFilterTextChange,
  onOpenChange,
  options,
  enabledIndicatorIds,
  loadingIndicatorIds,
  loading,
  onSelect,
}: IndicatorDropdownProps) {
  if (options.length === 0) {
    return null;
  }

  const normalizedFilter = filterText.trim().toLowerCase();
  const filteredOptions = normalizedFilter
    ? options.filter(({ label }) => label.toLowerCase().includes(normalizedFilter))
    : options;
  const filterInputId = `${buttonLabel.toLowerCase().replace(/\s+/g, '-')}-indicator-filter`;

  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => onOpenChange(!open)} aria-expanded={open}>
        {buttonLabel}
        <svg
          aria-hidden="true"
          className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </Button>
      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 min-w-[260px] rounded-lg border bg-white shadow-lg dark:bg-gray-900 dark:border-gray-700">
          <div className="border-b px-3 py-2 dark:border-gray-700">
            <label htmlFor={filterInputId} className="sr-only">
              Filter indicators
            </label>
            <Input
              id={filterInputId}
              name="indicatorFilter"
              type="text"
              value={filterText}
              onChange={(event) => onFilterTextChange(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="Filter indicators…"
              className="w-full"
            />
          </div>
          <div className="max-h-80 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">No matches</div>
            ) : (
              filteredOptions.map(({ id, color, label }) => (
                <label
                  key={id}
                  className="flex cursor-pointer select-none items-center gap-2.5 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <input
                    type="checkbox"
                    checked={enabledIndicatorIds.has(id)}
                    onChange={() => void onSelect(id)}
                    disabled={loadingIndicatorIds.has(id) || loading}
                    className="h-4 w-4"
                    style={{ accentColor: color }}
                  />
                  <span className="inline-block h-0.5 w-5 rounded" style={{ backgroundColor: color }} />
                  <span className="text-sm">{label}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
