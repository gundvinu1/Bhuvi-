import { Test, TestingModule } from '@nestjs/testing';
import { AiService, BHUVI_SYSTEM_PROMPT } from './ai.service';
import { OllamaProvider } from './ollama.provider';

describe('AiService', () => {
  let service: AiService;

  const mockProvider = {
    checkReachability: jest.fn(),
    getDefaultModel: jest.fn().mockReturnValue('qwen2.5:3b'),
    isModelAvailable: jest.fn(),
    listModels: jest.fn(),
    chat: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: OllamaProvider,
          useValue: mockProvider,
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    jest.clearAllMocks();
  });

  describe('getStatus', () => {
    it('returns connected status when Ollama is reachable and configured model is installed', async () => {
      mockProvider.checkReachability.mockResolvedValue({ reachable: true, version: '0.40.3' });
      mockProvider.isModelAvailable.mockResolvedValue(true);

      const status = await service.getStatus();

      expect(status.provider).toBe('ollama');
      expect(status.status).toBe('connected');
      expect(status.model).toBe('qwen2.5:3b');
      expect(status.modelAvailable).toBe(true);
      expect(status.version).toBe('0.40.3');
    });

    it('returns degraded status when Ollama is reachable but configured model is missing', async () => {
      mockProvider.checkReachability.mockResolvedValue({ reachable: true, version: '0.40.3' });
      mockProvider.isModelAvailable.mockResolvedValue(false);

      const status = await service.getStatus();

      expect(status.status).toBe('degraded');
      expect(status.modelAvailable).toBe(false);
      expect(status.error).toContain('not installed');
    });

    it('returns unavailable status when Ollama server is unreachable', async () => {
      mockProvider.checkReachability.mockResolvedValue({
        reachable: false,
        error: 'ECONNREFUSED',
      });

      const status = await service.getStatus();

      expect(status.status).toBe('unavailable');
      expect(status.modelAvailable).toBe(false);
      expect(status.error).toContain('ECONNREFUSED');
    });
  });

  describe('chat', () => {
    it('prepends BHUVI_SYSTEM_PROMPT and dispatches prompt to OllamaProvider', async () => {
      mockProvider.chat.mockResolvedValue({
        content: 'Artificial intelligence refers to machines simulating human cognition.',
        model: 'qwen2.5:3b',
        durationMs: 450,
      });

      const result = await service.chat(
        { message: 'What is artificial intelligence?' },
        'user-123',
      );

      expect(result.response).toBe(
        'Artificial intelligence refers to machines simulating human cognition.',
      );
      expect(result.model).toBe('qwen2.5:3b');
      expect(result.provider).toBe('ollama');
      expect(result.durationMs).toBe(450);

      expect(mockProvider.chat).toHaveBeenCalledWith([
        { role: 'system', content: BHUVI_SYSTEM_PROMPT },
        { role: 'user', content: 'What is artificial intelligence?' },
      ]);
    });
  });
});
