import { apiClient, handleApiError } from './client';

export interface UserInfo {
  id: number;
  name: string | null;
  picture: string | null;
}

export async function getMe(): Promise<UserInfo> {
  try {
    const response = await apiClient.get<UserInfo>('/auth/me');
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await apiClient.post('/auth/logout');
  } catch (error) {
    throw handleApiError(error);
  }
}
