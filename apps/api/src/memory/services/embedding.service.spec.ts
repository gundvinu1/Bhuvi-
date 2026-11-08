import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  let configService: Partial<ConfigService>;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'ai.ollamaBaseUrl') return 'http://127.0.0.1:11434';
        if (key === 'ai.ollamaEmbeddingModel') return 'nomic-embed-text';
        if (key === 'ai.timeoutMs') return 5000;
        return undefined;
      }) as any,
    };
    service = new EmbeddingService(configService as ConfigService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return configured default model name', () => {
    expect(service.getModelName()).toBe('nomic-embed-text');
  });

  it('should throw error when generating embedding for empty text', async () => {
    await expect(service.generateEmbedding('')).rejects.toThrow(
      'Cannot generate embedding for empty text',
    );
    await expect(service.generateEmbedding('   ')).rejects.toThrow(
      'Cannot generate embedding for empty text',
    );
  });

  it('should parse Ollama /api/embeddings response and dynamically extract dimensions', async () => {
    const mockVector = [0.1, -0.2, 0.35, 0.42, -0.18];
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ embedding: mockVector }),
    } as any);

    const result = await service.generateEmbedding('BHUVI personal memory embedding test');
    expect(result.embedding).toEqual(mockVector);
    expect(result.dimensions).toBe(5);
    expect(result.model).toBe('nomic-embed-text');
  });

  it('should fallback to /api/embed when /api/embeddings fails', async () => {
    const mockVector = [0.05, 0.15, -0.25];
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not found',
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embeddings: [mockVector] }),
      } as any);

    const result = await service.generateEmbedding('Testing fallback embed API');
    expect(result.embedding).toEqual(mockVector);
    expect(result.dimensions).toBe(3);
  });

  it('should throw ServiceUnavailableException when both endpoints fail', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Connection refused'));

    await expect(service.generateEmbedding('Some test string')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('should generate batch embeddings sequentially', async () => {
    const mockVector = [0.1, 0.2, 0.3];
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: mockVector }),
    } as any);

    const results = await service.generateBatchEmbeddings(['First text', 'Second text']);
    expect(results).toHaveLength(2);
    expect(results[0]!.dimensions).toBe(3);
    expect(results[1]!.dimensions).toBe(3);
  });

  it('should generate deterministic normalized pseudo-embeddings for offline tests', () => {
    const res1 = service.generateDeterministicEmbedding('Sample test content', 768);
    const res2 = service.generateDeterministicEmbedding('Sample test content', 768);
    const res3 = service.generateDeterministicEmbedding('Completely different content', 768);

    expect(res1.dimensions).toBe(768);
    expect(res1.embedding).toHaveLength(768);
    expect(res1.embedding).toEqual(res2.embedding);
    expect(res1.embedding).not.toEqual(res3.embedding);

    // Verify vector norm is approximately 1.0 (normalized)
    const norm = Math.sqrt(res1.embedding.reduce((sum, v) => sum + v * v, 0));
    expect(norm).toBeCloseTo(1.0, 2);
  });
});
