import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@bhuvi/database';
import { GmailDraftService } from './gmail-draft.service';
import { GmailOAuthService } from './gmail-oauth.service';

describe('GmailDraftService', () => {
  let service: GmailDraftService;
  let prisma: Partial<PrismaService>;
  let oauthService: Partial<GmailOAuthService>;

  beforeEach(() => {
    prisma = {
      gmailConnection: {
        findUnique: jest.fn(),
      } as any,
    };

    oauthService = {
      getAuthenticatedClient: jest.fn(),
    };

    service = new GmailDraftService(prisma as PrismaService, oauthService as GmailOAuthService);
  });

  describe('createRawMime', () => {
    it('should format RFC 2822 email message and base64url encode it', () => {
      const raw = service.createRawMime(
        'client@business.com',
        'Project Status Update',
        'Hello Client,\nEverything is on track for Q4 delivery.',
        'thread-12345',
      );

      expect(typeof raw).toBe('string');
      // Decode base64url to inspect headers and body
      const decoded = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(
        'utf-8',
      );
      expect(decoded).toContain('To: client@business.com');
      expect(decoded).toContain('Subject: =?utf-8?B?');
      expect(decoded).toContain('In-Reply-To: thread-12345');
      expect(decoded).toContain('Everything is on track for Q4 delivery.');
    });
  });

  describe('createDraft', () => {
    it('should reject invalid recipient email', async () => {
      await expect(
        service.createDraft('user-1', 'conn-1', {
          to: 'invalid-email',
          subject: 'Test',
          body: 'Hello',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject empty draft body', async () => {
      await expect(
        service.createDraft('user-1', 'conn-1', {
          to: 'valid@test.com',
          subject: 'Test',
          body: '   ',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if connection does not belong to user', async () => {
      (prisma.gmailConnection!.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createDraft('user-1', 'conn-nonexistent', {
          to: 'valid@test.com',
          subject: 'Test',
          body: 'Draft body text',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
