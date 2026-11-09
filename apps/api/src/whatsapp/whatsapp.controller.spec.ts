import { Test, TestingModule } from '@nestjs/testing';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppConnectionService } from './services/whatsapp-connection.service';
import { WhatsAppWebhookService } from './services/whatsapp-webhook.service';
import { WhatsAppConversationService } from './services/whatsapp-conversation.service';
import { WhatsAppDraftService } from './services/whatsapp-draft.service';
import { WhatsAppAiService } from './services/whatsapp-ai.service';

describe('WhatsAppController', () => {
  let controller: WhatsAppController;
  let connectionService: any;
  let webhookService: any;
  let conversationService: any;
  let draftService: any;
  let aiService: any;

  beforeEach(async () => {
    connectionService = {
      getConnections: jest.fn().mockResolvedValue([]),
      getConnection: jest.fn().mockResolvedValue({ id: 'conn-1' }),
      createConnection: jest.fn().mockResolvedValue({ id: 'conn-1' }),
      disconnectConnection: jest.fn().mockResolvedValue({ disconnected: true }),
    };

    webhookService = {
      verifyWebhookChallenge: jest.fn().mockReturnValue('mock_challenge_123'),
      handleIncomingWebhook: jest.fn().mockResolvedValue({ status: 'acknowledged' }),
    };

    conversationService = {
      getConversations: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      getConversation: jest.fn().mockResolvedValue({ id: 'conv-1' }),
      getConversationMessages: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      getMessages: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      getMessage: jest.fn().mockResolvedValue({ id: 'msg-1' }),
      getStats: jest.fn().mockResolvedValue({ totalConnections: 1, activeConversations: 2 }),
    };

    draftService = {
      createDraft: jest
        .fn()
        .mockResolvedValue({ id: 'draft-1', approvalStatus: 'PENDING_APPROVAL' }),
      getDrafts: jest.fn().mockResolvedValue([]),
      approveDraft: jest.fn().mockResolvedValue({ id: 'draft-1', approvalStatus: 'APPROVED' }),
      sendDraft: jest.fn().mockResolvedValue({ status: 'SENT', draftId: 'draft-1' }),
    };

    aiService = {
      summarizeConversation: jest.fn().mockResolvedValue({ summary: 'Test summary' }),
      suggestReply: jest.fn().mockResolvedValue({ suggestions: [] }),
      askWhatsApp: jest.fn().mockResolvedValue({ answer: 'Test answer', references: [] }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WhatsAppController],
      providers: [
        { provide: WhatsAppConnectionService, useValue: connectionService },
        { provide: WhatsAppWebhookService, useValue: webhookService },
        { provide: WhatsAppConversationService, useValue: conversationService },
        { provide: WhatsAppDraftService, useValue: draftService },
        { provide: WhatsAppAiService, useValue: aiService },
      ],
    }).compile();

    controller = module.get<WhatsAppController>(WhatsAppController);
  });

  it('verifies Meta webhook challenge', () => {
    const res = controller.verifyWebhook('subscribe', 'token', 'challenge_test');
    expect(res).toBe('mock_challenge_123');
    expect(webhookService.verifyWebhookChallenge).toHaveBeenCalledWith(
      'subscribe',
      'token',
      'challenge_test',
    );
  });

  it('handles incoming webhook events', async () => {
    const payload: any = { object: 'whatsapp_business_account', entry: [] };
    const req: any = { rawBody: Buffer.from(JSON.stringify(payload)) };
    const result = await controller.handleWebhook(payload, 'sha256=mock', req);

    expect(result.status).toBe('acknowledged');
    expect(webhookService.handleIncomingWebhook).toHaveBeenCalled();
  });

  it('routes connection management requests', async () => {
    const userId = 'user-1';
    await controller.getConnections(userId);
    expect(connectionService.getConnections).toHaveBeenCalledWith(userId);

    await controller.createConnection(userId, {
      businessAccountId: 'waba-1',
      phoneNumberId: 'phone-1',
      displayPhoneNumber: '+1 555-0100',
      displayName: 'Support',
      accessToken: 'token-1',
    });
    expect(connectionService.createConnection).toHaveBeenCalled();

    await controller.disconnectConnection(userId, 'conn-1');
    expect(connectionService.disconnectConnection).toHaveBeenCalledWith(userId, 'conn-1');
  });

  it('routes draft approval and send operations', async () => {
    const userId = 'user-1';

    await controller.createDraft(userId, {
      connectionId: 'conn-1',
      conversationId: 'conv-1',
      recipientPhone: '+1234567890',
      content: 'Draft message',
    });
    expect(draftService.createDraft).toHaveBeenCalled();

    await controller.approveDraft(userId, 'draft-1');
    expect(draftService.approveDraft).toHaveBeenCalledWith(userId, 'draft-1');

    await controller.sendDraft(userId, 'draft-1');
    expect(draftService.sendDraft).toHaveBeenCalledWith(userId, 'draft-1');
  });

  it('routes AI summary, reply suggestion, and Q&A operations', async () => {
    const userId = 'user-1';

    await controller.summarizeConversation(userId, 'conv-1');
    expect(aiService.summarizeConversation).toHaveBeenCalledWith(userId, 'conv-1');

    await controller.suggestReply(userId, 'conv-1', { tone: 'Professional' });
    expect(aiService.suggestReply).toHaveBeenCalledWith(userId, 'conv-1', {
      tone: 'Professional',
    });

    await controller.askWhatsApp(userId, { question: 'Any urgent items?' });
    expect(aiService.askWhatsApp).toHaveBeenCalledWith(userId, { question: 'Any urgent items?' });
  });

  it('routes stats request', async () => {
    const userId = 'user-1';
    const stats = await controller.getStats(userId);
    expect(stats.totalConnections).toBe(1);
    expect(conversationService.getStats).toHaveBeenCalledWith(userId);
  });
});
