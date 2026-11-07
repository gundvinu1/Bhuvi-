// ============================================================
// API Response Types
// Shared across frontend, backend, and worker.
// ============================================================

/** Standard successful API response envelope */
export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  meta?: ResponseMeta;
}

/** Standard error API response envelope */
export interface ApiErrorResponse {
  success: false;
  error: ApiError;
  meta?: ResponseMeta;
}

/** Either a success or error response */
export type ApiResult<T = unknown> = ApiResponse<T> | ApiErrorResponse;

/** Metadata attached to any API response */
export interface ResponseMeta {
  timestamp: string;
  version: string;
  requestId?: string;
}

/** Structured API error */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

/** Health check response shape */
export interface HealthCheckResponse {
  application: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  uptime?: number;
  dependencies?: {
    postgres: 'connected' | 'disconnected' | 'disabled';
    redis: 'connected' | 'disconnected' | 'disabled';
  };
}

/** Pagination parameters */
export interface PaginationParams {
  page: number;
  limit: number;
}

/** Paginated response data */
export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
