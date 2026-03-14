/**
 * API client for backtest-related endpoints.
 */

import { apiClient, handleApiError } from './client';
import { Backtest, BacktestCreate, BacktestListResponse, BacktestTradesResponse } from '../types/backtest';

const BACKTESTS_BASE = '/backtests';

export async function createBacktest(data: BacktestCreate): Promise<Backtest> {
  try {
    const response = await apiClient.post<Backtest>(BACKTESTS_BASE, data);
    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
}

export async function runBacktest(backtestId: number): Promise<Backtest> {
  try {
    const response = await apiClient.post<Backtest>(`${BACKTESTS_BASE}/${backtestId}/run`);
    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
}

export async function getBacktest(backtestId: number): Promise<Backtest> {
  try {
    const response = await apiClient.get<Backtest>(`${BACKTESTS_BASE}/${backtestId}`);
    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
}

export async function listBacktests(params?: {
  strategy_id?: number;
  status?: string;
  skip?: number;
  limit?: number;
}): Promise<BacktestListResponse> {
  try {
    const response = await apiClient.get<BacktestListResponse>(BACKTESTS_BASE, {
      params: {
        strategy_id: params?.strategy_id,
        status: params?.status,
        skip: params?.skip ?? 0,
        limit: params?.limit ?? 100,
      },
    });
    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
}

export async function getBacktestTrades(
  backtestId: number,
  params?: { skip?: number; limit?: number }
): Promise<BacktestTradesResponse> {
  try {
    const response = await apiClient.get<BacktestTradesResponse>(`${BACKTESTS_BASE}/${backtestId}/trades`, {
      params: {
        skip: params?.skip ?? 0,
        limit: params?.limit ?? 100,
      },
    });
    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
}

export async function deleteBacktest(backtestId: number): Promise<void> {
  try {
    await apiClient.delete(`${BACKTESTS_BASE}/${backtestId}`);
  } catch (error) {
    return handleApiError(error);
  }
}
