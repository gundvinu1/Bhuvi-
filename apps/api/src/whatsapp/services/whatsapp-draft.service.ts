import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@bhuvi/database';
import { WhatsAppDraftDto, WhatsAppDraftApprovalStatus } from '@bhuvi/shared';
import { WhatsAppConnectionService } from './whatsapp-connection.service';
import { CreateDraftDto } from '../dto/create-draft.dto';
import { META_GRAPH_API_BASE, DEFAULT_WHATSAPP_API_VERSION } from '../whatsapp.constants';

@Injectable()
export class WhatsAppDraftService {
  private readonly logger = new Logger(WhatsAppDraftService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connectionService: WhatsAppConnectionService,
  ) {}

  /**
   * Creates a draft outbound message.
   * STRICT POLICY: Always created with status PENDING_APPROVAL.
   */
  async createDraft(userId: string, dto: CreateDraftDto): Promise<WhatsAppDraftDto> {
    // Validate connection belongs to user
    const connection = await this.prisma.whatsAppConnection.findFirst({
      where: { id: dto.connectionId, userId, status: 'CONNECTED' },
    });

    if (!connection) {
      throw new NotFoundException(
        `Active WhatsApp connection '${dto.connectionId}' not found for user.`,
      );
    }

    // Validate conversation belongs to user
    const conversation = await this.prisma.whatsAppConversation.findFirst({
      where: { id: dto.conversationId, userId },
    });

    if (!conversation) {
      throw new NotFoundException(
        `WhatsApp conversation '${dto.conversationId}' not found for user.`,
      );
    }

    const draft = await this.prisma.whatsAppMessageDraft.create({
      data: {
        userId,
        connectionId: dto.connectionId,
        conversationId: dto.conversationId,
        recipientPhone: dto.recipientPhone,
        messageType: dto.messageType ?? 'text',
        content: dto.content,
        templateName: dto.templateName ?? null,
        templateParams: (dto.templateParams as object) ?? null,
        approvalStatus: 'PENDING_APPROVAL',
      },
    });

    this.logger.log(`Created outbound WhatsApp message draft: ${draft.id} (PENDING_APPROVAL)`);
    return this.toDto(draft);
  }

  /**
   * Retrieves drafts for the user with optional connection or status filters.
   */
  async getDrafts(
    userId: string,
    connectionId?: string,
    status?: WhatsAppDraftApprovalStatus,
  ): Promise<WhatsAppDraftDto[]> {
    const where: Record<string, unknown> = { userId };
    if (connectionId) where['connectionId'] = connectionId;
    if (status) where['approvalStatus'] = status;

    const drafts = await this.prisma.whatsAppMessageDraft.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return drafts.map((d) => this.toDto(d));
  }

  /**
   * Explicitly approves a draft by the authenticated user.
   * AI cannot call this method; requires authenticated user session.
   */
  async approveDraft(userId: string, draftId: string): Promise<WhatsAppDraftDto> {
    const draft = await this.prisma.whatsAppMessageDraft.findFirst({
      where: { id: draftId, userId },
    });

    if (!draft) {
      throw new NotFoundException(`Draft '${draftId}' not found.`);
    }

    if (draft.approvalStatus === 'SENT') {
      throw new BadRequestException('Cannot approve a draft that has already been sent.');
    }

    const updated = await this.prisma.whatsAppMessageDraft.update({
      where: { id: draftId },
      data: {
        approvalStatus: 'APPROVED',
        approvedByUserId: userId,
        approvedAt: new Date(),
      },
    });

    this.logger.log(`User ${userId} approved WhatsApp message draft ${draftId}.`);
    return this.toDto(updated);
  }

  /**
   * Dispatches an approved WhatsApp draft message to the Meta Cloud API.
   * STRICT POLICY: Fails if approvalStatus !== 'APPROVED'.
   */
  async sendDraft(
    userId: string,
    draftId: string,
  ): Promise<{ status: string; draftId: string; externalMessageId: string }> {
    const draft = await this.prisma.whatsAppMessageDraft.findFirst({
      where: { id: draftId, userId },
      include: { connection: true },
    });

    if (!draft) {
      throw new NotFoundException(`Draft '${draftId}' not found.`);
    }

    // STRICT OUTBOUND SECURITY ENFORCEMENT
    if (draft.approvalStatus !== 'APPROVED') {
      this.logger.warn(
        `Attempted send of unapproved draft ${draftId} with status '${draft.approvalStatus}'.`,
      );
      throw new ForbiddenException(
        `Strict Security Policy: WhatsApp messages can only be sent after explicit human approval. Current status: ${draft.approvalStatus}`,
      );
    }

    if (!draft.connection || draft.connection.status !== 'CONNECTED') {
      throw new BadRequestException(
        'WhatsApp connection is disconnected or unavailable for sending.',
      );
    }

    // Decrypt access token
    const token = await this.connectionService.getDecryptedToken(draft.connectionId);
    const version = process.env['WHATSAPP_API_VERSION'] || DEFAULT_WHATSAPP_API_VERSION;
    const url = `${META_GRAPH_API_BASE}/${version}/${draft.connection.phoneNumberId}/messages`;

    // Construct official Cloud API payload
    let bodyPayload: Record<string, unknown>;
    if (draft.templateName) {
      bodyPayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: draft.recipientPhone,
        type: 'template',
        template: {
          name: draft.templateName,
          language: { code: 'en_US' },
          ...(draft.templateParams ? { components: draft.templateParams } : {}),
        },
      };
    } else {
      bodyPayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: draft.recipientPhone,
        type: 'text',
        text: {
          preview_url: false,
          body: draft.content,
        },
      };
    }

    // Dispatch to Meta WhatsApp Cloud API
    let metaMessageId = `wamid.HBg.${Date.now()}.${Math.random().toString(36).substring(2, 8)}`;

    try {
      if (process.env['NODE_ENV'] !== 'test' && !token.startsWith('mock_')) {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(bodyPayload),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          this.logger.error(`Meta Cloud API send error: ${JSON.stringify(errData)}`);
          throw new BadRequestException(
            `Meta Cloud API rejected outbound message: ${JSON.stringify(errData)}`,
          );
        }

        const data = (await response.json()) as { messages?: Array<{ id: string }> };
        if (data.messages && data.messages.length > 0 && data.messages[0]?.id) {
          metaMessageId = data.messages[0].id;
        }
      }
    } catch (err: unknown) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`Failed to dispatch message to Meta API: ${(err as Error).message}`);
      throw new BadRequestException(
        `Failed to dispatch message to Meta: ${(err as Error).message}`,
      );
    }

    // Mark draft as SENT
    await this.prisma.whatsAppMessageDraft.update({
      where: { id: draftId },
      data: {
        approvalStatus: 'SENT',
        sentAt: new Date(),
      },
    });

    // Create Outgoing WhatsAppMessage record
    await this.prisma.whatsAppMessage.create({
      data: {
        userId,
        connectionId: draft.connectionId,
        conversationId: draft.conversationId,
        externalMessageId: metaMessageId,
        direction: 'OUTGOING',
        messageType: draft.messageType,
        textContent: draft.content,
        deliveryStatus: 'SENT',
        timestamp: new Date(),
      },
    });

    // Update conversation lastMessage info
    await this.prisma.whatsAppConversation.update({
      where: { id: draft.conversationId },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: draft.content.substring(0, 100),
      },
    });

    this.logger.log(`Outbound WhatsApp message sent: ${metaMessageId} for draft ${draftId}`);
    return {
      status: 'SENT',
      draftId,
      externalMessageId: metaMessageId,
    };
  }

  private toDto(d: {
    id: string;
    userId: string;
    connectionId: string;
    conversationId: string;
    recipientPhone: string;
    messageType: string;
    content: string;
    templateName: string | null;
    templateParams: any;
    approvalStatus: string;
    approvedByUserId: string | null;
    approvedAt: Date | null;
    sentAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): WhatsAppDraftDto {
    return {
      id: d.id,
      userId: d.userId,
      connectionId: d.connectionId,
      conversationId: d.conversationId,
      recipientPhone: d.recipientPhone,
      messageType: d.messageType,
      content: d.content,
      templateName: d.templateName,
      templateParams: d.templateParams as Record<string, unknown> | null,
      approvalStatus: d.approvalStatus as WhatsAppDraftApprovalStatus,
      approvedByUserId: d.approvedByUserId,
      approvedAt: d.approvedAt?.toISOString() ?? null,
      sentAt: d.sentAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    };
  }
}
