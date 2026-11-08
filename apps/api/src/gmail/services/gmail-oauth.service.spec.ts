import * as crypto from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '@bhuvi/database';
import { GmailOAuthService, DEFAULT_GMAIL_SCOPES } from './gmail-oauth.service';
import { TokenEncryptionService } from './token-encryption.service';

describe('GmailOAuthService', () => {
  let service: GmailOAuthService;
  let prisma: Partial<PrismaService>;
  let tokenEncryption: TokenEncryptionService;

  const originalClientId = process.env['GOOGLE_CLIENT_ID'];
  const originalClientSecret = process.env['GOOGLE_CLIENT_SECRET'];

  beforeEach(() => {
    process.env['GOOGLE_CLIENT_ID'] = 'mock-google-client-id.apps.googleusercontent.com';
    process.env['GOOGLE_CLIENT_SECRET'] = 'mock-google-client-secret-999';
    process.env['GMAIL_TOKEN_ENCRYPTION_KEY'] = 'test_encryption_key_for_oauth_service_32_bytes';
    process.env['JWT_SECRET'] = 'test_jwt_secret_for_state_hmac_32_bytes';

    prisma = {
      gmailConnection: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      } as any,
    };

    tokenEncryption = new TokenEncryptionService();
    service = new GmailOAuthService(prisma as PrismaService, tokenEncryption);
  });

  afterAll(() => {
    if (originalClientId) process.env['GOOGLE_CLIENT_ID'] = originalClientId;
    else delete process.env['GOOGLE_CLIENT_ID'];
    if (originalClientSecret) process.env['GOOGLE_CLIENT_SECRET'] = originalClientSecret;
    else delete process.env['GOOGLE_CLIENT_SECRET'];
  });

  describe('isConfigured', () => {
    it('should return true when client ID and secret are set', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('should return false when client ID is missing', () => {
      delete process.env['GOOGLE_CLIENT_ID'];
      expect(service.isConfigured()).toBe(false);
    });
  });

  describe('generateState & validateState', () => {
    it('should generate a valid signed state token and extract userId upon validation', () => {
      const userId = 'user-alice-123';
      const state = service.generateState(userId);

      expect(typeof state).toBe('string');
      const validation = service.validateState(state);
      expect(validation.valid).toBe(true);
      expect(validation.userId).toBe(userId);
    });

    it('should reject state with altered HMAC or tampered userId', () => {
      const state = service.generateState('user-alice-123');
      const decoded = Buffer.from(state, 'base64url').toString('utf-8');
      const parts = decoded.split(':');
      // Tamper with userId
      parts[0] = 'user-hacker-666';
      const tamperedState = Buffer.from(parts.join(':')).toString('base64url');

      const validation = service.validateState(tamperedState);
      expect(validation.valid).toBe(false);
    });

    it('should reject state that has expired (> 15 minutes old)', () => {
      const secret = process.env['JWT_SECRET'] || 'bhuvi_state_secret_key';
      const expiredTimestamp = (Date.now() - 20 * 60 * 1000).toString(); // 20 minutes ago
      const data = `user-123:${expiredTimestamp}:nonce123`;
      const hmac = crypto.createHmac('sha256', secret).update(data).digest('hex');
      const expiredState = Buffer.from(`${data}:${hmac}`).toString('base64url');

      const validation = service.validateState(expiredState);
      expect(validation.valid).toBe(false);
    });

    it('should reject completely malformed or empty state', () => {
      expect(service.validateState('').valid).toBe(false);
      expect(service.validateState('not_base64_encoded').valid).toBe(false);
    });
  });

  describe('getConnectUrl', () => {
    it('should generate Google OAuth URL with minimum scopes and access_type: offline', () => {
      const { url, state } = service.getConnectUrl('user-test-1');
      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url).toContain('access_type=offline');
      expect(url).toContain('prompt=consent');
      expect(url).toContain('state=');
      expect(state).toBeDefined();

      // Scopes check
      for (const scope of DEFAULT_GMAIL_SCOPES) {
        expect(url).toContain(encodeURIComponent(scope));
      }
    });

    it('should throw BadRequestException if Google credentials are not configured', () => {
      delete process.env['GOOGLE_CLIENT_ID'];
      expect(() => service.getConnectUrl('user-test-1')).toThrow(BadRequestException);
    });
  });

  describe('disconnect', () => {
    it('should mark connection DISCONNECTED and wipe tokens', async () => {
      (prisma.gmailConnection!.findUnique as jest.Mock).mockResolvedValue({
        id: 'conn-1',
        userId: 'user-1',
      });
      (prisma.gmailConnection!.findMany as jest.Mock).mockResolvedValue([
        { id: 'conn-1', userId: 'user-1' },
      ]);

      const res = await service.disconnect('user-1', 'conn-1');
      expect(res.disconnected).toBe(true);
      expect(prisma.gmailConnection!.update).toHaveBeenCalledWith({
        where: { id: 'conn-1' },
        data: {
          connectionStatus: 'DISCONNECTED',
          encryptedAccessToken: '',
          encryptedRefreshToken: null,
          tokenExpiresAt: null,
        },
      });
    });
  });
});
