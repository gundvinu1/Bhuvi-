export interface InfrastructureCheckPayload {
  checkId: string;
  source: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

export interface InfrastructureCheckResult {
  checkId: string;
  status: 'success';
  processedAt: string;
  workerId: string;
  durationMs: number;
}

export interface RedisHealthStatus {
  status: 'connected' | 'disconnected';
  latencyMs?: number;
  error?: string;
}

export interface SanitizedRedisConfig {
  host: string;
  port: number;
  hasPassword: boolean;
}
