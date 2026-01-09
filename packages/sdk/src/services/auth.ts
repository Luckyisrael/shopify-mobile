import type { AxiosInstance } from 'axios';
import type {
  LoginRequest,
  SignupRequest,
  RefreshRequest,
  LogoutRequest,
  AuthSession,
  ApiResponse,
} from '../types';

export class AuthService {
  constructor(private httpClient: AxiosInstance) {}

  /**
   * Login customer with email and password
   */
  async login(request: LoginRequest): Promise<AuthSession> {
    const response = await this.httpClient.post<AuthSession>(
      '/api/mobile/auth/login',
      request
    );
    return response.data;
  }

  /**
   * Sign up new customer
   */
  async signup(request: SignupRequest): Promise<ApiResponse<{ customer: any; session?: AuthSession }>> {
    const response = await this.httpClient.post<ApiResponse<{ customer: any; session?: AuthSession }>>(
      '/api/mobile/auth/signup',
      request
    );
    return response.data;
  }

  /**
   * Refresh authentication token
   */
  async refresh(request: RefreshRequest): Promise<{ accessToken: string; expiresAt: string }> {
    const response = await this.httpClient.post<{ accessToken: string; expiresAt: string }>(
      '/api/mobile/auth/refresh',
      request
    );
    return response.data;
  }

  /**
   * Logout customer
   */
  async logout(request: LogoutRequest): Promise<ApiResponse> {
    const response = await this.httpClient.post<ApiResponse>(
      '/api/mobile/auth/logout',
      request
    );
    return response.data;
  }
}