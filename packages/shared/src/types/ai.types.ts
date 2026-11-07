// ============================================================
// BHUVI – AI Brain & Model Types
// Used across NestJS API, Web Dashboard, and Worker.
// ============================================================

export type AiProviderType = 'ollama';

export type AiConnectionStatus = 'connected' | 'unavailable' | 'degraded';

/** AI Provider and Model Status */
export interface AiStatusResponse {
  provider: AiProviderType;
  status: AiConnectionStatus;
  model: string;
  modelAvailable: boolean;
  version?: string;
  error?: string;
}

/** Local model metadata */
export interface AiModelInfo {
  name: string;
  sizeBytes: number;
  sizeFormatted: string;
  digest: string;
  modifiedAt: string;
}

/** Request payload for AI chat endpoint */
export interface AiChatRequest {
  message: string;
}

/** Structured response from AI chat endpoint */
export interface AiChatResponse {
  response: string;
  model: string;
  provider: AiProviderType;
  durationMs: number;
}
