/**
 * Base API client configuration.
 */

import axios, { AxiosError } from "axios";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://bigmac.local:8000/api/v1";

/**
 * Configured axios instance for API calls.
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000, // 30 seconds
});

/**
 * API error response interface.
 */
export interface ApiError {
  detail: string;
  status?: number;
}

/**
 * Extract error message from API error response.
 */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiError>;
    if (axiosError.response?.data?.detail) {
      return axiosError.response.data.detail;
    }
    if (axiosError.message) {
      return axiosError.message;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "An unknown error occurred";
}

/**
 * Handle API errors consistently.
 */
export function handleApiError(error: unknown): never {
  const message = getErrorMessage(error);
  throw new Error(message);
}

export default apiClient;
