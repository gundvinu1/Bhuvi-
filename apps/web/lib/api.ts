import { ApiResponse } from '@bhuvi/shared';

/**
 * Returns the configured base API endpoint URL.
 */
export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

/**
 * Robust typed HTTP client for BHUVI.
 * Automatically enforces credentials: 'include' for HttpOnly cookie propagation.
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const baseUrl = getApiBaseUrl();
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers,
  });

  let responseData: unknown = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }
  }

  const res = responseData as {
    success?: boolean;
    data?: T;
    meta?: unknown;
    error?: { code?: string; message?: string; details?: unknown };
  } | null;

  if (!response.ok || (res && res.success === false)) {
    const errorMessage =
      res?.error?.message ||
      (typeof responseData === 'string'
        ? responseData
        : `API request failed with status ${response.status}`);
    const errorCode = res?.error?.code || `HTTP_${response.status}`;
    throw new ApiClientError(errorMessage, response.status, errorCode, res?.error?.details);
  }

  // If response is raw data without ApiResponse envelope, wrap it
  if (res && res.success === true && res.data !== undefined) {
    return res as ApiResponse<T>;
  }

  return {
    success: true,
    data: (responseData as T) ?? ({} as T),
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  };
}
