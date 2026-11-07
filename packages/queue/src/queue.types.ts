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

export interface ExecutePlanPayload {
  planId: string;
  userId: string;
  executionId: string;
}

export interface ExecutePlanResult {
  planId: string;
  executionId: string;
  status: 'COMPLETED' | 'FAILED' | 'WAITING_FOR_APPROVAL' | 'CANCELLED';
  completedSteps: number;
  totalSteps: number;
  error?: string;
}

export interface AnalyzeMessagePayload {
  messageId: string;
  userId: string;
  force?: boolean;
}

export interface AnalyzeMessageResult {
  messageId: string;
  status: 'COMPLETED' | 'FAILED' | 'SKIPPED';
  category?: string;
  priority?: string;
  error?: string;
}
