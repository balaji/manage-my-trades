'use client';

import { Button } from '@/components/ui/button';
import { TechnicalAnalysisSymbolInput } from './TechnicalAnalysisSymbolInput';
import { RANGES } from '../constants';

interface TechnicalAnalysisControlsProps {
  symbol: string;
  rangeDays: number;
  loading: boolean;
  loadDisabled: boolean;
  onSymbolChange: (value: string) => void;
  onLoad: (symbolOverride?: string) => void | Promise<void>;
  onClear: () => void;
  onRangeChange: (days: number) => void | Promise<void>;
}

export function TechnicalAnalysisControls({
  symbol,
  rangeDays,
  loading,
  loadDisabled,
  onSymbolChange,
  onLoad,
  onClear,
  onRangeChange,
}: TechnicalAnalysisControlsProps) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <TechnicalAnalysisSymbolInput
        symbol={symbol}
        loadDisabled={loadDisabled}
        onSymbolChange={onSymbolChange}
        onLoad={onLoad}
      />
      <Button onClick={() => void onLoad()} disabled={loadDisabled}>
        {loading ? 'Loading…' : 'Load Chart'}
      </Button>
      <Button variant="outline" onClick={onClear} disabled={loading}>
        Clear
      </Button>
      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map(({ label, days }) => (
          <Button
            key={days}
            size="sm"
            variant={rangeDays === days ? 'default' : 'ghost'}
            onClick={() => void onRangeChange(days)}
            disabled={loading}
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
