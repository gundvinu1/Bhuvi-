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

export interface ProcessMemoryPayload {
  memoryId: string;
  userId: string;
  force?: boolean;
}

export interface ProcessMemoryResult {
  memoryId: string;
  status: 'COMPLETED' | 'FAILED' | 'SKIPPED';
  chunksCount?: number;
  dimensions?: number;
  error?: string;
}

export interface SyncGmailPayload {
  connectionId: string;
  userId: string;
  mode?: 'INITIAL' | 'INCREMENTAL';
  maxMessages?: number;
}

export interface SyncGmailResult {
  connectionId: string;
  status: 'COMPLETED' | 'FAILED' | 'SKIPPED';
  syncedCount: number;
  newHistoryId?: string;
  error?: string;
}

// Module 10: WhatsApp Integration
export interface ProcessWhatsAppWebhookPayload {
  eventId: string;
  payload: Record<string, unknown>;
  connectionId?: string;
}

export interface ProcessWhatsAppWebhookResult {
  status: 'PROCESSED' | 'FAILED' | 'SKIPPED';
  eventId: string;
  messagesProcessed: number;
  statusesProcessed: number;
  error?: string;
}

export interface ProcessWhatsAppMessagePayload {
  messageId: string;
  connectionId: string;
  userId: string;
  externalMessageId: string;
}

export interface ProcessWhatsAppMessageResult {
  status: 'PROCESSED' | 'FAILED';
  messageId: string;
  analysisId?: string;
  error?: string;
}

export interface SendWhatsAppApprovedMessagePayload {
  draftId: string;
  userId: string;
  connectionId: string;
}

export interface SendWhatsAppApprovedMessageResult {
  status: 'SENT' | 'FAILED';
  draftId: string;
  externalMessageId?: string;
  error?: string;
}

export interface UpdateWhatsAppMessageStatusPayload {
  eventId: string;
  externalMessageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  connectionId?: string;
}

export interface UpdateWhatsAppMessageStatusResult {
  status: 'UPDATED' | 'NOT_FOUND' | 'FAILED';
  externalMessageId: string;
  error?: string;
}
