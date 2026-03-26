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
    pane?: 'overlay' | 'oscillator';
    default_enabled?: boolean;
    default_params_presets?: Array<Record<string, unknown>>;
    reference_lines?: Array<{ value: number; color: string }>;
    output_labels?: Record<string, string>;
  };
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
