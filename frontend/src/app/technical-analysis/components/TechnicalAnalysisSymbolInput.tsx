'use client';

import { useDeferredValue, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '@/components/ui/input';
import { marketDataApi } from '@/lib/api/market-data';
import type { SymbolInfo } from '@/lib/types/market-data';
import { cn } from '@/lib/utils';

interface TechnicalAnalysisSymbolInputProps {
  symbol: string;
  loadDisabled: boolean;
  onSymbolChange: (value: string) => void;
  onLoad: (symbolOverride?: string) => void | Promise<void>;
}

export function TechnicalAnalysisSymbolInput({
  symbol,
  loadDisabled,
  onSymbolChange,
  onLoad,
}: TechnicalAnalysisSymbolInputProps) {
  const deferredSymbol = useDeferredValue(symbol);
  const listboxId = useId();
  const anchorRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);
  const [hasTyped, setHasTyped] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<SymbolInfo[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const trimmedDeferredSymbol = deferredSymbol.trim();
  const shouldSearch = hasTyped && trimmedDeferredSymbol.length >= 3;
  const visibleSuggestions = shouldSearch ? suggestions : [];
  const activeHighlightedIndex =
    isFocused && highlightedIndex >= 0 && highlightedIndex < visibleSuggestions.length ? highlightedIndex : -1;
  const showSuggestions = isFocused && visibleSuggestions.length > 0;

  useEffect(() => {
    if (!shouldSearch) {
      requestIdRef.current += 1;
      return;
    }

    const requestId = ++requestIdRef.current;
    const timer = window.setTimeout(async () => {
      try {
        const response = await marketDataApi.searchSymbols(trimmedDeferredSymbol);
        if (requestId !== requestIdRef.current) {
          return;
        }

        setSuggestions(response.symbols);
        setHighlightedIndex(-1);
      } catch {
        if (requestId !== requestIdRef.current) {
          return;
        }

        setSuggestions([]);
        setHighlightedIndex(-1);
      }
    }, 200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [shouldSearch, trimmedDeferredSymbol]);

  useEffect(() => {
    if (!showSuggestions) {
      return;
    }

    const updateDropdownPosition = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
      });
    };

    updateDropdownPosition();
    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true);

    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [showSuggestions]);

  const selectSuggestion = (suggestion: SymbolInfo) => {
    requestIdRef.current += 1;
    setHasTyped(false);
    setSuggestions([]);
    setHighlightedIndex(-1);
    onSymbolChange(suggestion.symbol);
    if (!loadDisabled) {
      void onLoad(suggestion.symbol);
    }
  };

  const suggestionsOverlay =
    showSuggestions && dropdownPosition
      ? createPortal(
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Symbol suggestions"
            className="fixed z-50 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
            }}
          >
            {visibleSuggestions.map((suggestion, index) => (
              <li key={`${suggestion.symbol}-${suggestion.name}`}>
                <button
                  id={`${listboxId}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={activeHighlightedIndex === index}
                  className={cn(
                    'flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm',
                    activeHighlightedIndex === index ? 'bg-slate-100' : 'hover:bg-slate-50'
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => selectSuggestion(suggestion)}
                >
                  <span className="font-medium text-slate-900">{suggestion.symbol}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-500">{suggestion.name}</span>
                </button>
              </li>
            ))}
          </ul>,
          document.body
        )
      : null;

  return (
    <div ref={anchorRef} className="relative min-w-56 flex-1">
      <label htmlFor="technical-analysis-symbol" className="sr-only">
        Symbol
      </label>
      <Input
        id="technical-analysis-symbol"
        name="symbol"
        type="text"
        value={symbol}
        onChange={(event) => {
          setHasTyped(true);
          onSymbolChange(event.target.value);
        }}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false);
          setHighlightedIndex(-1);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && visibleSuggestions.length > 0) {
            event.preventDefault();
            setHighlightedIndex((currentIndex) =>
              currentIndex < visibleSuggestions.length - 1 ? currentIndex + 1 : 0
            );
            return;
          }

          if (event.key === 'ArrowUp' && visibleSuggestions.length > 0) {
            event.preventDefault();
            setHighlightedIndex((currentIndex) =>
              currentIndex > 0 ? currentIndex - 1 : visibleSuggestions.length - 1
            );
            return;
          }

          if (event.key === 'Escape') {
            setSuggestions([]);
            setHighlightedIndex(-1);
            return;
          }

          if (event.key === 'Enter') {
            if (activeHighlightedIndex >= 0 && visibleSuggestions[activeHighlightedIndex]) {
              event.preventDefault();
              selectSuggestion(visibleSuggestions[activeHighlightedIndex]);
              return;
            }

            if (!loadDisabled) {
              void onLoad();
            }
          }
        }}
        autoComplete="off"
        spellCheck={false}
        placeholder="Enter symbol…"
        className="w-full"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showSuggestions}
        aria-controls={showSuggestions ? listboxId : undefined}
        aria-activedescendant={
          activeHighlightedIndex >= 0 ? `${listboxId}-option-${activeHighlightedIndex}` : undefined
        }
      />
      {suggestionsOverlay}
    </div>
  );
}
