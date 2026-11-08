import { Test, TestingModule } from '@nestjs/testing';
import { GmailController } from './gmail.controller';
import { PrismaService } from '@bhuvi/database';
import { GmailOAuthService } from './services/gmail-oauth.service';
import { GmailSyncService } from './services/gmail-sync.service';
import { GmailAiService } from './services/gmail-ai.service';
import { GmailDraftService } from './services/gmail-draft.service';
import { MessageIntelligenceService } from '../messages/services/message-intelligence.service';

describe('GmailController', () => {
  let controller: GmailController;
  let prisma: Partial<PrismaService>;
  let oauthService: Partial<GmailOAuthService>;
  let syncService: Partial<GmailSyncService>;
  let aiService: Partial<GmailAiService>;
  let draftService: Partial<GmailDraftService>;
  let messageIntelligence: Partial<MessageIntelligenceService>;

  beforeEach(async () => {
    prisma = {
      gmailConnection: {
        findFirst: jest.fn(),
      } as any,
    };

    oauthService = {
      getConnectUrl: jest
        .fn()
        .mockReturnValue({ url: 'https://accounts.google.com/auth', state: 'mock-state' }),
      disconnect: jest.fn().mockResolvedValue({ disconnected: true }),
      validateState: jest.fn().mockReturnValue({ valid: true, userId: 'user-1' }),
    };

    syncService = {
      syncInbox: jest.fn().mockResolvedValue({ syncedCount: 5 }),
      getMessages: jest
        .fn()
        .mockResolvedValue({ messages: [], total: 0, page: 1, limit: 20, totalPages: 1 }),
      getMessageById: jest.fn(),
      getSyncStats: jest.fn().mockResolvedValue({
        totalEmails: 10,
        unreadEmails: 2,
        importantEmails: 1,
        requiresReplyCount: 1,
        requiresActionCount: 1,
        lastSyncedAt: new Date().toISOString(),
        syncStatus: 'SUCCESS',
      }),
    };

    aiService = {
      summarizeEmail: jest.fn(),
      suggestReply: jest.fn(),
      askAboutEmails: jest.fn(),
    };

    draftService = {
      createDraft: jest.fn(),
    };

    messageIntelligence = {
      analyzeAndStoreMessage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GmailController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: GmailOAuthService, useValue: oauthService },
        { provide: GmailSyncService, useValue: syncService },
        { provide: GmailAiService, useValue: aiService },
        { provide: GmailDraftService, useValue: draftService },
        { provide: MessageIntelligenceService, useValue: messageIntelligence },
      ],
    }).compile();

    controller = module.get<GmailController>(GmailController);
  });

  describe('getConnection', () => {
    it('should return connection metadata without exposing tokens', async () => {
      (prisma.gmailConnection!.findFirst as jest.Mock).mockResolvedValue({
        id: 'conn-1',
        userId: 'user-1',
        googleAccountEmail: 'alice@gmail.com',
        googleAccountId: 'g-123',
        encryptedAccessToken: 'iv:tag:cipher_secret_never_expose',
        encryptedRefreshToken: 'iv:tag:cipher_refresh_never_expose',
        connectionStatus: 'CONNECTED',
        scopes: ['openid', 'email'],
        lastSyncedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await controller.getConnection({ id: 'user-1' });

      expect(res).toBeDefined();
      expect(res!.id).toBe('conn-1');
      expect(res!.googleAccountEmail).toBe('alice@gmail.com');
      expect(res!.connectionStatus).toBe('CONNECTED');
      // Verify no tokens are returned in DTO
      expect((res as any).encryptedAccessToken).toBeUndefined();
      expect((res as any).encryptedRefreshToken).toBeUndefined();
    });

    it('should return null when user has no connected account', async () => {
      (prisma.gmailConnection!.findFirst as jest.Mock).mockResolvedValue(null);
      const res = await controller.getConnection({ id: 'user-1' });
      expect(res).toBeNull();
    });
  });

  describe('getConnectUrl', () => {
    it('should return Google OAuth authorization URL and state', () => {
      const res = controller.getConnectUrl({ id: 'user-1' });
      expect(res.url).toContain('https://accounts.google.com');
      expect(res.state).toBe('mock-state');
    });
  });

  describe('disconnect', () => {
    it('should call oauthService.disconnect', async () => {
      const res = await controller.disconnect({ id: 'user-1' });
      expect(res.disconnected).toBe(true);
      expect(oauthService.disconnect).toHaveBeenCalledWith('user-1');
    });
  });

  describe('syncInbox', () => {
    it('should invoke syncService with requested limit', async () => {
      const res = await controller.syncInbox({ id: 'user-1' }, '25');
      expect(res.syncedCount).toBe(5);
      expect(syncService.syncInbox).toHaveBeenCalledWith('user-1', undefined, 25);
    });
  });
});
