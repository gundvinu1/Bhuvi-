import { registerAs } from '@nestjs/config';

export interface AiConfig {
  ollamaBaseUrl: string;
  ollamaModel: string;
  timeoutMs: number;
  maxInputLength: number;
}

export const aiConfig = registerAs('ai', (): AiConfig => ({
  ollamaBaseUrl: process.env['OLLAMA_BASE_URL'] || 'http://127.0.0.1:11434',
  ollamaModel: process.env['OLLAMA_MODEL'] || 'qwen2.5:3b',
  timeoutMs: parseInt(process.env['OLLAMA_TIMEOUT_MS'] || '60000', 10),
  maxInputLength: parseInt(process.env['OLLAMA_MAX_INPUT_LENGTH'] || '4000', 10),
}));
