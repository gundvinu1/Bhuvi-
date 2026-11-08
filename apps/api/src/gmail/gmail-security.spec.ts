import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '@bhuvi/database';
import { GmailSyncService } from './services/gmail-sync.service';
import { GmailOAuthService } from './services/gmail-oauth.service';
import { EmailParserService } from './services/email-parser.service';
import { MessageIntelligenceService } from '../messages/services/message-intelligence.service';

describe('Module 09: Gmail Security & Multi-Tenant Isolation Suite', () => {
  let prisma: Partial<PrismaService>;
  let syncService: GmailSyncService;
  let oauthService: Partial<GmailOAuthService>;
  let emailParser: EmailParserService;
  let messageIntelligence: Partial<MessageIntelligenceService>;

  const userAlice = 'user-alice-1111';
  const userBob = 'user-bob-2222';

  beforeEach(() => {
    prisma = {
      gmailMessage: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      } as any,
      gmailConnection: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      } as any,
      gmailSyncState: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
      } as any,
    };

    oauthService = {
      getAuthenticatedClient: jest.fn(),
    };

    emailParser = new EmailParserService();
    messageIntelligence = {
      analyzeAndStoreMessage: jest.fn(),
    };

    syncService = new GmailSyncService(
      prisma as PrismaService,
      oauthService as GmailOAuthService,
      emailParser,
      messageIntelligence as MessageIntelligenceService,
    );
  });

  describe('1. Cross-User Isolation Enforcement', () => {
    it('should block User Bob from reading User Alice email by ID', async () => {
      // Alice owns the email
      (prisma.gmailMessage!.findUnique as jest.Mock).mockResolvedValue({
        id: 'email-alice-777',
        userId: userAlice,
        subject: 'Confidential Medical Report',
        bodyText: 'Medical lab test results.',
      });

      // Bob attempts to read it
      await expect(syncService.getMessageById(userBob, 'email-alice-777')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should scope message list queries strictly to the requesting user', async () => {
      (prisma.gmailMessage!.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.gmailMessage!.count as jest.Mock).mockResolvedValue(0);

      await syncService.getMessages(userBob, {});

      expect(prisma.gmailMessage!.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: userBob }),
        }),
      );
      expect(prisma.gmailMessage!.count).toHaveBeenCalledWith({
        where: expect.objectContaining({ userId: userBob }),
      });
    });

    it('should scope conversation threads strictly to the requesting user', async () => {
      (prisma.gmailMessage!.findMany as jest.Mock).mockResolvedValue([]);

      await syncService.getThread(userBob, 'thread-999');

      expect(prisma.gmailMessage!.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: userBob,
            providerThreadId: 'thread-999',
          },
        }),
      );
    });

    it('should scope inbox sync statistics strictly to the requesting user', async () => {
      (prisma.gmailMessage!.count as jest.Mock).mockResolvedValue(0);
      (prisma.gmailConnection!.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.gmailSyncState!.findFirst as jest.Mock).mockResolvedValue(null);

      await syncService.getSyncStats(userBob);

      expect(prisma.gmailMessage!.count).toHaveBeenCalledWith({
        where: { userId: userBob },
      });
    });
  });

  describe('2. Malicious Content & Attachment Filename Sanitization', () => {
    it('should neutralize directory traversal and null byte injections in attachment filenames', () => {
      const maliciousPart = {
        mimeType: 'application/octet-stream',
        filename: '..\\..\\..\\Windows\\System32\\cmd.exe\0.pdf',
        body: {
          attachmentId: 'att-evil-1',
          size: 1024,
        },
      };

      const { attachments } = emailParser.extractMimeParts(maliciousPart as any);

      expect(attachments).toHaveLength(1);
      const att = attachments[0]!;
      expect(att.filename).not.toContain('\\');
      expect(att.filename).not.toContain('/');
      expect(att.filename).not.toContain('\0');
    });

    it('should truncate oversized message content exceeding 100,000 characters', () => {
      const hugeText = 'A'.repeat(120000);
      const encoded = Buffer.from(hugeText, 'utf-8').toString('base64url');

      const mockMsg = {
        id: 'msg-huge',
        payload: {
          mimeType: 'text/plain',
          body: { data: encoded },
        },
      };

      const parsed = emailParser.parseMessage(mockMsg as any);
      expect(parsed.bodyText.length).toBeLessThanOrEqual(100100);
      expect(parsed.bodyText).toContain('[Content truncated at 100,000 characters]');
    });
  });
});
