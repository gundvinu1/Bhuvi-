import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ChatDto } from './dto/chat.dto';
import { SafeUser } from '@bhuvi/shared';

describe('AiController', () => {
  let controller: AiController;
  let service: AiService;

  const mockUser: SafeUser = {
    id: 'user-uuid-1',
    name: 'Vinayak Gund',
    email: 'vinayak@example.com',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockAiService = {
    getStatus: jest.fn(),
    getModels: jest.fn(),
    chat: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [
        {
          provide: AiService,
          useValue: mockAiService,
        },
      ],
    }).compile();

    controller = module.get<AiController>(AiController);
    service = module.get<AiService>(AiService);
    jest.clearAllMocks();
  });

  describe('getStatus', () => {
    it('returns ApiResponse envelope with AI status', async () => {
      mockAiService.getStatus.mockResolvedValue({
        provider: 'ollama',
        status: 'connected',
        model: 'qwen2.5:3b',
        modelAvailable: true,
      });

      const response = await controller.getStatus();

      expect(response.success).toBe(true);
      expect(response.data.provider).toBe('ollama');
      expect(response.data.status).toBe('connected');
      expect(response.data.model).toBe('qwen2.5:3b');
      expect(response.meta?.version).toBeDefined();
    });
  });

  describe('getModels', () => {
    it('returns ApiResponse envelope with model list', async () => {
      mockAiService.getModels.mockResolvedValue([
        {
          name: 'qwen2.5:3b',
          sizeBytes: 1900000000,
          sizeFormatted: '1.9 GB',
          digest: '357c53fb',
          modifiedAt: '2026-11-07',
        },
      ]);

      const response = await controller.getModels();

      expect(response.success).toBe(true);
      expect(response.data.length).toBe(1);
      expect(response.data[0].name).toBe('qwen2.5:3b');
    });
  });

  describe('chat', () => {
    it('calls service.chat and returns ApiResponse envelope', async () => {
      mockAiService.chat.mockResolvedValue({
        response: 'AI is the intelligence of machines.',
        model: 'qwen2.5:3b',
        provider: 'ollama',
        durationMs: 350,
      });

      const dto: ChatDto = { message: 'What is AI?' };
      const response = await controller.chat(dto, mockUser);

      expect(response.success).toBe(true);
      expect(response.data.response).toBe('AI is the intelligence of machines.');
      expect(response.data.durationMs).toBe(350);
      expect(service.chat).toHaveBeenCalledWith(dto, mockUser.id);
    });
  });

  describe('ChatDto Validation', () => {
    const target: ValidationPipe = new ValidationPipe({
      transform: true,
      whitelist: true,
    });
    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype: ChatDto,
      data: '',
    };

    it('accepts valid prompt messages', async () => {
      const validDto = { message: 'Explain gravity.' };
      const result = await target.transform(validDto, metadata);
      expect(result).toEqual(validDto);
    });

    it('rejects empty prompt messages', async () => {
      const invalidDto = { message: '' };
      await expect(target.transform(invalidDto, metadata)).rejects.toThrow(BadRequestException);
    });

    it('rejects oversized prompt messages exceeding 4000 characters', async () => {
      const oversizedDto = { message: 'a'.repeat(4001) };
      await expect(target.transform(oversizedDto, metadata)).rejects.toThrow(BadRequestException);
    });
  });
});
