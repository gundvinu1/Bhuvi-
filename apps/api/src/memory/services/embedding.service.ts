import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EmbeddingResult {
  embedding: number[];
  dimensions: number;
  model: string;
}

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>('ai.ollamaBaseUrl') ||
      process.env['OLLAMA_BASE_URL'] ||
      'http://127.0.0.1:11434';
    this.defaultModel =
      this.configService.get<string>('ai.ollamaEmbeddingModel') ||
      process.env['OLLAMA_EMBEDDING_MODEL'] ||
      'nomic-embed-text';
    this.timeoutMs =
      this.configService.get<number>('ai.timeoutMs') ||
      parseInt(process.env['OLLAMA_TIMEOUT_MS'] || '30000', 10);
  }

  getModelName(): string {
    return this.defaultModel;
  }

  /**
   * Generates a dense vector embedding for the input text using local Ollama.
   * Dynamically measures and returns the actual embedding dimensions.
   */
  async generateEmbedding(text: string, customModel?: string): Promise<EmbeddingResult> {
    const model = customModel || this.defaultModel;
    const cleanText = text?.trim() || '';

    if (!cleanText) {
      throw new Error('Cannot generate embedding for empty text');
    }

    // Try primary endpoint /api/embeddings, then fallback to /api/embed
    try {
      return await this.callOllamaEmbeddings(cleanText, model);
    } catch (err: unknown) {
      this.logger.warn(
        `Ollama /api/embeddings failed (${(err as Error).message}). Retrying via /api/embed…`,
      );
      try {
        return await this.callOllamaEmbed(cleanText, model);
      } catch (fallbackErr: unknown) {
        this.logger.error(
          `Failed to generate embedding with model "${model}": ${(fallbackErr as Error).message}`,
        );
        throw new ServiceUnavailableException(
          `Local embedding model "${model}" is unavailable or unreachable at ${this.baseUrl}. Details: ${(fallbackErr as Error).message}`,
        );
      }
    }
  }

  /**
   * Generates embeddings for a batch of strings sequentially or with controlled concurrency.
   */
  async generateBatchEmbeddings(texts: string[], customModel?: string): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];
    for (const text of texts) {
      const res = await this.generateEmbedding(text, customModel);
      results.push(res);
    }
    return results;
  }

  /**
   * Calls Ollama /api/embeddings endpoint.
   */
  private async callOllamaEmbeddings(prompt: string, model: string): Promise<EmbeddingResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${bodyText}`);
      }

      const data = (await res.json()) as { embedding?: number[] };
      if (!data.embedding || !Array.isArray(data.embedding) || data.embedding.length === 0) {
        throw new Error('Ollama returned empty or malformed embedding vector');
      }

      return {
        embedding: data.embedding,
        dimensions: data.embedding.length,
        model,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Calls Ollama /api/embed endpoint (supported in newer Ollama builds).
   */
  private async callOllamaEmbed(input: string, model: string): Promise<EmbeddingResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, input }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${bodyText}`);
      }

      const data = (await res.json()) as { embeddings?: number[][] };
      if (
        !data.embeddings ||
        !Array.isArray(data.embeddings) ||
        data.embeddings.length === 0 ||
        !Array.isArray(data.embeddings[0])
      ) {
        throw new Error('Ollama /api/embed returned empty or invalid embeddings array');
      }

      const vector = data.embeddings[0];
      return {
        embedding: vector,
        dimensions: vector.length,
        model,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Generates a deterministic pseudo-embedding (useful for test environments without live Ollama).
   */
  generateDeterministicEmbedding(text: string, dimensions = 768): EmbeddingResult {
    const vector = new Array<number>(dimensions).fill(0);
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }

    for (let i = 0; i < dimensions; i++) {
      const pseudoVal = Math.sin(hash + i * 13) * Math.cos(i);
      vector[i] = Number(pseudoVal.toFixed(6));
    }

    // Normalize vector
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    const normalized = norm === 0 ? vector : vector.map((v) => Number((v / norm).toFixed(6)));

    return {
      embedding: normalized,
      dimensions,
      model: `${this.defaultModel}-mock`,
    };
  }
}
