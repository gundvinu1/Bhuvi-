import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  NotFoundException,
  GatewayTimeoutException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiModelInfo } from '@bhuvi/shared';
import {
  OllamaChatRequest,
  OllamaChatResponse,
  OllamaTagsResponse,
  OllamaVersionResponse,
  OllamaChatMessage,
} from './ai.types';

@Injectable()
export class OllamaProvider {
  private readonly logger = new Logger(OllamaProvider.name);
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('ai.ollamaBaseUrl') || 'http://127.0.0.1:11434';
    this.defaultModel = this.configService.get<string>('ai.ollamaModel') || 'qwen2.5:3b';
    this.timeoutMs = this.configService.get<number>('ai.timeoutMs') || 60000;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  getDefaultModel(): string {
    return this.defaultModel;
  }

  /**
   * Helper to format bytes into readable GB/MB strings
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  }

  /**
   * Probe Ollama server reachability and return its reported version.
   */
  async checkReachability(): Promise<{ reachable: boolean; version?: string; error?: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    try {
      const res = await fetch(`${this.baseUrl}/api/version`, {
        method: 'GET',
        signal: controller.signal,
      });

      if (!res.ok) {
        return { reachable: false, error: `Ollama returned status ${res.status}` };
      }

      const data = (await res.json()) as OllamaVersionResponse;
      return { reachable: true, version: data.version };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      return { reachable: false, error: msg };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Fetch list of locally installed models from Ollama /api/tags.
   */
  async listModels(): Promise<AiModelInfo[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new ServiceUnavailableException(
          `Failed to retrieve models from Ollama (status ${res.status})`,
        );
      }

      const data = (await res.json()) as OllamaTagsResponse;
      if (!data.models || !Array.isArray(data.models)) {
        return [];
      }

      return data.models.map((m) => ({
        name: m.name,
        sizeBytes: m.size,
        sizeFormatted: this.formatBytes(m.size),
        digest: m.digest ? m.digest.slice(0, 12) : 'unknown',
        modifiedAt: m.modified_at,
      }));
    } catch (err: unknown) {
      if (err instanceof ServiceUnavailableException) throw err;
      this.logger.warn(`Could not reach Ollama at ${this.baseUrl}: ${(err as Error).message}`);
      throw new ServiceUnavailableException(
        `Ollama instance is not reachable at ${this.baseUrl}. Ensure Ollama is running.`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Check if a specific model is locally downloaded and ready.
   */
  async isModelAvailable(modelName?: string): Promise<boolean> {
    const target = (modelName || this.defaultModel).toLowerCase();
    try {
      const models = await this.listModels();
      return models.some(
        (m) =>
          m.name.toLowerCase() === target ||
          m.name.toLowerCase().startsWith(`${target}:`) ||
          `${m.name.toLowerCase()}:latest` === target,
      );
    } catch {
      return false;
    }
  }

  /**
   * Execute chat completion against the Ollama HTTP API.
   */
  async chat(
    messages: OllamaChatMessage[],
    modelOverride?: string,
  ): Promise<{ content: string; model: string; durationMs: number }> {
    const model = modelOverride || this.defaultModel;
    const startTime = Date.now();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    const payload: OllamaChatRequest = {
      model,
      messages,
      stream: false,
      options: {
        temperature: 0.7,
      },
    };

    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (res.status === 404) {
        throw new NotFoundException(
          `Model "${model}" is not installed in Ollama. Run: ollama pull ${model}`,
        );
      }

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new ServiceUnavailableException(
          `Ollama inference error (${res.status}): ${errorText || 'Unknown error'}`,
        );
      }

      const data = (await res.json()) as OllamaChatResponse;
      const durationMs = Date.now() - startTime;

      if (!data.message || typeof data.message.content !== 'string') {
        throw new ServiceUnavailableException(
          'Ollama returned an empty or malformed message payload',
        );
      }

      return {
        content: data.message.content.trim(),
        model: data.model || model,
        durationMs,
      };
    } catch (err: unknown) {
      if (err instanceof NotFoundException || err instanceof ServiceUnavailableException) {
        throw err;
      }
      if ((err as Error).name === 'AbortError') {
        throw new GatewayTimeoutException(
          `Ollama model inference timed out after ${this.timeoutMs / 1000} seconds. The local machine may be under heavy load.`,
        );
      }
      this.logger.error(`Ollama request failed: ${(err as Error).message}`, (err as Error).stack);
      throw new ServiceUnavailableException(
        `Failed to communicate with local Ollama service: ${(err as Error).message}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
