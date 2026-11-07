import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService, Prisma } from '@bhuvi/database';
import {
  MessageDto,
  MessageAnalysisDto,
  MessageActionItemDto,
  MessageStatsDto,
  MessageCategory,
  MessagePriority,
  MessageUrgency,
  MessageIntent,
  MessageSentiment,
  MessageProcessingStatus,
  ActionItemStatus,
  ExtractedEntity,
} from '@bhuvi/shared';
import { CreateMessageDto } from '../dto/create-message.dto';
import { QueryMessagesDto } from '../dto/query-messages.dto';
import { DuplicateDetectorService } from './duplicate-detector.service';
import { MessageIntelligenceService } from './message-intelligence.service';

export interface PaginatedMessagesResponse {
  messages: MessageDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly duplicateDetector: DuplicateDetectorService,
    private readonly intelligenceService: MessageIntelligenceService,
  ) {}

  /**
   * Creates and persists an incoming message, checks for duplicates,
   * and optionally performs immediate message analysis.
   */
  async createMessage(userId: string, dto: CreateMessageDto): Promise<MessageDto> {
    const contentHash = this.duplicateDetector.computeContentHash(dto.content);
    const duplicateCheck = await this.duplicateDetector.checkDuplicate(
      userId,
      dto.content,
      dto.senderName,
      dto.senderIdentifier,
    );

    const receivedAt = dto.receivedAt ? new Date(dto.receivedAt) : new Date();

    const created = await this.prisma.message.create({
      data: {
        userId,
        senderName: dto.senderName.trim(),
        senderIdentifier: dto.senderIdentifier?.trim() || null,
        subject: dto.subject?.trim() || null,
        content: dto.content,
        contentHash,
        source: dto.source || 'MANUAL',
        receivedAt,
        processingStatus: 'RECEIVED',
      },
      include: {
        analysis: true,
        actionItems: true,
      },
    });

    // Auto-analyze if requested
    if (dto.autoAnalyze !== false) {
      try {
        await this.intelligenceService.analyzeAndStoreMessage(created.id, userId);
      } catch (err: unknown) {
        this.logger.warn(
          `Immediate analysis failed for message ${created.id}: ${(err as Error).message}`,
        );
      }
    }

    // Fetch the updated message
    return this.getMessageById(created.id, userId, duplicateCheck.isDuplicate);
  }

  /**
   * Forces re-analysis of an existing message.
   */
  async analyzeMessage(messageId: string, userId: string): Promise<MessageDto> {
    const existing = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!existing) {
      throw new NotFoundException(`Message with ID "${messageId}" not found`);
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException('You do not have permission to analyze this message');
    }

    await this.intelligenceService.analyzeAndStoreMessage(messageId, userId);
    return this.getMessageById(messageId, userId);
  }

  /**
   * Retrieves paginated messages for the authenticated user matching filter criteria.
   */
  async getMessages(userId: string, query: QueryMessagesDto): Promise<PaginatedMessagesResponse> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.MessageWhereInput = {
      userId,
    };

    if (query.status) {
      where.processingStatus = query.status;
    }

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { senderName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (query.startDate || query.endDate) {
      where.receivedAt = {};
      if (query.startDate) where.receivedAt.gte = new Date(query.startDate);
      if (query.endDate) where.receivedAt.lte = new Date(query.endDate);
    }

    // Analysis-specific filters
    if (
      query.category ||
      query.priority ||
      query.urgency ||
      query.requiresAction !== undefined ||
      query.requiresReply !== undefined
    ) {
      where.analysis = {
        is: {
          ...(query.category ? { category: query.category } : {}),
          ...(query.priority ? { priority: query.priority } : {}),
          ...(query.urgency ? { urgency: query.urgency } : {}),
          ...(query.requiresAction !== undefined ? { requiresAction: query.requiresAction } : {}),
          ...(query.requiresReply !== undefined ? { requiresReply: query.requiresReply } : {}),
        },
      };
    }

    const [total, messages] = await Promise.all([
      this.prisma.message.count({ where }),
      this.prisma.message.findMany({
        where,
        include: {
          analysis: true,
          actionItems: true,
        },
        orderBy: { receivedAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      messages: messages.map((m) => this.mapToMessageDto(m)),
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Retrieves a single message and verifies user ownership.
   */
  async getMessageById(
    messageId: string,
    userId: string,
    isDuplicate = false,
  ): Promise<MessageDto> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        analysis: true,
        actionItems: true,
      },
    });

    if (!message) {
      throw new NotFoundException(`Message with ID "${messageId}" not found`);
    }

    if (message.userId !== userId) {
      throw new ForbiddenException('You do not have permission to access this message');
    }

    return this.mapToMessageDto(message, isDuplicate);
  }

  /**
   * Retrieves analysis details for a specific message.
   */
  async getMessageAnalysis(messageId: string, userId: string): Promise<MessageAnalysisDto> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { analysis: true },
    });

    if (!message) {
      throw new NotFoundException(`Message with ID "${messageId}" not found`);
    }

    if (message.userId !== userId) {
      throw new ForbiddenException('You do not have permission to view analysis for this message');
    }

    if (!message.analysis) {
      throw new NotFoundException(`Analysis for message "${messageId}" has not been completed yet`);
    }

    return this.mapToAnalysisDto(message.analysis);
  }

  /**
   * Retrieves high-priority and urgent messages for the authenticated user.
   */
  async getPriorityMessages(userId: string): Promise<MessageDto[]> {
    const messages = await this.prisma.message.findMany({
      where: {
        userId,
        analysis: {
          is: {
            OR: [
              { priority: { in: ['CRITICAL', 'HIGH'] } },
              { urgency: { in: ['URGENT', 'TIME_SENSITIVE'] } },
            ],
          },
        },
      },
      include: {
        analysis: true,
        actionItems: true,
      },
      orderBy: { receivedAt: 'desc' },
      take: 20,
    });

    return messages.map((m) => this.mapToMessageDto(m));
  }

  /**
   * Lists action items for the user, with optional status and priority filtering.
   */
  async getActionItems(
    userId: string,
    status?: ActionItemStatus,
    priority?: MessagePriority,
  ): Promise<MessageActionItemDto[]> {
    const where: Prisma.MessageActionItemWhereInput = { userId };
    if (status) where.status = status;
    if (priority) where.priority = priority;

    const items = await this.prisma.messageActionItem.findMany({
      where,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });

    return items.map((item) => ({
      id: item.id,
      messageId: item.messageId,
      userId: item.userId,
      title: item.title,
      description: item.description,
      priority: item.priority as MessagePriority,
      dueDate: item.dueDate ? item.dueDate.toISOString() : null,
      status: item.status as ActionItemStatus,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }));
  }

  /**
   * Updates an action item's status, ensuring ownership.
   */
  async updateActionItemStatus(
    actionItemId: string,
    userId: string,
    newStatus: ActionItemStatus,
  ): Promise<MessageActionItemDto> {
    const item = await this.prisma.messageActionItem.findUnique({
      where: { id: actionItemId },
    });

    if (!item) {
      throw new NotFoundException(`Action item with ID "${actionItemId}" not found`);
    }

    if (item.userId !== userId) {
      throw new ForbiddenException('You do not have permission to update this action item');
    }

    const updated = await this.prisma.messageActionItem.update({
      where: { id: actionItemId },
      data: { status: newStatus },
    });

    return {
      id: updated.id,
      messageId: updated.messageId,
      userId: updated.userId,
      title: updated.title,
      description: updated.description,
      priority: updated.priority as MessagePriority,
      dueDate: updated.dueDate ? updated.dueDate.toISOString() : null,
      status: updated.status as ActionItemStatus,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Returns aggregate message intelligence statistics.
   */
  async getStats(userId: string): Promise<MessageStatsDto> {
    const [
      totalMessages,
      highPriorityCount,
      urgentCount,
      requiresActionCount,
      requiresReplyCount,
      completedCount,
      pendingProcessingCount,
      analyses,
    ] = await Promise.all([
      this.prisma.message.count({ where: { userId } }),
      this.prisma.message.count({
        where: {
          userId,
          analysis: { is: { priority: { in: ['CRITICAL', 'HIGH'] } } },
        },
      }),
      this.prisma.message.count({
        where: {
          userId,
          analysis: { is: { urgency: { in: ['URGENT', 'TIME_SENSITIVE'] } } },
        },
      }),
      this.prisma.message.count({
        where: {
          userId,
          analysis: { is: { requiresAction: true } },
        },
      }),
      this.prisma.message.count({
        where: {
          userId,
          analysis: { is: { requiresReply: true } },
        },
      }),
      this.prisma.message.count({
        where: {
          userId,
          processingStatus: 'COMPLETED',
        },
      }),
      this.prisma.message.count({
        where: {
          userId,
          processingStatus: { in: ['RECEIVED', 'VALIDATING', 'PROCESSING', 'ANALYZING'] },
        },
      }),
      this.prisma.messageAnalysis.findMany({
        where: { message: { userId } },
        select: { category: true },
      }),
    ]);

    const categoryDistribution: Record<MessageCategory, number> = {
      PERSONAL: 0,
      WORK: 0,
      EDUCATION: 0,
      FINANCIAL: 0,
      BUSINESS: 0,
      SOCIAL: 0,
      PROMOTIONAL: 0,
      TRANSACTIONAL: 0,
      NOTIFICATION: 0,
      OTHER: 0,
    };

    for (const a of analyses) {
      if (a.category in categoryDistribution) {
        categoryDistribution[a.category as MessageCategory]++;
      } else {
        categoryDistribution.OTHER++;
      }
    }

    return {
      totalMessages,
      highPriorityCount,
      urgentCount,
      requiresActionCount,
      requiresReplyCount,
      completedCount,
      pendingProcessingCount,
      categoryDistribution,
    };
  }

  /**
   * Deletes a message, cascading to its analysis and action items.
   */
  async deleteMessage(messageId: string, userId: string): Promise<{ deleted: boolean }> {
    const existing = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!existing) {
      throw new NotFoundException(`Message with ID "${messageId}" not found`);
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException('You do not have permission to delete this message');
    }

    await this.prisma.message.delete({
      where: { id: messageId },
    });

    return { deleted: true };
  }

  // Helper mappings
  private mapToMessageDto(
    m: Prisma.MessageGetPayload<{ include: { analysis: true; actionItems: true } }>,
    isDuplicate = false,
  ): MessageDto {
    return {
      id: m.id,
      userId: m.userId,
      source: m.source,
      senderName: m.senderName,
      senderIdentifier: m.senderIdentifier,
      subject: m.subject,
      content: m.content,
      receivedAt: m.receivedAt.toISOString(),
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
      processingStatus: m.processingStatus as MessageProcessingStatus,
      isDuplicate,
      analysis: m.analysis ? this.mapToAnalysisDto(m.analysis) : null,
      actionItems: (m.actionItems || []).map((item) => ({
        id: item.id,
        messageId: item.messageId,
        userId: item.userId,
        title: item.title,
        description: item.description,
        priority: item.priority as MessagePriority,
        dueDate: item.dueDate ? item.dueDate.toISOString() : null,
        status: item.status as ActionItemStatus,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
    };
  }

  private mapToAnalysisDto(a: Prisma.MessageAnalysisGetPayload<object>): MessageAnalysisDto {
    return {
      id: a.id,
      messageId: a.messageId,
      category: a.category as MessageCategory,
      priority: a.priority as MessagePriority,
      priorityExplanation: a.priorityExplanation,
      urgency: a.urgency as MessageUrgency,
      intent: a.intent as MessageIntent,
      sentiment: a.sentiment as MessageSentiment,
      summary: a.summary,
      requiresReply: a.requiresReply,
      requiresAction: a.requiresAction,
      confidence: a.confidence,
      extractedEntities: (a.extractedEntities as unknown as ExtractedEntity[]) || [],
      analysisMetadata: a.analysisMetadata as Record<string, unknown> | null,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    };
  }
}
