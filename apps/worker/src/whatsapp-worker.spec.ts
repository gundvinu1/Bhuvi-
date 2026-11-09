import { BhuviWorker, WorkerConfig } from './main';
import {
  JOB_PROCESS_WHATSAPP_WEBHOOK,
  JOB_SEND_WHATSAPP_APPROVED_MESSAGE,
  JOB_UPDATE_WHATSAPP_MESSAGE_STATUS,
} from '@bhuvi/queue';

describe('BhuviWorker - WhatsApp Integration Processing', () => {
  let worker: BhuviWorker;
  let mockPrisma: any;
  const config: WorkerConfig = {
    nodeEnv: 'test',
    port: 3002,
  };

  beforeEach(() => {
    mockPrisma = {
      whatsAppConnection: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      whatsAppContact: {
        upsert: jest.fn(),
      },
      whatsAppConversation: {
        upsert: jest.fn(),
        update: jest.fn(),
      },
      whatsAppMessage: {
        findUnique: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      whatsAppMedia: {
        create: jest.fn(),
      },
      whatsAppWebhookEvent: {
        updateMany: jest.fn(),
      },
      message: {
        create: jest.fn(),
      },
      messageAnalysis: {
        create: jest.fn(),
      },
      whatsAppMessageDraft: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    worker = new BhuviWorker(config, mockPrisma);
  });

  it('processes incoming WhatsApp text message and invokes Module 07 analysis', async () => {
    const connectionId = 'conn-123';
    const userId = 'user-abc';
    const externalMessageId = 'wamid.HBg.test.1';

    mockPrisma.whatsAppConnection.findUnique.mockResolvedValue({
      id: connectionId,
      userId,
      phoneNumberId: 'phone-1',
    });

    mockPrisma.whatsAppContact.upsert.mockResolvedValue({
      id: 'contact-1',
      userId,
      connectionId,
      waId: '+1234567890',
      name: 'Alice Smith',
    });

    mockPrisma.whatsAppConversation.upsert.mockResolvedValue({
      id: 'conv-1',
      userId,
      connectionId,
      contactId: 'contact-1',
      unreadCount: 1,
    });

    mockPrisma.whatsAppMessage.findUnique.mockResolvedValue(null);

    mockPrisma.message.create.mockResolvedValue({
      id: 'msg-mod07-1',
      userId,
      source: 'WHATSAPP',
      content: 'Can you please review the urgent report by 5 PM?',
    });

    mockPrisma.messageAnalysis.create.mockResolvedValue({
      id: 'analysis-1',
      messageId: 'msg-mod07-1',
      category: 'WORK',
      priority: 'HIGH',
      urgency: 'URGENT',
    });

    mockPrisma.whatsAppMessage.create.mockResolvedValue({
      id: 'wa-msg-1',
      userId,
      connectionId,
      conversationId: 'conv-1',
      externalMessageId,
      direction: 'INCOMING',
      deliveryStatus: 'DELIVERED',
    });

    mockPrisma.whatsAppConversation.update.mockResolvedValue({});
    mockPrisma.whatsAppWebhookEvent.updateMany.mockResolvedValue({});

    const job = {
      name: JOB_PROCESS_WHATSAPP_WEBHOOK,
      data: {
        eventId: 'event-1',
        connectionId,
        payload: {
          id: externalMessageId,
          from: '+1234567890',
          timestamp: '1700000000',
          type: 'text',
          text: { body: 'Can you please review the urgent report by 5 PM?' },
          contacts: [{ waId: '+1234567890', profile: { name: 'Alice Smith' } }],
        },
      },
    };

    const result = (await worker.processJob(job as any)) as any;

    expect(result.status).toBe('PROCESSED');
    expect(result.messagesProcessed).toBe(1);
    expect(mockPrisma.whatsAppContact.upsert).toHaveBeenCalled();
    expect(mockPrisma.whatsAppConversation.upsert).toHaveBeenCalled();
    expect(mockPrisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: 'WHATSAPP',
          senderName: 'Alice Smith',
        }),
      }),
    );
    expect(mockPrisma.messageAnalysis.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          priority: 'HIGH',
          urgency: 'URGENT',
          requiresReply: true,
          requiresAction: true,
        }),
      }),
    );
  });

  it('skips duplicate incoming WhatsApp messages idempotently', async () => {
    const connectionId = 'conn-123';
    mockPrisma.whatsAppConnection.findUnique.mockResolvedValue({
      id: connectionId,
      userId: 'user-abc',
      phoneNumberId: 'phone-1',
    });

    mockPrisma.whatsAppContact.upsert.mockResolvedValue({ id: 'contact-1' });
    mockPrisma.whatsAppConversation.upsert.mockResolvedValue({ id: 'conv-1' });

    // Existing message found
    mockPrisma.whatsAppMessage.findUnique.mockResolvedValue({ id: 'existing-msg' });

    const job = {
      name: JOB_PROCESS_WHATSAPP_WEBHOOK,
      data: {
        eventId: 'event-dup',
        connectionId,
        payload: {
          id: 'wamid.HBg.dup',
          from: '+1234567890',
          timestamp: '1700000000',
          type: 'text',
          text: { body: 'Duplicate text' },
        },
      },
    };

    const result = (await worker.processJob(job as any)) as any;

    expect(result.status).toBe('PROCESSED');
    expect(result.messagesProcessed).toBe(0);
    expect(mockPrisma.message.create).not.toHaveBeenCalled();
  });

  it('updates message delivery status on status webhook', async () => {
    mockPrisma.whatsAppMessage.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.whatsAppWebhookEvent.updateMany.mockResolvedValue({ count: 1 });

    const job = {
      name: JOB_PROCESS_WHATSAPP_WEBHOOK,
      data: {
        eventId: 'event-status-1',
        payload: {
          id: 'wamid.HBg.status.test',
          status: 'read',
          isStatusUpdate: true,
        },
      },
    };

    const result = (await worker.processJob(job as any)) as any;

    expect(result.status).toBe('PROCESSED');
    expect(result.statusesProcessed).toBe(1);
    expect(mockPrisma.whatsAppMessage.updateMany).toHaveBeenCalledWith({
      where: { externalMessageId: 'wamid.HBg.status.test' },
      data: { deliveryStatus: 'READ' },
    });
  });

  it('updates message delivery status on direct status job', async () => {
    mockPrisma.whatsAppMessage.updateMany.mockResolvedValue({ count: 1 });

    const job = {
      name: JOB_UPDATE_WHATSAPP_MESSAGE_STATUS,
      data: {
        eventId: 'status-event-1',
        externalMessageId: 'wamid.HBg.status.direct',
        status: 'delivered',
        timestamp: '1700000000',
      },
    };

    const result = (await worker.processJob(job as any)) as any;

    expect(result.status).toBe('UPDATED');
    expect(mockPrisma.whatsAppMessage.updateMany).toHaveBeenCalledWith({
      where: { externalMessageId: 'wamid.HBg.status.direct' },
      data: { deliveryStatus: 'DELIVERED' },
    });
  });

  it('sends approved message draft and prevents sending unapproved drafts', async () => {
    const userId = 'user-123';
    const draftId = 'draft-approved-1';

    mockPrisma.whatsAppMessageDraft.findFirst.mockResolvedValue({
      id: draftId,
      userId,
      connectionId: 'conn-1',
      conversationId: 'conv-1',
      content: 'Here is the approved response.',
      messageType: 'text',
      approvalStatus: 'APPROVED',
    });

    mockPrisma.whatsAppMessageDraft.update.mockResolvedValue({});
    mockPrisma.whatsAppMessage.create.mockResolvedValue({});

    const job = {
      name: JOB_SEND_WHATSAPP_APPROVED_MESSAGE,
      data: {
        draftId,
        userId,
        connectionId: 'conn-1',
      },
    };

    const result = (await worker.processJob(job as any)) as any;

    expect(result.status).toBe('SENT');
    expect(mockPrisma.whatsAppMessageDraft.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: draftId },
        data: expect.objectContaining({ approvalStatus: 'SENT' }),
      }),
    );
    expect(mockPrisma.whatsAppMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          direction: 'OUTGOING',
          textContent: 'Here is the approved response.',
        }),
      }),
    );
  });

  it('throws an error if draft is not in APPROVED state', async () => {
    mockPrisma.whatsAppMessageDraft.findFirst.mockResolvedValue(null);

    const job = {
      name: JOB_SEND_WHATSAPP_APPROVED_MESSAGE,
      data: {
        draftId: 'draft-unapproved',
        userId: 'user-123',
        connectionId: 'conn-1',
      },
    };

    await expect(worker.processJob(job as any)).rejects.toThrow(
      /not found or not in APPROVED state/,
    );
  });
});
