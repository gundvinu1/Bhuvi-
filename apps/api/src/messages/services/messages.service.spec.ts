import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@bhuvi/database';
import { MessagesService } from './messages.service';
import { DuplicateDetectorService } from './duplicate-detector.service';
import { MessageIntelligenceService } from './message-intelligence.service';
import { CreateMessageDto } from '../dto/create-message.dto';

describe('MessagesService', () => {
  let service: MessagesService;

  const mockPrisma = {
    message: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    },
    messageAnalysis: {
      findMany: jest.fn(),
    },
    messageActionItem: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockDuplicateDetector = {
    computeContentHash: jest.fn().mockReturnValue('mock-hash-123'),
    checkDuplicate: jest.fn().mockResolvedValue({ isDuplicate: false }),
  };

  const mockIntelligenceService = {
    analyzeAndStoreMessage: jest.fn().mockResolvedValue({
      category: 'WORK',
      priority: 'HIGH',
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: DuplicateDetectorService, useValue: mockDuplicateDetector },
        { provide: MessageIntelligenceService, useValue: mockIntelligenceService },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
    jest.clearAllMocks();
  });

  describe('createMessage', () => {
    it('creates and returns message, performing duplicate check and auto-analysis', async () => {
      const now = new Date();
      const mockCreated = {
        id: 'msg-100',
        userId: 'user-1',
        source: 'MANUAL',
        senderName: 'John',
        senderIdentifier: 'john@example.com',
        subject: 'Weekly Report',
        content: 'Please submit the report.',
        contentHash: 'mock-hash-123',
        processingStatus: 'COMPLETED',
        receivedAt: now,
        createdAt: now,
        updatedAt: now,
        analysis: {
          id: 'analysis-1',
          messageId: 'msg-100',
          category: 'WORK',
          priority: 'HIGH',
          priorityExplanation: 'Work report required',
          urgency: 'TIME_SENSITIVE',
          intent: 'REQUEST',
          sentiment: 'NEUTRAL',
          summary: 'Report required',
          requiresReply: true,
          requiresAction: true,
          confidence: 0.95,
          extractedEntities: [],
          analysisMetadata: null,
          createdAt: now,
          updatedAt: now,
        },
        actionItems: [],
      };

      mockPrisma.message.create.mockResolvedValue(mockCreated);
      mockPrisma.message.findUnique.mockResolvedValue(mockCreated);

      const dto: CreateMessageDto = {
        senderName: 'John',
        senderIdentifier: 'john@example.com',
        subject: 'Weekly Report',
        content: 'Please submit the report.',
        autoAnalyze: true,
      };

      const result = await service.createMessage('user-1', dto);

      expect(mockDuplicateDetector.computeContentHash).toHaveBeenCalledWith(dto.content);
      expect(mockDuplicateDetector.checkDuplicate).toHaveBeenCalledWith(
        'user-1',
        dto.content,
        dto.senderName,
        dto.senderIdentifier,
      );
      expect(mockIntelligenceService.analyzeAndStoreMessage).toHaveBeenCalledWith(
        'msg-100',
        'user-1',
      );
      expect(result.id).toBe('msg-100');
      expect(result.isDuplicate).toBe(false);
      expect(result.analysis?.category).toBe('WORK');
    });
  });

  describe('getMessages', () => {
    it('returns paginated messages for the authenticated user', async () => {
      const now = new Date();
      const mockList = [
        {
          id: 'msg-101',
          userId: 'user-1',
          source: 'MANUAL',
          senderName: 'Alice',
          senderIdentifier: null,
          subject: null,
          content: 'Hello world',
          receivedAt: now,
          createdAt: now,
          updatedAt: now,
          processingStatus: 'COMPLETED',
          analysis: null,
          actionItems: [],
        },
      ];

      mockPrisma.message.count.mockResolvedValue(1);
      mockPrisma.message.findMany.mockResolvedValue(mockList);

      const result = await service.getMessages('user-1', { page: 1, limit: 10 });

      expect(result.total).toBe(1);
      expect(result.messages).toHaveLength(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.messages[0].id).toBe('msg-101');
    });
  });

  describe('getMessageById & Ownership Enforcement', () => {
    it('returns message when user owns it', async () => {
      const now = new Date();
      mockPrisma.message.findUnique.mockResolvedValue({
        id: 'msg-102',
        userId: 'user-1',
        source: 'MANUAL',
        senderName: 'Bob',
        content: 'Test content',
        receivedAt: now,
        createdAt: now,
        updatedAt: now,
        processingStatus: 'COMPLETED',
        analysis: null,
        actionItems: [],
      });

      const result = await service.getMessageById('msg-102', 'user-1');
      expect(result.id).toBe('msg-102');
    });

    it('throws ForbiddenException when another user attempts to access message', async () => {
      const now = new Date();
      mockPrisma.message.findUnique.mockResolvedValue({
        id: 'msg-102',
        userId: 'user-1',
        receivedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      await expect(service.getMessageById('msg-102', 'user-2')).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when message does not exist', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(null);

      await expect(service.getMessageById('msg-nonexistent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateActionItemStatus', () => {
    it('updates action item status and verifies ownership', async () => {
      const now = new Date();
      mockPrisma.messageActionItem.findUnique.mockResolvedValue({
        id: 'action-1',
        userId: 'user-1',
        messageId: 'msg-1',
        title: 'Review invoice',
        status: 'PENDING',
        priority: 'HIGH',
        dueDate: now,
        createdAt: now,
        updatedAt: now,
      });

      mockPrisma.messageActionItem.update.mockResolvedValue({
        id: 'action-1',
        userId: 'user-1',
        messageId: 'msg-1',
        title: 'Review invoice',
        status: 'COMPLETED',
        priority: 'HIGH',
        dueDate: now,
        createdAt: now,
        updatedAt: now,
      });

      const updated = await service.updateActionItemStatus('action-1', 'user-1', 'COMPLETED');
      expect(updated.status).toBe('COMPLETED');
    });

    it('throws ForbiddenException if action item belongs to another user', async () => {
      mockPrisma.messageActionItem.findUnique.mockResolvedValue({
        id: 'action-1',
        userId: 'user-1',
      });

      await expect(
        service.updateActionItemStatus('action-1', 'user-2', 'COMPLETED'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getStats', () => {
    it('returns aggregated counts and category distribution', async () => {
      mockPrisma.message.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(3) // high priority
        .mockResolvedValueOnce(2) // urgent
        .mockResolvedValueOnce(4) // requires action
        .mockResolvedValueOnce(3) // requires reply
        .mockResolvedValueOnce(8) // completed
        .mockResolvedValueOnce(2); // pending

      mockPrisma.messageAnalysis.findMany.mockResolvedValue([
        { category: 'WORK' },
        { category: 'WORK' },
        { category: 'FINANCIAL' },
      ]);

      const stats = await service.getStats('user-1');

      expect(stats.totalMessages).toBe(10);
      expect(stats.highPriorityCount).toBe(3);
      expect(stats.urgentCount).toBe(2);
      expect(stats.categoryDistribution.WORK).toBe(2);
      expect(stats.categoryDistribution.FINANCIAL).toBe(1);
    });
  });

  describe('deleteMessage', () => {
    it('deletes message and verifies ownership', async () => {
      mockPrisma.message.findUnique.mockResolvedValue({
        id: 'msg-del',
        userId: 'user-1',
      });
      mockPrisma.message.delete.mockResolvedValue({});

      const result = await service.deleteMessage('msg-del', 'user-1');
      expect(result.deleted).toBe(true);
      expect(mockPrisma.message.delete).toHaveBeenCalledWith({ where: { id: 'msg-del' } });
    });

    it('throws ForbiddenException if user does not own message', async () => {
      mockPrisma.message.findUnique.mockResolvedValue({
        id: 'msg-del',
        userId: 'user-1',
      });

      await expect(service.deleteMessage('msg-del', 'user-2')).rejects.toThrow(ForbiddenException);
    });
  });
});
