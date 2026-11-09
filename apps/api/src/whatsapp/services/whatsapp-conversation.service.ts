import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@bhuvi/database';
import {
  WhatsAppConversationDto,
  WhatsAppMessageDto,
  WhatsAppStatsDto,
  WhatsAppMessageDirection,
  WhatsAppMessageType,
  WhatsAppDeliveryStatus,
  MessageCategory,
  MessagePriority,
  MessageUrgency,
} from '@bhuvi/shared';
import { QueryWhatsAppDto } from '../dto/query-whatsapp.dto';

@Injectable()
export class WhatsAppConversationService {
  private readonly logger = new Logger(WhatsAppConversationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves conversation threads for a user with multi-account filtering and search.
   */
  async getConversations(
    userId: string,
    query: QueryWhatsAppDto,
  ): Promise<{ items: WhatsAppConversationDto[]; total: number; page: number; limit: number }> {
    this.logger.log(`Fetching conversations for user [${userId}]`);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { userId };

    if (query.connectionId) {
      where['connectionId'] = query.connectionId;
    }

    if (query.unread) {
      where['unreadCount'] = { gt: 0 };
    }

    if (query.status) {
      where['status'] = query.status;
    }

    if (query.search) {
      where['OR'] = [
        { contact: { name: { contains: query.search, mode: 'insensitive' } } },
        { contact: { waId: { contains: query.search } } },
        { lastMessagePreview: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.whatsAppConversation.count({ where }),
      this.prisma.whatsAppConversation.findMany({
        where,
        include: {
          contact: true,
          connection: {
            select: {
              id: true,
              displayPhoneNumber: true,
              displayName: true,
            },
          },
        },
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const dtos: WhatsAppConversationDto[] = items.map((conv) => ({
      id: conv.id,
      userId: conv.userId,
      connectionId: conv.connectionId,
      contactId: conv.contactId,
      status: conv.status,
      lastMessageAt: conv.lastMessageAt?.toISOString() ?? null,
      lastMessagePreview: conv.lastMessagePreview,
      unreadCount: conv.unreadCount,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
      contact: conv.contact
        ? {
            id: conv.contact.id,
            userId: conv.contact.userId,
            connectionId: conv.contact.connectionId,
            waId: conv.contact.waId,
            name: conv.contact.name,
            profileData: conv.contact.profileData as Record<string, unknown> | null,
            createdAt: conv.contact.createdAt.toISOString(),
            updatedAt: conv.contact.updatedAt.toISOString(),
          }
        : null,
      connection: conv.connection
        ? {
            id: conv.connection.id,
            displayPhoneNumber: conv.connection.displayPhoneNumber,
            displayName: conv.connection.displayName,
          }
        : null,
    }));

    return { items: dtos, total, page, limit };
  }

  /**
   * Retrieves single conversation details.
   */
  async getConversation(userId: string, id: string): Promise<WhatsAppConversationDto> {
    const conv = await this.prisma.whatsAppConversation.findFirst({
      where: { id, userId },
      include: {
        contact: true,
        connection: {
          select: {
            id: true,
            displayPhoneNumber: true,
            displayName: true,
          },
        },
      },
    });

    if (!conv) {
      throw new NotFoundException(`WhatsApp conversation '${id}' not found.`);
    }

    return {
      id: conv.id,
      userId: conv.userId,
      connectionId: conv.connectionId,
      contactId: conv.contactId,
      status: conv.status,
      lastMessageAt: conv.lastMessageAt?.toISOString() ?? null,
      lastMessagePreview: conv.lastMessagePreview,
      unreadCount: conv.unreadCount,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
      contact: conv.contact
        ? {
            id: conv.contact.id,
            userId: conv.contact.userId,
            connectionId: conv.contact.connectionId,
            waId: conv.contact.waId,
            name: conv.contact.name,
            profileData: conv.contact.profileData as Record<string, unknown> | null,
            createdAt: conv.contact.createdAt.toISOString(),
            updatedAt: conv.contact.updatedAt.toISOString(),
          }
        : null,
      connection: conv.connection
        ? {
            id: conv.connection.id,
            displayPhoneNumber: conv.connection.displayPhoneNumber,
            displayName: conv.connection.displayName,
          }
        : null,
    };
  }

  /**
   * Retrieves paginated messages in a conversation, including attachments and AI analysis.
   */
  async getConversationMessages(
    userId: string,
    conversationId: string,
    page = 1,
    limit = 50,
  ): Promise<{ items: WhatsAppMessageDto[]; total: number; page: number; limit: number }> {
    // Verify conversation belongs to user
    const conv = await this.prisma.whatsAppConversation.findFirst({
      where: { id: conversationId, userId },
    });

    if (!conv) {
      throw new NotFoundException(`WhatsApp conversation '${conversationId}' not found.`);
    }

    const skip = (page - 1) * limit;

    const [total, messages] = await Promise.all([
      this.prisma.whatsAppMessage.count({ where: { conversationId } }),
      this.prisma.whatsAppMessage.findMany({
        where: { conversationId },
        include: {
          media: true,
          message: {
            include: {
              analysis: true,
              actionItems: true,
            },
          },
        },
        orderBy: { timestamp: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    // Mark messages as read and reset unread count
    if (conv.unreadCount > 0) {
      await this.prisma.whatsAppConversation.update({
        where: { id: conversationId },
        data: { unreadCount: 0 },
      });
    }

    const items: WhatsAppMessageDto[] = messages.map((m) => this.mapMessageToDto(m));
    return { items, total, page, limit };
  }

  /**
   * Queries messages across all user conversations.
   */
  async getMessages(
    userId: string,
    query: QueryWhatsAppDto,
  ): Promise<{ items: WhatsAppMessageDto[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { userId };

    if (query.connectionId) {
      where['connectionId'] = query.connectionId;
    }

    if (query.search) {
      where['textContent'] = { contains: query.search, mode: 'insensitive' };
    }

    const [total, messages] = await Promise.all([
      this.prisma.whatsAppMessage.count({ where }),
      this.prisma.whatsAppMessage.findMany({
        where,
        include: {
          media: true,
          message: {
            include: {
              analysis: true,
              actionItems: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      items: messages.map((m) => this.mapMessageToDto(m)),
      total,
      page,
      limit,
    };
  }

  /**
   * Retrieves single message details.
   */
  async getMessage(userId: string, id: string): Promise<WhatsAppMessageDto> {
    const msg = await this.prisma.whatsAppMessage.findFirst({
      where: { id, userId },
      include: {
        media: true,
        message: {
          include: {
            analysis: true,
            actionItems: true,
          },
        },
      },
    });

    if (!msg) {
      throw new NotFoundException(`WhatsApp message '${id}' not found.`);
    }

    return this.mapMessageToDto(msg);
  }

  /**
   * Aggregates stats for the WhatsApp dashboard.
   */
  async getStats(userId: string): Promise<WhatsAppStatsDto> {
    const [totalConnections, activeConversations, totalMessages, unreadMessages, pendingDrafts] =
      await Promise.all([
        this.prisma.whatsAppConnection.count({
          where: { userId, status: 'CONNECTED' },
        }),
        this.prisma.whatsAppConversation.count({
          where: { userId, status: 'ACTIVE' },
        }),
        this.prisma.whatsAppMessage.count({
          where: { userId },
        }),
        this.prisma.whatsAppConversation.aggregate({
          where: { userId },
          _sum: { unreadCount: true },
        }),
        this.prisma.whatsAppMessageDraft.count({
          where: { userId, approvalStatus: 'PENDING_APPROVAL' },
        }),
      ]);

    return {
      totalConnections,
      activeConversations,
      totalMessages,
      unreadMessages: unreadMessages._sum.unreadCount ?? 0,
      pendingDrafts,
    };
  }

  private mapMessageToDto(m: any): WhatsAppMessageDto {
    const analysis = m.message?.analysis;
    const actionItems = m.message?.actionItems ?? [];

    return {
      id: m.id,
      userId: m.userId,
      connectionId: m.connectionId,
      conversationId: m.conversationId,
      externalMessageId: m.externalMessageId,
      direction: m.direction as WhatsAppMessageDirection,
      messageType: m.messageType as WhatsAppMessageType,
      textContent: m.textContent,
      mediaMetadata: m.mediaMetadata as Record<string, unknown> | null,
      deliveryStatus: m.deliveryStatus as WhatsAppDeliveryStatus,
      timestamp: m.timestamp.toISOString(),
      messageId: m.messageId,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
      media: (m.media || []).map((med: any) => ({
        id: med.id,
        messageId: med.messageId,
        mediaId: med.mediaId,
        mimeType: med.mimeType,
        filename: med.filename,
        fileSize: med.fileSize,
        storagePath: med.storagePath,
        createdAt: med.createdAt.toISOString(),
      })),
      analysis: analysis
        ? {
            category: analysis.category as MessageCategory,
            priority: analysis.priority as MessagePriority,
            urgency: analysis.urgency as MessageUrgency,
            intent: analysis.intent,
            sentiment: analysis.sentiment,
            summary: analysis.summary,
            requiresReply: analysis.requiresReply,
            requiresAction: analysis.requiresAction,
            confidence: analysis.confidence,
          }
        : null,
      actionItems: actionItems.map((ai: any) => ({
        id: ai.id,
        title: ai.title,
        priority: ai.priority,
        status: ai.status,
        dueDate: ai.dueDate ? ai.dueDate.toISOString() : null,
      })),
    };
  }
}
