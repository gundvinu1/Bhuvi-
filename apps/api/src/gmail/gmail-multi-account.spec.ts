import { NotFoundException } from '@nestjs/common';
import { google } from 'googleapis';
import { GmailOAuthService, DEFAULT_GMAIL_SCOPES } from './services/gmail-oauth.service';
import { GmailSyncService } from './services/gmail-sync.service';
import { GmailDraftService } from './services/gmail-draft.service';
import { GmailAiService } from './services/gmail-ai.service';
import { TokenEncryptionService } from './services/token-encryption.service';
import { EmailParserService } from './services/email-parser.service';
import { MessageIntelligenceService } from '../messages/services/message-intelligence.service';
import { PrismaService } from '@bhuvi/database';
import { OllamaProvider } from '../ai/ollama.provider';
import { SecretDetectorService } from '../memory/services/secret-detector.service';

describe('Module 09 Enhancement: Multi-Account Gmail Management Suite', () => {
  let oauthService: GmailOAuthService;
  let syncService: GmailSyncService;
  let draftService: GmailDraftService;
  let aiService: GmailAiService;
  let tokenEncryption: TokenEncryptionService;
  let emailParser: EmailParserService;
  let prisma: any;
  let mockOllama: any;
  let mockSecretDetector: any;
  let mockMessageIntelligence: any;

  // In-memory mock database state for multi-account testing
  let mockConnections: any[] = [];
  let mockMessages: any[] = [];
  let mockSyncStates: any[] = [];

  beforeEach(() => {
    process.env['GOOGLE_CLIENT_ID'] = 'mock-client-id-123.apps.googleusercontent.com';
    process.env['GOOGLE_CLIENT_SECRET'] = 'mock-client-secret-xyz';
    process.env['GMAIL_TOKEN_ENCRYPTION_KEY'] =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    process.env['JWT_SECRET'] = 'test_jwt_secret_for_multi_account_state';

    tokenEncryption = new TokenEncryptionService();
    emailParser = new EmailParserService();

    mockConnections = [];
    mockMessages = [];
    mockSyncStates = [];

    prisma = {
      gmailConnection: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id) {
            return Promise.resolve(mockConnections.find((c) => c.id === where.id) || null);
          }
          if (where.userId_googleAccountEmail) {
            return Promise.resolve(
              mockConnections.find(
                (c) =>
                  c.userId === where.userId_googleAccountEmail.userId &&
                  c.googleAccountEmail === where.userId_googleAccountEmail.googleAccountEmail,
              ) || null,
            );
          }
          return Promise.resolve(null);
        }),
        findFirst: jest.fn().mockImplementation(({ where }) => {
          return Promise.resolve(
            mockConnections.find(
              (c) =>
                c.userId === where.userId &&
                (!where.connectionStatus ||
                  (where.connectionStatus.in &&
                    where.connectionStatus.in.includes(c.connectionStatus)) ||
                  c.connectionStatus === where.connectionStatus),
            ) || null,
          );
        }),
        findMany: jest.fn().mockImplementation(({ where }) => {
          return Promise.resolve(
            mockConnections.filter((c) => {
              if (where?.userId && c.userId !== where.userId) return false;
              if (where?.id && c.id !== where.id) return false;
              if (
                where?.connectionStatus?.in &&
                !where.connectionStatus.in.includes(c.connectionStatus)
              )
                return false;
              return true;
            }),
          );
        }),
        upsert: jest.fn().mockImplementation(({ where, create, update }) => {
          const existingIdx = mockConnections.findIndex(
            (c) =>
              c.userId === where.userId_googleAccountEmail.userId &&
              c.googleAccountEmail === where.userId_googleAccountEmail.googleAccountEmail,
          );
          if (existingIdx >= 0) {
            mockConnections[existingIdx] = {
              ...mockConnections[existingIdx],
              ...update,
              updatedAt: new Date(),
            };
            return Promise.resolve(mockConnections[existingIdx]);
          } else {
            const newConn = {
              id: `conn-${mockConnections.length + 1}`,
              ...create,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            mockConnections.push(newConn);
            return Promise.resolve(newConn);
          }
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const idx = mockConnections.findIndex((c) => c.id === where.id);
          if (idx >= 0) {
            mockConnections[idx] = { ...mockConnections[idx], ...data, updatedAt: new Date() };
            return Promise.resolve(mockConnections[idx]);
          }
          return Promise.resolve(null);
        }),
      },
      gmailMessage: {
        findMany: jest.fn().mockImplementation(({ where }) => {
          let filtered = mockMessages.filter((m) => m.userId === where.userId);
          if (where.gmailConnectionId) {
            filtered = filtered.filter((m) => m.gmailConnectionId === where.gmailConnectionId);
          }
          if (where.isRead !== undefined) {
            filtered = filtered.filter((m) => m.isRead === where.isRead);
          }
          return Promise.resolve(
            filtered.map((m) => ({
              ...m,
              connection: mockConnections.find((c) => c.id === m.gmailConnectionId) || {
                googleAccountEmail: 'unknown@gmail.com',
              },
              attachments: [],
              message: null,
            })),
          );
        }),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          const found = mockMessages.find((m) => m.id === where.id);
          if (!found) return Promise.resolve(null);
          return Promise.resolve({
            ...found,
            connection: mockConnections.find((c) => c.id === found.gmailConnectionId) || {
              googleAccountEmail: 'unknown@gmail.com',
            },
            attachments: [],
            message: null,
          });
        }),
        count: jest.fn().mockImplementation(({ where }) => {
          let filtered = mockMessages.filter((m) => m.userId === where.userId);
          if (where.gmailConnectionId) {
            filtered = filtered.filter((m) => m.gmailConnectionId === where.gmailConnectionId);
          }
          if (where.isRead !== undefined) {
            filtered = filtered.filter((m) => m.isRead === where.isRead);
          }
          return Promise.resolve(filtered.length);
        }),
        create: jest.fn().mockImplementation(({ data }) => {
          const newMsg = { id: `msg-${mockMessages.length + 1}`, ...data, createdAt: new Date() };
          mockMessages.push(newMsg);
          return Promise.resolve(newMsg);
        }),
      },
      gmailSyncState: {
        create: jest.fn().mockImplementation(({ data }) => {
          const state = { id: `sync-${mockSyncStates.length + 1}`, ...data, createdAt: new Date() };
          mockSyncStates.push(state);
          return Promise.resolve(state);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const idx = mockSyncStates.findIndex((s) => s.id === where.id);
          if (idx >= 0) {
            mockSyncStates[idx] = { ...mockSyncStates[idx], ...data };
            return Promise.resolve(mockSyncStates[idx]);
          }
          return Promise.resolve(null);
        }),
        findFirst: jest
          .fn()
          .mockImplementation(() =>
            Promise.resolve(mockSyncStates[mockSyncStates.length - 1] || null),
          ),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(prisma);
      }),
    };

    mockOllama = {
      chat: jest.fn().mockResolvedValue({ content: 'Mocked multi-account AI response.' }),
    };

    mockSecretDetector = {
      redactSecrets: jest.fn((str) => str),
      containsSensitiveData: jest.fn().mockReturnValue(false),
    };

    mockMessageIntelligence = {
      analyzeAndStoreMessage: jest.fn().mockResolvedValue({
        category: 'WORK',
        priority: 'HIGH',
        urgency: 'TIME_SENSITIVE',
        summary: 'Analyzed message',
        requiresReply: true,
        requiresAction: false,
      }),
    };

    oauthService = new GmailOAuthService(prisma as PrismaService, tokenEncryption);
    syncService = new GmailSyncService(
      prisma as PrismaService,
      oauthService,
      emailParser,
      mockMessageIntelligence as MessageIntelligenceService,
    );
    draftService = new GmailDraftService(prisma as PrismaService, oauthService);
    aiService = new GmailAiService(
      prisma as PrismaService,
      mockOllama as OllamaProvider,
      mockSecretDetector as SecretDetectorService,
    );
  });

  describe('1. Multiple Gmail Connections per User', () => {
    it('should allow connecting two different Gmail accounts to one BHUVI user', async () => {
      // Mock OAuth2 client getProfile responses for account 1 & account 2
      const mockOAuth2Client = {
        getToken: jest.fn().mockResolvedValue({
          tokens: {
            access_token: 'access-token-1',
            refresh_token: 'refresh-token-1',
            expiry_date: Date.now() + 3600 * 1000,
            scope: DEFAULT_GMAIL_SCOPES.join(' '),
          },
        }),
        setCredentials: jest.fn(),
      };

      jest.spyOn(oauthService, 'getOAuth2Client').mockReturnValue(mockOAuth2Client as any);

      // Account 1: Personal Gmail
      const state1 = oauthService.generateState('user-alice-1');
      const getProfileSpy = jest
        .fn()
        .mockResolvedValueOnce({ data: { emailAddress: 'alice.personal@gmail.com' } })
        .mockResolvedValueOnce({ data: { emailAddress: 'alice.college@university.edu' } });

      jest.spyOn(google, 'gmail').mockReturnValue({
        users: { getProfile: getProfileSpy },
      } as any);

      const res1 = await oauthService.handleCallback('code-1', state1);
      expect(res1.email).toBe('alice.personal@gmail.com');
      expect(mockConnections.length).toBe(1);

      // Account 2: College Gmail
      const state2 = oauthService.generateState('user-alice-1');
      const res2 = await oauthService.handleCallback('code-2', state2);
      expect(res2.email).toBe('alice.college@university.edu');
      expect(mockConnections.length).toBe(2);

      // Verify both connections exist independently under user-alice-1
      const connections = await oauthService.getConnections('user-alice-1');
      expect(connections.length).toBe(2);
      expect(connections.map((c) => c.googleAccountEmail)).toContain('alice.personal@gmail.com');
      expect(connections.map((c) => c.googleAccountEmail)).toContain(
        'alice.college@university.edu',
      );
    });

    it('should support connecting three or more Gmail accounts without conflict', async () => {
      const mockOAuth2Client = {
        getToken: jest.fn().mockResolvedValue({
          tokens: {
            access_token: 'token-xyz',
            refresh_token: 'refresh-xyz',
            expiry_date: Date.now() + 3600 * 1000,
          },
        }),
        setCredentials: jest.fn(),
      };
      jest.spyOn(oauthService, 'getOAuth2Client').mockReturnValue(mockOAuth2Client as any);

      const accounts = ['personal@gmail.com', 'work@company.com', 'research@lab.org'];

      for (let i = 0; i < accounts.length; i++) {
        const state = oauthService.generateState('user-multi-1');
        jest.spyOn(google, 'gmail').mockReturnValue({
          users: {
            getProfile: jest.fn().mockResolvedValue({ data: { emailAddress: accounts[i] } }),
          },
        } as any);
        await oauthService.handleCallback(`code-${i}`, state);
      }

      const allConnections = await oauthService.getConnections('user-multi-1');
      expect(allConnections.length).toBe(3);
      expect(allConnections.map((c) => c.googleAccountEmail)).toEqual(
        expect.arrayContaining(['research@lab.org', 'work@company.com', 'personal@gmail.com']),
      );
    });

    it('should prevent duplicate connections: re-authenticating same account updates tokens rather than duplicating', async () => {
      const mockOAuth2Client = {
        getToken: jest.fn().mockResolvedValue({
          tokens: { access_token: 'initial-access-token', refresh_token: 'initial-refresh-token' },
        }),
        setCredentials: jest.fn(),
      };
      jest.spyOn(oauthService, 'getOAuth2Client').mockReturnValue(mockOAuth2Client as any);

      const state1 = oauthService.generateState('user-alice-1');
      jest.spyOn(google, 'gmail').mockReturnValue({
        users: {
          getProfile: jest
            .fn()
            .mockResolvedValue({ data: { emailAddress: 'alice.work@corp.com' } }),
        },
      } as any);

      const res1 = await oauthService.handleCallback('code-initial', state1);
      expect(mockConnections.length).toBe(1);
      expect(res1.connectionId).toBe('conn-1');

      // Now re-authenticate the same email with new tokens
      mockOAuth2Client.getToken.mockResolvedValueOnce({
        tokens: {
          access_token: 'refreshed-access-token-new',
          refresh_token: 'refreshed-refresh-token-new',
        },
      });

      const state2 = oauthService.generateState('user-alice-1');
      const res2 = await oauthService.handleCallback('code-reauth', state2);

      // Must update existing connection, NOT create a second duplicate row
      expect(mockConnections.length).toBe(1);
      expect(res2.connectionId).toBe('conn-1');
      expect(mockConnections[0].connectionStatus).toBe('CONNECTED');
    });
  });

  describe('2. OAuth State Security & Replay Attack Prevention', () => {
    it('should enforce one-time state consumption and reject replayed OAuth states', async () => {
      const state = oauthService.generateState('user-bob-1');

      // First validation and consumption succeeds
      const firstCheck = await oauthService.validateState(state, true);
      expect(firstCheck.valid).toBe(true);
      expect(firstCheck.userId).toBe('user-bob-1');

      // Second validation with the exact same state MUST be rejected (replay attack defense)
      const secondCheck = await oauthService.validateState(state, true);
      expect(secondCheck.valid).toBe(false);
    });

    it('should reject tampered or cross-user state HMACs', async () => {
      const state = oauthService.generateState('user-legit-1');
      const rawDecoded = Buffer.from(state, 'base64url').toString('utf-8');
      const parts = rawDecoded.split(':');
      // Maliciously tamper userId in payload
      parts[0] = 'user-attacker-666';

      const tamperedState = Buffer.from(parts.join(':')).toString('base64url');
      const check = await oauthService.validateState(tamperedState);
      expect(check.valid).toBe(false);
    });

    it('should atomically reject concurrent replay attempts', async () => {
      const state = oauthService.generateState('user-concurrent-test');
      const [r1, r2] = await Promise.all([
        oauthService.validateState(state, true),
        oauthService.validateState(state, true),
      ]);
      const successes = [r1.valid, r2.valid].filter(Boolean).length;
      expect(successes).toBe(1);
    });

    it('should reject replay across separate API instances sharing Redis (multi-instance/restart)', async () => {
      const state = oauthService.generateState('user-multi-inst-1');
      const first = await oauthService.validateState(state, true);
      expect(first.valid).toBe(true);

      const secondService = new GmailOAuthService(prisma as PrismaService, tokenEncryption);
      try {
        const replay = await secondService.validateState(state, true);
        expect(replay.valid).toBe(false);
      } finally {
        await secondService.onModuleDestroy();
      }
    });
  });

  describe('3. Independent Disconnection and Cross-User Isolation', () => {
    beforeEach(() => {
      // Seed two connections for User A and one connection for User B
      mockConnections.push(
        {
          id: 'conn-userA-personal',
          userId: 'user-A',
          googleAccountEmail: 'usera.personal@gmail.com',
          encryptedAccessToken: tokenEncryption.encrypt('token-a1'),
          encryptedRefreshToken: tokenEncryption.encrypt('refresh-a1'),
          connectionStatus: 'CONNECTED',
        },
        {
          id: 'conn-userA-work',
          userId: 'user-A',
          googleAccountEmail: 'usera.work@enterprise.com',
          encryptedAccessToken: tokenEncryption.encrypt('token-a2'),
          encryptedRefreshToken: tokenEncryption.encrypt('refresh-a2'),
          connectionStatus: 'CONNECTED',
        },
        {
          id: 'conn-userB-personal',
          userId: 'user-B',
          googleAccountEmail: 'userb.secret@gmail.com',
          encryptedAccessToken: tokenEncryption.encrypt('token-b1'),
          encryptedRefreshToken: tokenEncryption.encrypt('refresh-b1'),
          connectionStatus: 'CONNECTED',
        },
      );
    });

    it('should disconnect only the targeted account and retain all other accounts intact', async () => {
      const res = await oauthService.disconnect('user-A', 'conn-userA-personal');
      expect(res.disconnected).toBe(true);

      const connPersonal = mockConnections.find((c) => c.id === 'conn-userA-personal');
      const connWork = mockConnections.find((c) => c.id === 'conn-userA-work');

      // Targeted personal connection is disconnected and tokens wiped
      expect(connPersonal.connectionStatus).toBe('DISCONNECTED');
      expect(connPersonal.encryptedAccessToken).toBe('');

      // Work connection remains fully connected and active
      expect(connWork.connectionStatus).toBe('CONNECTED');
      expect(connWork.encryptedAccessToken).not.toBe('');
    });

    it('should strictly reject accessing or disconnecting another user’s Gmail connection', async () => {
      // User A attempts to disconnect User B's connection
      await expect(oauthService.disconnect('user-A', 'conn-userB-personal')).rejects.toThrow(
        NotFoundException,
      );

      // User A attempts to get User B's connection details
      await expect(oauthService.getConnection('user-A', 'conn-userB-personal')).rejects.toThrow(
        NotFoundException,
      );

      // User A attempts to acquire authenticated client for User B's connection
      await expect(
        oauthService.getAuthenticatedClient('conn-userB-personal', 'user-A'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('4. Multi-Account Unified Inbox & Filtering', () => {
    beforeEach(() => {
      mockConnections.push(
        {
          id: 'conn-1',
          userId: 'user-1',
          googleAccountEmail: 'alice.personal@gmail.com',
          connectionStatus: 'CONNECTED',
        },
        {
          id: 'conn-2',
          userId: 'user-1',
          googleAccountEmail: 'alice.work@corp.com',
          connectionStatus: 'CONNECTED',
        },
      );

      mockMessages.push(
        {
          id: 'msg-p1',
          userId: 'user-1',
          gmailConnectionId: 'conn-1',
          providerMessageId: 'pmsg-1',
          providerThreadId: 'pthread-1',
          senderEmail: 'mom@family.org',
          subject: 'Sunday Dinner',
          bodyText: 'Are you coming over on Sunday?',
          receivedAt: new Date('2026-11-08T07:00:00Z'),
          createdAt: new Date('2026-11-08T07:00:00Z'),
          updatedAt: new Date('2026-11-08T07:00:00Z'),
          isRead: false,
          labels: ['INBOX'],
          syncStatus: 'SYNCHRONIZED',
        },
        {
          id: 'msg-w1',
          userId: 'user-1',
          gmailConnectionId: 'conn-2',
          providerMessageId: 'pmsg-2',
          providerThreadId: 'pthread-2',
          senderEmail: 'boss@corp.com',
          subject: 'Quarterly Review & Budget',
          bodyText: 'Please review the Q4 financial projections.',
          receivedAt: new Date('2026-11-08T08:00:00Z'),
          createdAt: new Date('2026-11-08T08:00:00Z'),
          updatedAt: new Date('2026-11-08T08:00:00Z'),
          isRead: true,
          labels: ['INBOX'],
          syncStatus: 'SYNCHRONIZED',
        },
      );
    });

    it('should return unified inbox combining messages across all connected accounts by default', async () => {
      const res = await syncService.getMessages('user-1', {});
      expect(res.messages.length).toBe(2);
      expect(res.total).toBe(2);

      // Verify each message has its receiving account email populated
      const personalMsg = res.messages.find((m) => m.id === 'msg-p1');
      const workMsg = res.messages.find((m) => m.id === 'msg-w1');
      expect(personalMsg?.accountEmail).toBe('alice.personal@gmail.com');
      expect(workMsg?.accountEmail).toBe('alice.work@corp.com');
    });

    it('should filter messages strictly by connectionId when account filter is selected', async () => {
      const resWork = await syncService.getMessages('user-1', { connectionId: 'conn-2' });
      expect(resWork.messages.length).toBe(1);
      expect(resWork.messages[0].id).toBe('msg-w1');
      expect(resWork.messages[0].accountEmail).toBe('alice.work@corp.com');

      const resPersonal = await syncService.getMessages('user-1', { connectionId: 'conn-1' });
      expect(resPersonal.messages.length).toBe(1);
      expect(resPersonal.messages[0].id).toBe('msg-p1');
      expect(resPersonal.messages[0].accountEmail).toBe('alice.personal@gmail.com');
    });

    it('should compute aggregated statistics and per-account breakdown', async () => {
      const stats = await syncService.getSyncStats('user-1');
      expect(stats.totalEmails).toBe(2);
      expect(stats.unreadEmails).toBe(1);
      expect(stats.accounts).toBeDefined();
      expect(stats.accounts?.length).toBe(2);

      const personalStat = stats.accounts?.find((a) => a.connectionId === 'conn-1');
      const workStat = stats.accounts?.find((a) => a.connectionId === 'conn-2');
      expect(personalStat?.googleAccountEmail).toBe('alice.personal@gmail.com');
      expect(workStat?.googleAccountEmail).toBe('alice.work@corp.com');
    });
  });

  describe('5. Safe Draft Creation in the Exact Source Account', () => {
    beforeEach(() => {
      mockConnections.push(
        {
          id: 'conn-personal',
          userId: 'user-1',
          googleAccountEmail: 'alice.personal@gmail.com',
          encryptedAccessToken: tokenEncryption.encrypt('token-p'),
          connectionStatus: 'CONNECTED',
        },
        {
          id: 'conn-work',
          userId: 'user-1',
          googleAccountEmail: 'alice.work@corp.com',
          encryptedAccessToken: tokenEncryption.encrypt('token-w'),
          connectionStatus: 'CONNECTED',
        },
      );
    });

    it('should create draft in the exact Gmail account associated with connectionId', async () => {
      const createDraftSpy = jest.fn().mockResolvedValue({
        data: { id: 'draft-999', message: { id: 'msg-draft-1', threadId: 'thread-work-1' } },
      });

      jest.spyOn(oauthService, 'getAuthenticatedClient').mockResolvedValue({} as any);
      jest.spyOn(google, 'gmail').mockReturnValue({
        users: { drafts: { create: createDraftSpy } },
      } as any);

      const res = await draftService.createDraft('user-1', 'conn-work', {
        to: 'client@partner.com',
        subject: 'Re: Statement of Work',
        body: 'Here is the draft proposal.',
        threadId: 'thread-work-1',
      });

      expect(res.draftId).toBe('draft-999');
      expect(res.accountEmail).toBe('alice.work@corp.com');
      expect(res.connectionId).toBe('conn-work');
      expect(createDraftSpy).toHaveBeenCalled();
    });

    it('should reject draft creation if connectionId belongs to another user', async () => {
      await expect(
        draftService.createDraft('user-other-hacker', 'conn-work', {
          to: 'someone@domain.com',
          subject: 'Unauthorized draft',
          body: 'Content',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('6. Redis Distributed Synchronization Locking', () => {
    it('should acquire and release distributed lock per connection', async () => {
      const lockVal = 'lock-token-abc';
      const acquired = await syncService.acquireSyncLock('conn-1', lockVal, 60);
      expect(acquired).toBe(true);

      // Releasing lock completes cleanly
      await expect(syncService.releaseSyncLock('conn-1', lockVal)).resolves.not.toThrow();
    });
  });

  describe('7. Multi-Account AI Intelligence & Grounded Q&A', () => {
    beforeEach(() => {
      mockConnections.push(
        {
          id: 'conn-college',
          userId: 'user-1',
          googleAccountEmail: 'student@mit.edu',
          connectionStatus: 'CONNECTED',
        },
        {
          id: 'conn-work',
          userId: 'user-1',
          googleAccountEmail: 'eng@startup.io',
          connectionStatus: 'CONNECTED',
        },
      );

      mockMessages.push(
        {
          id: 'msg-c1',
          userId: 'user-1',
          gmailConnectionId: 'conn-college',
          senderEmail: 'registrar@mit.edu',
          subject: 'Spring Registration Confirmation',
          bodyText: 'Your classes for Spring 2027 are officially registered.',
          receivedAt: new Date(),
        },
        {
          id: 'msg-w1',
          userId: 'user-1',
          gmailConnectionId: 'conn-work',
          senderEmail: 'cto@startup.io',
          subject: 'Production Deployment',
          bodyText: 'Production deployment is scheduled for tonight at 10 PM.',
          receivedAt: new Date(),
        },
      );
    });

    it('should ground answers across all connected accounts when no connectionId is specified', async () => {
      const res = await aiService.askAboutEmails('user-1', 'What are my latest updates?');
      expect(res.answer).toBe('Mocked multi-account AI response.');
      expect(mockOllama.chat).toHaveBeenCalled();

      // Check prompt includes untrusted email content tags with receiving accounts
      const chatArgs = mockOllama.chat.mock.calls[0][0];
      const userMessage = chatArgs.find((m: any) => m.role === 'user').content;
      expect(userMessage).toContain('account="student@mit.edu"');
      expect(userMessage).toContain('account="eng@startup.io"');
    });

    it('should filter context strictly to the selected account when connectionId is provided', async () => {
      mockOllama.chat.mockClear();
      await aiService.askAboutEmails('user-1', 'When is the deployment?', 'conn-work');

      const chatArgs = mockOllama.chat.mock.calls[0][0];
      const userMessage = chatArgs.find((m: any) => m.role === 'user').content;
      expect(userMessage).toContain('account="eng@startup.io"');
      expect(userMessage).not.toContain('account="student@mit.edu"');
    });
  });

  afterEach(async () => {
    if (syncService) {
      await syncService.onModuleDestroy();
    }
    if (oauthService) {
      await oauthService.onModuleDestroy();
    }
  });
});
