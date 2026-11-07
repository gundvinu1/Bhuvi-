import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { MessagesService } from './services/messages.service';
import { MessageIntelligenceService } from './services/message-intelligence.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { SafeUser } from '@bhuvi/shared';

describe('MessagesController', () => {
  let controller: MessagesController;

  const mockUser: SafeUser = {
    id: 'user-uuid-1',
    name: 'Test User',
    email: 'test@bhuvi.local',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockMessagesService = {
    createMessage: jest.fn(),
    getMessages: jest.fn(),
    getMessageById: jest.fn(),
    getMessageAnalysis: jest.fn(),
    analyzeMessage: jest.fn(),
    getPriorityMessages: jest.fn(),
    getActionItems: jest.fn(),
    updateActionItemStatus: jest.fn(),
    getStats: jest.fn(),
    deleteMessage: jest.fn(),
  };

  const mockIntelligenceService = {
    analyzeContent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagesController],
      providers: [
        { provide: MessagesService, useValue: mockMessagesService },
        { provide: MessageIntelligenceService, useValue: mockIntelligenceService },
      ],
    }).compile();

    controller = module.get<MessagesController>(MessagesController);
    jest.clearAllMocks();
  });

  describe('Endpoints', () => {
    it('POST /api/v1/messages creates message with 201', async () => {
      mockMessagesService.createMessage.mockResolvedValue({
        id: 'msg-1',
        userId: mockUser.id,
        senderName: 'John',
        content: 'Meeting tomorrow',
        processingStatus: 'COMPLETED',
        isDuplicate: false,
      });

      const dto: CreateMessageDto = {
        senderName: 'John',
        content: 'Meeting tomorrow',
      };

      const res = await controller.createMessage(mockUser, dto);

      expect(res.success).toBe(true);
      expect(res.data.id).toBe('msg-1');
      expect(mockMessagesService.createMessage).toHaveBeenCalledWith(mockUser.id, dto);
    });

    it('POST /api/v1/messages/analyze-preview returns preview analysis without persistence', async () => {
      mockIntelligenceService.analyzeContent.mockResolvedValue({
        category: 'WORK',
        priority: 'HIGH',
        urgency: 'TIME_SENSITIVE',
        intent: 'REQUEST',
        sentiment: 'NEUTRAL',
        summary: 'Preview summary',
        requiresReply: true,
        requiresAction: true,
        confidence: 0.92,
        actionItems: [],
        entities: [],
      });

      const res = await controller.analyzePreview({ content: 'Submit report ASAP' });

      expect(res.success).toBe(true);
      expect(res.data.category).toBe('WORK');
      expect(res.data.priority).toBe('HIGH');
    });

    it('GET /api/v1/messages lists user messages', async () => {
      mockMessagesService.getMessages.mockResolvedValue({
        messages: [{ id: 'msg-1', content: 'test' }],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const res = await controller.getMessages(mockUser, { page: 1 });

      expect(res.success).toBe(true);
      expect(res.data.messages).toHaveLength(1);
    });

    it('GET /api/v1/messages/priority returns priority messages', async () => {
      mockMessagesService.getPriorityMessages.mockResolvedValue([
        { id: 'msg-urgent', content: 'urgent task' },
      ]);

      const res = await controller.getPriorityMessages(mockUser);

      expect(res.success).toBe(true);
      expect(res.data).toHaveLength(1);
    });

    it('GET /api/v1/messages/stats returns user stats', async () => {
      mockMessagesService.getStats.mockResolvedValue({
        totalMessages: 5,
        highPriorityCount: 2,
        urgentCount: 1,
      });

      const res = await controller.getStats(mockUser);

      expect(res.success).toBe(true);
      expect(res.data.totalMessages).toBe(5);
    });

    it('PATCH /api/v1/messages/actions/:id updates action item status', async () => {
      mockMessagesService.updateActionItemStatus.mockResolvedValue({
        id: 'act-1',
        status: 'COMPLETED',
      });

      const res = await controller.updateActionItem(mockUser, 'act-1', {
        status: 'COMPLETED',
      });

      expect(res.success).toBe(true);
      expect(res.data.status).toBe('COMPLETED');
    });

    it('DELETE /api/v1/messages/:id deletes message', async () => {
      mockMessagesService.deleteMessage.mockResolvedValue({ deleted: true });

      const res = await controller.deleteMessage(mockUser, 'msg-1');

      expect(res.success).toBe(true);
      expect(res.data.deleted).toBe(true);
    });
  });

  describe('ValidationPipe for CreateMessageDto', () => {
    const pipe = new ValidationPipe({ transform: true, whitelist: true });

    it('accepts valid CreateMessageDto', async () => {
      const dto = {
        senderName: 'Alice',
        content: 'Valid content here',
        subject: 'Weekly update',
      };

      const result = await pipe.transform(dto, {
        type: 'body',
        metatype: CreateMessageDto,
      });

      expect(result.senderName).toBe('Alice');
      expect(result.content).toBe('Valid content here');
    });

    it('rejects missing senderName with BadRequestException', async () => {
      const dto = {
        content: 'Missing sender name',
      };

      await expect(
        pipe.transform(dto, { type: 'body', metatype: CreateMessageDto }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects missing content with BadRequestException', async () => {
      const dto = {
        senderName: 'Alice',
      };

      await expect(
        pipe.transform(dto, { type: 'body', metatype: CreateMessageDto }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects content exceeding 20000 characters with BadRequestException', async () => {
      const dto = {
        senderName: 'Alice',
        content: 'a'.repeat(20001),
      };

      await expect(
        pipe.transform(dto, { type: 'body', metatype: CreateMessageDto }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
