/**
 * API Client for connecting to FastAPI backend
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}


class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
  }

  // Accepts token as an optional last argument
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    token?: string
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          error: data.detail || data.message || 'An error occurred',
          status: response.status,
        };
      }

      return {
        data: data as T,
        status: response.status,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Network error',
        status: 0,
      };
    }
  }

  async get<T>(endpoint: string, token?: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' }, token);
  }

  async post<T>(endpoint: string, body?: unknown, token?: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    }, token);
  }

  async put<T>(endpoint: string, body?: unknown, token?: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    }, token);
  }

  async delete<T>(endpoint: string, token?: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' }, token);
  }
}

// Export a singleton instance
export const apiClient = new ApiClient();

// Export specific API endpoints
export const api = {
  // Health check
  health: () => apiClient.get<{ status: string }>('/health'),
  
  // Root endpoint
  root: () => apiClient.get<{ message: string }>('/'),
};
