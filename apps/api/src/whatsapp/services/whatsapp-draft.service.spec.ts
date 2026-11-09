import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { WhatsAppDraftService } from './whatsapp-draft.service';

describe('WhatsAppDraftService (Strict Human Approval & Security)', () => {
  let service: WhatsAppDraftService;
  let mockPrisma: any;
  let mockConnectionService: any;

  beforeEach(() => {
    mockPrisma = {
      whatsAppConnection: {
        findFirst: jest.fn(),
      },
      whatsAppConversation: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      whatsAppMessageDraft: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      whatsAppMessage: {
        create: jest.fn(),
      },
    };

    mockConnectionService = {
      getDecryptedToken: jest.fn().mockResolvedValue('mock_test_token'),
    };

    service = new WhatsAppDraftService(mockPrisma as any, mockConnectionService as any);
  });

  it('creates drafts strictly in PENDING_APPROVAL status', async () => {
    const userId = 'user-1';
    mockPrisma.whatsAppConnection.findFirst.mockResolvedValue({
      id: 'conn-1',
      userId,
      status: 'CONNECTED',
    });
    mockPrisma.whatsAppConversation.findFirst.mockResolvedValue({
      id: 'conv-1',
      userId,
    });

    mockPrisma.whatsAppMessageDraft.create.mockResolvedValue({
      id: 'draft-1',
      userId,
      connectionId: 'conn-1',
      conversationId: 'conv-1',
      recipientPhone: '+1234567890',
      messageType: 'text',
      content: 'Here is your update.',
      templateName: null,
      templateParams: null,
      approvalStatus: 'PENDING_APPROVAL',
      approvedByUserId: null,
      approvedAt: null,
      sentAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const draft = await service.createDraft(userId, {
      connectionId: 'conn-1',
      conversationId: 'conv-1',
      recipientPhone: '+1234567890',
      content: 'Here is your update.',
    });

    expect(draft.approvalStatus).toBe('PENDING_APPROVAL');
    expect(mockPrisma.whatsAppMessageDraft.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          approvalStatus: 'PENDING_APPROVAL',
        }),
      }),
    );
  });

  it('allows explicit human approval by authenticated user', async () => {
    const userId = 'user-1';
    const draftId = 'draft-1';

    mockPrisma.whatsAppMessageDraft.findFirst.mockResolvedValue({
      id: draftId,
      userId,
      approvalStatus: 'PENDING_APPROVAL',
      content: 'Test content',
      recipientPhone: '+1234567890',
      messageType: 'text',
      connectionId: 'conn-1',
      conversationId: 'conv-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockPrisma.whatsAppMessageDraft.update.mockResolvedValue({
      id: draftId,
      userId,
      approvalStatus: 'APPROVED',
      approvedByUserId: userId,
      approvedAt: new Date(),
      content: 'Test content',
      recipientPhone: '+1234567890',
      messageType: 'text',
      connectionId: 'conn-1',
      conversationId: 'conv-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const approved = await service.approveDraft(userId, draftId);

    expect(approved.approvalStatus).toBe('APPROVED');
    expect(approved.approvedByUserId).toBe(userId);
    expect(mockPrisma.whatsAppMessageDraft.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: draftId },
        data: expect.objectContaining({
          approvalStatus: 'APPROVED',
          approvedByUserId: userId,
        }),
      }),
    );
  });

  it('CRITICAL SECURITY: Strictly forbids sending a draft that is PENDING_APPROVAL', async () => {
    const userId = 'user-1';
    const draftId = 'draft-unapproved';

    mockPrisma.whatsAppMessageDraft.findFirst.mockResolvedValue({
      id: draftId,
      userId,
      approvalStatus: 'PENDING_APPROVAL', // Not approved!
      connection: { status: 'CONNECTED', phoneNumberId: 'phone-1' },
    });

    await expect(service.sendDraft(userId, draftId)).rejects.toThrow(ForbiddenException);
    expect(mockPrisma.whatsAppMessage.create).not.toHaveBeenCalled();
  });

  it('sends an approved draft, records outbound message, and transitions status to SENT', async () => {
    const userId = 'user-1';
    const draftId = 'draft-approved-ready';

    mockPrisma.whatsAppMessageDraft.findFirst.mockResolvedValue({
      id: draftId,
      userId,
      connectionId: 'conn-1',
      conversationId: 'conv-1',
      recipientPhone: '+1234567890',
      content: 'Approved reply ready to go.',
      messageType: 'text',
      approvalStatus: 'APPROVED',
      connection: { status: 'CONNECTED', phoneNumberId: 'phone-1' },
    });

    mockPrisma.whatsAppMessageDraft.update.mockResolvedValue({});
    mockPrisma.whatsAppMessage.create.mockResolvedValue({});
    mockPrisma.whatsAppConversation.update.mockResolvedValue({});

    const result = await service.sendDraft(userId, draftId);

    expect(result.status).toBe('SENT');
    expect(result.draftId).toBe(draftId);
    expect(result.externalMessageId).toBeDefined();

    expect(mockPrisma.whatsAppMessageDraft.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: draftId },
        data: expect.objectContaining({
          approvalStatus: 'SENT',
        }),
      }),
    );

    expect(mockPrisma.whatsAppMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          direction: 'OUTGOING',
          textContent: 'Approved reply ready to go.',
          deliveryStatus: 'SENT',
        }),
      }),
    );
  });

  it('rejects cross-user access to approve or send drafts', async () => {
    mockPrisma.whatsAppMessageDraft.findFirst.mockResolvedValue(null);

    await expect(service.approveDraft('attacker', 'victim-draft')).rejects.toThrow(
      NotFoundException,
    );

    await expect(service.sendDraft('attacker', 'victim-draft')).rejects.toThrow(NotFoundException);
  });

  it('rejects approving a draft that was already sent', async () => {
    const userId = 'user-1';
    mockPrisma.whatsAppMessageDraft.findFirst.mockResolvedValue({
      id: 'draft-already-sent',
      userId,
      approvalStatus: 'SENT',
    });

    await expect(service.approveDraft(userId, 'draft-already-sent')).rejects.toThrow(
      BadRequestException,
    );
  });
});
