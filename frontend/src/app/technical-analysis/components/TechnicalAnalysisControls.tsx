'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RANGES } from '../constants';

interface TechnicalAnalysisControlsProps {
  symbol: string;
  rangeDays: number;
  loading: boolean;
  loadDisabled: boolean;
  onSymbolChange: (value: string) => void;
  onLoad: () => void | Promise<void>;
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
      <div className="min-w-56 flex-1">
        <Input
          type="text"
          value={symbol}
          onChange={(event) => onSymbolChange(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && !loadDisabled && void onLoad()}
          placeholder="Enter symbol (e.g., SPY)"
          className="w-full"
        />
      </div>
      <Button onClick={() => void onLoad()} disabled={loadDisabled}>
        {loading ? 'Loading...' : 'Load Chart'}
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
