/**
 * API client for technical analysis endpoints.
 */

import { apiClient, handleApiError } from './client';

const TECHNICAL_ANALYSIS_BASE = '/technical-analysis';

export interface IndicatorConfig {
  name: string;
  params?: Record<string, unknown>;
}

export interface CalculateIndicatorsRequest {
  symbol: string;
  timeframe?: string;
  start_date: string;
  end_date: string;
  indicators: IndicatorConfig[];
}

export interface IndicatorValue {
  timestamp: string;
  value: number;
}

export interface IndicatorResult {
  name: string;
  params: Record<string, unknown>;
  outputs: Record<string, IndicatorValue[]>;
}

export interface CalculateIndicatorsResponse {
  symbol: string;
  timeframe: string;
  indicators: IndicatorResult[];
}

export interface SupportedIndicator {
  name: string;
  display_name: string;
  description: string;
  group?: string;
  inputs: string[];
  parameters: Array<Record<string, unknown>>;
  output_names: string[];
  chart?: {
    pane?: 'overlay' | 'oscillator' | 'other';
    default_enabled?: boolean;
    default_params_presets?: Array<Record<string, unknown>>;
    reference_lines?: Array<{ value: number; color: string }>;
    output_labels?: Record<string, string>;
  };
}

export type RegimeType = 'directional' | 'volatility' | 'combined';

export type RegimeLabel =
  | 'bullish'
  | 'bearish'
  | 'sideways'
  | 'low_vol'
  | 'normal_vol'
  | 'high_vol'
  | 'bearish_high_vol'
  | 'bearish_low_vol'
  | 'bullish_low_vol'
  | 'bullish_high_vol';

export interface RegimeSegment {
  start: string;
  end: string;
  regime: RegimeLabel;
}

export interface DetectRegimesRequest {
  symbol: string;
  timeframe?: string;
  n_regimes?: number;
  regime_type?: RegimeType;
}

export interface RegimeResponse {
  symbol: string;
  timeframe: string;
  segments: RegimeSegment[];
}

export const technicalAnalysisApi = {
  /**
   * Calculate one or more technical indicators for a symbol.
   */
  async calculateIndicators(request: CalculateIndicatorsRequest): Promise<CalculateIndicatorsResponse> {
    try {
      const response = await apiClient.post<CalculateIndicatorsResponse>(
        `${TECHNICAL_ANALYSIS_BASE}/calculate`,
        request
      );
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  /**
   * Get a list of all supported technical indicators and their parameters.
   */
  async detectRegimes(request: DetectRegimesRequest): Promise<RegimeResponse> {
    try {
      const response = await apiClient.post<RegimeResponse>(`${TECHNICAL_ANALYSIS_BASE}/regimes`, request);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getSupportedIndicators(): Promise<{
    indicators: SupportedIndicator[];
  }> {
    try {
      const response = await apiClient.get<{
        indicators: SupportedIndicator[];
      }>(`${TECHNICAL_ANALYSIS_BASE}/indicators`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
};
