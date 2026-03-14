/**
 * API client for strategy-related endpoints.
 */

import { apiClient, handleApiError } from './client';
import {
  Strategy,
  StrategyCreate,
  StrategyUpdate,
  StrategyListResponse,
  SignalListResponse,
  GetStrategiesParams,
  GetSignalsParams,
} from '../types/strategy';

const STRATEGIES_BASE = '/strategies';

/**
 * Create a new trading strategy.
 */
export async function createStrategy(data: StrategyCreate): Promise<Strategy> {
  try {
    const response = await apiClient.post<Strategy>(STRATEGIES_BASE, data);
    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Get a list of all strategies with optional filtering.
 */
export async function getStrategies(params?: GetStrategiesParams): Promise<StrategyListResponse> {
  try {
    const response = await apiClient.get<StrategyListResponse>(STRATEGIES_BASE, {
      params: {
        skip: params?.skip || 0,
        limit: params?.limit || 100,
        is_active: params?.is_active,
        strategy_type: params?.strategy_type,
      },
    });
    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Get a specific strategy by ID.
 */
export async function getStrategy(strategyId: number): Promise<Strategy> {
  try {
    const response = await apiClient.get<Strategy>(`${STRATEGIES_BASE}/${strategyId}`);
    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Update an existing strategy.
 */
export async function updateStrategy(strategyId: number, data: StrategyUpdate): Promise<Strategy> {
  try {
    const response = await apiClient.put<Strategy>(`${STRATEGIES_BASE}/${strategyId}`, data);
    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Delete a strategy by ID.
 */
export async function deleteStrategy(strategyId: number): Promise<void> {
  try {
    await apiClient.delete(`${STRATEGIES_BASE}/${strategyId}`);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Activate a strategy to start generating signals.
 */
export async function activateStrategy(strategyId: number): Promise<Strategy> {
  try {
    const response = await apiClient.post<Strategy>(`${STRATEGIES_BASE}/${strategyId}/activate`);
    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Deactivate a strategy to stop generating signals.
 */
export async function deactivateStrategy(strategyId: number): Promise<Strategy> {
  try {
    const response = await apiClient.post<Strategy>(`${STRATEGIES_BASE}/${strategyId}/deactivate`);
    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Get trading signals for a specific strategy.
 */
export async function getStrategySignals(strategyId: number, params?: GetSignalsParams): Promise<SignalListResponse> {
  try {
    const response = await apiClient.get<SignalListResponse>(`${STRATEGIES_BASE}/${strategyId}/signals`, {
      params: {
        symbol: params?.symbol,
        start_date: params?.start_date,
        end_date: params?.end_date,
        signal_type: params?.signal_type,
        skip: params?.skip || 0,
        limit: params?.limit || 100,
      },
    });
    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
}
