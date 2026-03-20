import { apiClient, handleApiError } from './client';

export interface IndicatorParameter {
  name: string;
  label: string;
  description: string;
  type: string;
  default: number;
}

export interface IndicatorDefinition {
  name: string;
  label: string;
  description: string;
  parameters: IndicatorParameter[];
}

export async function getIndicators(): Promise<IndicatorDefinition[]> {
  try {
    const response = await apiClient.get<IndicatorDefinition[]>('/indicators');
    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
}
