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

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    token?: string
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    const normalizedHeaders: Record<string, string> = {};
    const incoming = options.headers;

    if (incoming instanceof Headers) {
      incoming.forEach((value, key) => {
        normalizedHeaders[key] = value;
      });
    } else if (Array.isArray(incoming)) {
      incoming.forEach(([key, value]) => {
        normalizedHeaders[key] = value as string;
      });
    } else if (incoming && typeof incoming === "object") {
      Object.entries(incoming).forEach(([key, value]) => {
        normalizedHeaders[key] = String(value);
      });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...normalizedHeaders,
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const config: RequestInit = {
      ...options,
      headers,
      credentials: "include",
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
    return this.request<T>(endpoint, { method: "GET" }, token);
  }

  async post<T>(endpoint: string, body?: unknown, token?: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    }, token);
  }

  async put<T>(endpoint: string, body?: unknown, token?: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: JSON.stringify(body),
    }, token);
  }

  async delete<T>(endpoint: string, token?: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "DELETE" }, token);
  }

  async uploadToS3(url: string, file: File): Promise<Response> {
    const response = await fetch(url, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });
    if (!response.ok) {
      throw new Error(`S3 Upload Error: ${response.status}`);
    }
    return response;
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
