import {
  NotFoundException,
  ServiceUnavailableException,
  GatewayTimeoutException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OllamaProvider } from './ollama.provider';

describe('OllamaProvider', () => {
  let provider: OllamaProvider;
  let configService: ConfigService;
  const mockBaseUrl = 'http://127.0.0.1:11434';
  const mockDefaultModel = 'qwen2.5:3b';

  beforeEach(() => {
    configService = new ConfigService({
      ai: {
        ollamaBaseUrl: mockBaseUrl,
        ollamaModel: mockDefaultModel,
        timeoutMs: 2000,
      },
    });
    provider = new OllamaProvider(configService);
    jest.restoreAllMocks();
  });

  describe('checkReachability', () => {
    it('returns reachable: true with version when Ollama responds 200', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ version: '0.40.3' }),
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      const result = await provider.checkReachability();

      expect(result.reachable).toBe(true);
      expect(result.version).toBe('0.40.3');
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/api/version`,
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('returns reachable: false when Ollama connection fails', async () => {
      const mockFetch = jest
        .fn()
        .mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:11434'));
      global.fetch = mockFetch as unknown as typeof fetch;

      const result = await provider.checkReachability();

      expect(result.reachable).toBe(false);
      expect(result.error).toContain('ECONNREFUSED');
    });
  });

  describe('listModels', () => {
    it('returns parsed and formatted model tags from /api/tags', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            {
              name: 'qwen2.5:3b',
              size: 2040109472, // ~1.9 GB
              digest: '357c53fb659c1234567890',
              modified_at: '2026-11-07T07:45:00.000Z',
            },
            {
              name: 'llama3.2:3b',
              size: 2147483648, // 2.0 GB
              digest: 'a80c4f17acd51234567890',
              modified_at: '2026-10-15T00:00:00.000Z',
            },
          ],
        }),
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      const models = await provider.listModels();

      expect(models.length).toBe(2);
      expect(models[0].name).toBe('qwen2.5:3b');
      expect(models[0].sizeFormatted).toBe('1.9 GB');
      expect(models[0].digest).toBe('357c53fb659c');
      expect(models[1].name).toBe('llama3.2:3b');
      expect(models[1].sizeFormatted).toBe('2.0 GB');
    });

    it('throws ServiceUnavailableException when Ollama fails to respond', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(provider.listModels()).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('isModelAvailable', () => {
    it('returns true when model name matches', async () => {
      jest.spyOn(provider, 'listModels').mockResolvedValue([
        {
          name: 'qwen2.5:3b',
          sizeBytes: 1900000000,
          sizeFormatted: '1.9 GB',
          digest: '357c53fb',
          modifiedAt: '2026-11-07',
        },
      ]);

      const isAvailable = await provider.isModelAvailable('qwen2.5:3b');
      expect(isAvailable).toBe(true);
    });

    it('returns false when model is not in installed list', async () => {
      jest.spyOn(provider, 'listModels').mockResolvedValue([]);

      const isAvailable = await provider.isModelAvailable('nonexistent-model');
      expect(isAvailable).toBe(false);
    });
  });

  describe('chat', () => {
    it('executes chat completion and returns formatted content and latency', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          model: 'qwen2.5:3b',
          message: {
            role: 'assistant',
            content: 'Hello! I am BHUVI, your local AI operating system.',
          },
          done: true,
          total_duration: 1500000000,
        }),
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      const result = await provider.chat([{ role: 'user', content: 'Say hello!' }]);

      expect(result.content).toBe('Hello! I am BHUVI, your local AI operating system.');
      expect(result.model).toBe('qwen2.5:3b');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('throws NotFoundException when model is not installed (404 status)', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => 'model not found',
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      await expect(
        provider.chat([{ role: 'user', content: 'Hi' }], 'missing-model'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws GatewayTimeoutException when inference request times out', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      global.fetch = jest.fn().mockRejectedValue(abortError);

      await expect(
        provider.chat([{ role: 'user', content: 'Compute deep thought' }]),
      ).rejects.toThrow(GatewayTimeoutException);
    });
  });
});
