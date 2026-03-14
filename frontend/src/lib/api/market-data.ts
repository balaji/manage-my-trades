/**
 * API client for market data endpoints.
 */

import { apiClient, handleApiError } from './client';
import type { MarketDataRequest, MarketDataResponse, SymbolSearchResponse, LatestQuote } from '../types/market-data';

const MARKET_DATA_BASE = '/market-data';

export const marketDataApi = {
  /**
   * Fetch OHLCV bar data for one or more symbols.
   */
  async getBars(request: MarketDataRequest): Promise<MarketDataResponse[]> {
    try {
      const response = await apiClient.post<MarketDataResponse[]>(`${MARKET_DATA_BASE}/bars`, request);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  /**
   * Search for ticker symbols by name or code.
   */
  async searchSymbols(query: string): Promise<SymbolSearchResponse> {
    try {
      const response = await apiClient.get<SymbolSearchResponse>(`${MARKET_DATA_BASE}/search`, {
        params: { query },
      });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  /**
   * Get the latest quote for a symbol.
   */
  async getLatestQuote(symbol: string): Promise<LatestQuote> {
    try {
      const response = await apiClient.get<LatestQuote>(`${MARKET_DATA_BASE}/quote/${symbol}`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
};
