import type { AxiosInstance } from 'axios';
import type { RegisterPushRequest, ApiResponse } from '../types';

export class PushService {
  constructor(private httpClient: AxiosInstance) {}

  /**
   * Register device for push notifications
   */
  async register(request: RegisterPushRequest): Promise<ApiResponse> {
    const response = await this.httpClient.post<ApiResponse>(
      '/api/mobile/push/register',
      request
    );
    return response.data;
  }
}