import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { google } from 'googleapis';
import * as crypto from 'crypto';
import { Prisma, PrismaService } from '@bhuvi/database';
import { GmailOAuthService } from './gmail-oauth.service';
import { EmailParserService } from './email-parser.service';
import { MessageIntelligenceService } from '../../messages/services/message-intelligence.service';
import {
  GmailMessageDto,
  GmailSyncStatsDto,
  PaginatedGmailMessagesResponse,
  QueryGmailMessagesDto,
  MessageCategory,
  MessagePriority,
  MessageUrgency,
} from '@bhuvi/shared';
import { createDefaultQueue, enqueueSyncGmail } from '@bhuvi/queue';

@Injectable()
export class GmailSyncService {
  private readonly logger = new Logger(GmailSyncService.name);
  private readonly activeSyncs = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly oauthService: GmailOAuthService,
    private readonly emailParser: EmailParserService,
    private readonly messageIntelligence: MessageIntelligenceService,
  ) {}

  /**
   * Attempts to enqueue a BullMQ background sync job.
   */
  async tryEnqueueSync(connectionId: string, userId: string): Promise<void> {
    try {
      const queue = createDefaultQueue();
      await enqueueSyncGmail(queue, { connectionId, userId });
      await queue.close();
    } catch (err: unknown) {
      this.logger.debug(
        `BullMQ enqueue skipped (Redis might be in test mode or unconfigured): ${(err as Error).message}`,
      );
    }
  }

  /**
   * Performs inbox synchronization (initial or incremental) for a connected Gmail account.
   */
  async syncInbox(
    userId: string,
    connectionId?: string,
    maxMessages = 50,
  ): Promise<{ syncedCount: number; historyId?: string }> {
    // 1. Identify active Gmail connection for user
    const connection = connectionId
      ? await this.prisma.gmailConnection.findUnique({ where: { id: connectionId } })
      : await this.prisma.gmailConnection.findFirst({
          where: { userId, connectionStatus: { in: ['CONNECTED', 'REQUIRES_REAUTH'] } },
          orderBy: { updatedAt: 'desc' },
        });

    if (!connection || connection.userId !== userId) {
      throw new NotFoundException('Active Gmail connection not found for user.');
    }

    // 2. Concurrency protection: prevent overlapping syncs per account
    if (this.activeSyncs.has(connection.id)) {
      this.logger.warn(
        `Sync already in progress for connection [${connection.id}]. Skipping duplicate trigger.`,
      );
      return { syncedCount: 0, historyId: connection.lastHistoryId || undefined };
    }

    this.activeSyncs.add(connection.id);
    const syncStart = new Date();

    // 3. Record sync state IN_PROGRESS
    const syncState = await this.prisma.gmailSyncState.create({
      data: {
        userId,
        gmailConnectionId: connection.id,
        syncStatus: 'IN_PROGRESS',
        lastAttemptAt: syncStart,
        syncedCount: 0,
      },
    });

    try {
      const auth = await this.oauthService.getAuthenticatedClient(connection.id, userId);
      const gmail = google.gmail({ version: 'v1', auth });

      let syncedCount = 0;
      let targetMessageIds: string[] = [];

      // 4. Determine sync mode: incremental via historyId or initial recent messages
      let usedHistory = false;
      if (connection.lastHistoryId) {
        try {
          this.logger.log(
            `Attempting incremental sync with startHistoryId [${connection.lastHistoryId}] for connection [${connection.id}]`,
          );
          const historyRes = await gmail.users.history.list({
            userId: 'me',
            startHistoryId: connection.lastHistoryId,
            historyTypes: ['messageAdded'],
          });

          if (historyRes.data.history && historyRes.data.history.length > 0) {
            const addedIds: string[] = [];
            for (const h of historyRes.data.history) {
              if (h.messagesAdded) {
                for (const item of h.messagesAdded) {
                  if (item.message?.id) {
                    addedIds.push(item.message.id);
                  }
                }
              }
            }
            targetMessageIds = Array.from(new Set(addedIds));
            usedHistory = true;
            this.logger.log(`Found ${targetMessageIds.length} new messages via history API.`);
          }
        } catch (histErr: unknown) {
          // If history ID is expired (404), fall back safely to recent message listing
          this.logger.warn(
            `Gmail history API failed (likely expired history ID): ${(histErr as Error).message}. Falling back to standard inbox list.`,
          );
          usedHistory = false;
        }
      }

      if (!usedHistory) {
        // Query recent inbox messages
        const listRes = await gmail.users.messages.list({
          userId: 'me',
          maxResults: Math.min(100, Math.max(5, maxMessages)),
          q: 'label:INBOX',
        });

        const msgs = listRes.data.messages || [];
        targetMessageIds = msgs.map((m) => m.id!).filter(Boolean);
      }

      // 5. Fetch, parse, and persist each message
      for (const msgId of targetMessageIds) {
        // Check if message is already stored in DB to guarantee idempotency
        const existing = await this.prisma.gmailMessage.findUnique({
          where: {
            gmailConnectionId_providerMessageId: {
              gmailConnectionId: connection.id,
              providerMessageId: msgId,
            },
          },
        });

        if (existing) {
          continue;
        }

        try {
          const fullMsgRes = await gmail.users.messages.get({
            userId: 'me',
            id: msgId,
            format: 'full',
          });

          const parsed = this.emailParser.parseMessage(fullMsgRes.data);

          // Save GmailMessage and child attachments in transaction
          const createdGmailMessage = await this.prisma.$transaction(async (tx) => {
            const gm = await tx.gmailMessage.create({
              data: {
                userId,
                gmailConnectionId: connection.id,
                providerMessageId: parsed.providerMessageId,
                providerThreadId: parsed.providerThreadId,
                senderName: parsed.senderName,
                senderEmail: parsed.senderEmail,
                recipientEmails: parsed.recipientEmails,
                ccEmails: parsed.ccEmails,
                subject: parsed.subject,
                snippet: parsed.snippet,
                bodyText: parsed.bodyText,
                bodyHtml: parsed.bodyHtml,
                receivedAt: parsed.receivedAt,
                isRead: parsed.isRead,
                hasAttachments: parsed.hasAttachments,
                labels: parsed.labels,
                syncStatus: 'SYNCHRONIZED',
              },
            });

            if (parsed.attachments.length > 0) {
              await tx.gmailAttachment.createMany({
                data: parsed.attachments.map((att) => ({
                  userId,
                  gmailMessageId: gm.id,
                  providerAttachmentId: att.providerAttachmentId,
                  filename: att.filename,
                  mimeType: att.mimeType,
                  size: att.size,
                  downloadStatus: 'METADATA_ONLY',
                })),
              });
            }

            return gm;
          });

          // 6. Module 07 Message Intelligence Integration
          // Ingest email into Message entity and analyze with existing intelligence engine
          try {
            const contentHash = crypto
              .createHash('sha256')
              .update(parsed.bodyText, 'utf8')
              .digest('hex');

            const messageEntity = await this.prisma.message.create({
              data: {
                userId,
                source: 'GMAIL',
                senderName: parsed.senderName || parsed.senderEmail,
                senderIdentifier: parsed.senderEmail,
                subject: parsed.subject,
                content: parsed.bodyText,
                contentHash,
                receivedAt: parsed.receivedAt,
              },
            });

            // Analyze message through Module 07
            await this.messageIntelligence.analyzeAndStoreMessage(messageEntity.id, userId);

            // Link GmailMessage with Message
            await this.prisma.gmailMessage.update({
              where: { id: createdGmailMessage.id },
              data: { messageId: messageEntity.id },
            });
          } catch (intelErr: unknown) {
            this.logger.warn(
              `Message Intelligence analysis skipped for message [${msgId}]: ${(intelErr as Error).message}`,
            );
          }

          syncedCount++;
        } catch (itemErr: unknown) {
          this.logger.error(`Failed to fetch message [${msgId}]: ${(itemErr as Error).message}`);
        }
      }

      // 7. Update latest history ID from profile
      let latestHistoryId = connection.lastHistoryId;
      try {
        const profile = await gmail.users.getProfile({ userId: 'me' });
        if (profile.data.historyId) {
          latestHistoryId = profile.data.historyId;
        }
      } catch {
        // Fallback to existing history ID
      }

      // 8. Update connection and sync state
      await this.prisma.gmailConnection.update({
        where: { id: connection.id },
        data: {
          lastSyncedAt: new Date(),
          lastHistoryId: latestHistoryId,
          connectionStatus: 'CONNECTED',
        },
      });

      await this.prisma.gmailSyncState.update({
        where: { id: syncState.id },
        data: {
          syncStatus: 'SUCCESS',
          syncedCount,
          lastHistoryId: latestHistoryId,
          lastSuccessfulSyncAt: new Date(),
        },
      });

      this.logger.log(
        `Sync completed for connection [${connection.id}]. Synced ${syncedCount} new messages.`,
      );

      return { syncedCount, historyId: latestHistoryId || undefined };
    } catch (syncErr: unknown) {
      const errMsg = (syncErr as Error).message;
      this.logger.error(`Sync failed for connection [${connection.id}]: ${errMsg}`);

      await this.prisma.gmailSyncState.update({
        where: { id: syncState.id },
        data: {
          syncStatus: 'FAILED',
          errorMessage: errMsg,
        },
      });

      if (errMsg.includes('revoked') || errMsg.includes('invalid_grant')) {
        await this.prisma.gmailConnection.update({
          where: { id: connection.id },
          data: { connectionStatus: 'REQUIRES_REAUTH' },
        });
      }

      throw syncErr;
    } finally {
      this.activeSyncs.delete(connection.id);
    }
  }

  /**
   * Queries paginated synchronized Gmail messages with filtering.
   */
  async getMessages(
    userId: string,
    query: QueryGmailMessagesDto,
  ): Promise<PaginatedGmailMessagesResponse> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.GmailMessageWhereInput = {
      userId,
      ...(query.unreadOnly ? { isRead: false } : {}),
      ...(query.search
        ? {
            OR: [
              { subject: { contains: query.search.trim(), mode: 'insensitive' } },
              { bodyText: { contains: query.search.trim(), mode: 'insensitive' } },
              { senderEmail: { contains: query.search.trim(), mode: 'insensitive' } },
              { senderName: { contains: query.search.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.category || query.priority || query.importantOnly
        ? {
            message: {
              analysis: {
                ...(query.category ? { category: query.category } : {}),
                ...(query.priority ? { priority: query.priority } : {}),
                ...(query.importantOnly ? { priority: { in: ['CRITICAL', 'HIGH'] } } : {}),
              },
            },
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.gmailMessage.count({ where }),
      this.prisma.gmailMessage.findMany({
        where,
        skip,
        take: limit,
        orderBy: { receivedAt: 'desc' },
        include: {
          attachments: true,
          message: {
            include: {
              analysis: true,
              actionItems: true,
            },
          },
        },
      }),
    ]);

    const messages: GmailMessageDto[] = items.map((m) => ({
      id: m.id,
      userId: m.userId,
      gmailConnectionId: m.gmailConnectionId,
      providerMessageId: m.providerMessageId,
      providerThreadId: m.providerThreadId,
      senderName: m.senderName,
      senderEmail: m.senderEmail,
      recipientEmails: m.recipientEmails,
      ccEmails: m.ccEmails,
      subject: m.subject,
      snippet: m.snippet,
      bodyText: m.bodyText,
      bodyHtml: m.bodyHtml,
      receivedAt: m.receivedAt.toISOString(),
      isRead: m.isRead,
      hasAttachments: m.hasAttachments,
      labels: m.labels,
      syncStatus: m.syncStatus,
      messageId: m.messageId,
      analysis: m.message?.analysis
        ? {
            category: m.message.analysis.category as MessageCategory,
            priority: m.message.analysis.priority as MessagePriority,
            urgency: m.message.analysis.urgency as MessageUrgency,
            summary: m.message.analysis.summary,
            requiresReply: m.message.analysis.requiresReply,
            requiresAction: m.message.analysis.requiresAction,
            confidence: m.message.analysis.confidence,
          }
        : null,
      actionItems: m.message?.actionItems.map((ai) => ({
        id: ai.id,
        title: ai.title,
        description: ai.description,
        priority: ai.priority,
        dueDate: ai.dueDate ? ai.dueDate.toISOString() : null,
        status: ai.status,
      })),
      attachments: m.attachments.map((att) => ({
        id: att.id,
        gmailMessageId: att.gmailMessageId,
        providerAttachmentId: att.providerAttachmentId,
        filename: att.filename,
        mimeType: att.mimeType,
        size: att.size,
        downloadStatus: att.downloadStatus as any,
        createdAt: att.createdAt.toISOString(),
      })),
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    }));

    return {
      messages,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Retrieves single email message details.
   */
  async getMessageById(userId: string, id: string): Promise<GmailMessageDto> {
    const m = await this.prisma.gmailMessage.findUnique({
      where: { id },
      include: {
        attachments: true,
        message: {
          include: {
            analysis: true,
            actionItems: true,
          },
        },
      },
    });

    if (!m || m.userId !== userId) {
      throw new NotFoundException(`Email with ID "${id}" was not found.`);
    }

    return {
      id: m.id,
      userId: m.userId,
      gmailConnectionId: m.gmailConnectionId,
      providerMessageId: m.providerMessageId,
      providerThreadId: m.providerThreadId,
      senderName: m.senderName,
      senderEmail: m.senderEmail,
      recipientEmails: m.recipientEmails,
      ccEmails: m.ccEmails,
      subject: m.subject,
      snippet: m.snippet,
      bodyText: m.bodyText,
      bodyHtml: m.bodyHtml,
      receivedAt: m.receivedAt.toISOString(),
      isRead: m.isRead,
      hasAttachments: m.hasAttachments,
      labels: m.labels,
      syncStatus: m.syncStatus,
      messageId: m.messageId,
      analysis: m.message?.analysis
        ? {
            category: m.message.analysis.category as MessageCategory,
            priority: m.message.analysis.priority as MessagePriority,
            urgency: m.message.analysis.urgency as MessageUrgency,
            summary: m.message.analysis.summary,
            requiresReply: m.message.analysis.requiresReply,
            requiresAction: m.message.analysis.requiresAction,
            confidence: m.message.analysis.confidence,
          }
        : null,
      actionItems: m.message?.actionItems.map((ai) => ({
        id: ai.id,
        title: ai.title,
        description: ai.description,
        priority: ai.priority,
        dueDate: ai.dueDate ? ai.dueDate.toISOString() : null,
        status: ai.status,
      })),
      attachments: m.attachments.map((att) => ({
        id: att.id,
        gmailMessageId: att.gmailMessageId,
        providerAttachmentId: att.providerAttachmentId,
        filename: att.filename,
        mimeType: att.mimeType,
        size: att.size,
        downloadStatus: att.downloadStatus as any,
        createdAt: att.createdAt.toISOString(),
      })),
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    };
  }

  /**
   * Retrieves all messages in a conversation thread.
   */
  async getThread(userId: string, threadId: string): Promise<GmailMessageDto[]> {
    const items = await this.prisma.gmailMessage.findMany({
      where: {
        userId,
        providerThreadId: threadId,
      },
      orderBy: { receivedAt: 'asc' },
      include: {
        attachments: true,
        message: {
          include: { analysis: true },
        },
      },
    });

    return items.map((m) => ({
      id: m.id,
      userId: m.userId,
      gmailConnectionId: m.gmailConnectionId,
      providerMessageId: m.providerMessageId,
      providerThreadId: m.providerThreadId,
      senderName: m.senderName,
      senderEmail: m.senderEmail,
      recipientEmails: m.recipientEmails,
      ccEmails: m.ccEmails,
      subject: m.subject,
      snippet: m.snippet,
      bodyText: m.bodyText,
      bodyHtml: m.bodyHtml,
      receivedAt: m.receivedAt.toISOString(),
      isRead: m.isRead,
      hasAttachments: m.hasAttachments,
      labels: m.labels,
      syncStatus: m.syncStatus,
      messageId: m.messageId,
      analysis: m.message?.analysis as any,
      attachments: m.attachments as any,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    }));
  }

  /**
   * Computes synchronized email statistics for user.
   */
  async getSyncStats(userId: string): Promise<GmailSyncStatsDto> {
    const [
      totalEmails,
      unreadEmails,
      importantEmails,
      requiresReplyCount,
      requiresActionCount,
      connection,
      latestSyncState,
    ] = await Promise.all([
      this.prisma.gmailMessage.count({ where: { userId } }),
      this.prisma.gmailMessage.count({ where: { userId, isRead: false } }),
      this.prisma.gmailMessage.count({
        where: {
          userId,
          message: {
            analysis: {
              priority: { in: ['CRITICAL', 'HIGH'] },
            },
          },
        },
      }),
      this.prisma.gmailMessage.count({
        where: {
          userId,
          message: {
            analysis: {
              requiresReply: true,
            },
          },
        },
      }),
      this.prisma.gmailMessage.count({
        where: {
          userId,
          message: {
            analysis: {
              requiresAction: true,
            },
          },
        },
      }),
      this.prisma.gmailConnection.findFirst({
        where: { userId, connectionStatus: { in: ['CONNECTED', 'REQUIRES_REAUTH'] } },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.gmailSyncState.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      totalEmails,
      unreadEmails,
      importantEmails,
      requiresReplyCount,
      requiresActionCount,
      lastSyncedAt: connection?.lastSyncedAt?.toISOString() ?? null,
      syncStatus: (latestSyncState?.syncStatus as any) || 'IDLE',
    };
  }
}
