import type { AxiosInstance } from 'axios';
import type { TrackEventRequest, ApiResponse } from '../types';

export class EventsService {
  constructor(private httpClient: AxiosInstance) {}

  /**
   * Track customer event for automation
   */
  async track(request: TrackEventRequest): Promise<ApiResponse> {
    const response = await this.httpClient.post<ApiResponse>(
      '/api/mobile/events',
      request
    );
    return response.data;
  }
}