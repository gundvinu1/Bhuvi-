import * as crypto from 'crypto';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { WhatsAppWebhookService } from './whatsapp-webhook.service';

describe('WhatsAppWebhookService (Signature, Deduplication & Challenge)', () => {
  let service: WhatsAppWebhookService;
  let mockPrisma: any;
  const mockSecret = 'test_meta_app_secret_32_characters_min';
  const mockVerifyToken = 'test_webhook_verify_token_123';

  beforeEach(() => {
    process.env['META_APP_SECRET'] = mockSecret;
    process.env['META_WEBHOOK_VERIFY_TOKEN'] = mockVerifyToken;

    mockPrisma = {
      whatsAppConnection: {
        findFirst: jest.fn(),
      },
      whatsAppWebhookEvent: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    service = new WhatsAppWebhookService(mockPrisma as any);
  });

  afterEach(() => {
    delete process.env['META_APP_SECRET'];
    delete process.env['META_WEBHOOK_VERIFY_TOKEN'];
  });

  describe('verifyWebhookChallenge (GET)', () => {
    it('returns challenge when mode and verify_token match', () => {
      const challenge = '1158201444';
      const result = service.verifyWebhookChallenge('subscribe', mockVerifyToken, challenge);
      expect(result).toBe(challenge);
    });

    it('rejects verification if token does not match', () => {
      expect(() =>
        service.verifyWebhookChallenge('subscribe', 'wrong_token', '1158201444'),
      ).toThrow(UnauthorizedException);
    });

    it('rejects verification if mode is not subscribe', () => {
      expect(() =>
        service.verifyWebhookChallenge('unsubscribe', mockVerifyToken, '1158201444'),
      ).toThrow(UnauthorizedException);
    });
  });

  describe('validateSignature & handleIncomingWebhook (POST)', () => {
    function createSignature(payloadString: string): string {
      const hash = crypto
        .createHmac('sha256', mockSecret)
        .update(Buffer.from(payloadString, 'utf8'))
        .digest('hex');
      return `sha256=${hash}`;
    }

    it('accepts and verifies valid Meta HMAC-SHA256 signature', async () => {
      const payload: any = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'waba-1',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '+1 555-0100',
                    phone_number_id: 'phone-1',
                  },
                  messages: [
                    {
                      id: 'wamid.HBg.valid.1',
                      from: '+1234567890',
                      timestamp: '1700000000',
                      type: 'text',
                      text: { body: 'Hello BHUVI' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const rawBody = JSON.stringify(payload);
      const signature = createSignature(rawBody);

      mockPrisma.whatsAppConnection.findFirst.mockResolvedValue({ id: 'conn-1' });
      mockPrisma.whatsAppWebhookEvent.findUnique.mockResolvedValue(null);
      mockPrisma.whatsAppWebhookEvent.create.mockResolvedValue({});

      const result = await service.handleIncomingWebhook(payload, rawBody, signature);

      expect(result.status).toBe('acknowledged');
      expect(result.eventCount).toBe(1);
      expect(mockPrisma.whatsAppWebhookEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventId: 'wamid.HBg.valid.1',
          eventType: 'messages',
          processingStatus: 'PENDING',
        }),
      });
    });

    it('rejects webhook with invalid or tampered signature', async () => {
      const payload: any = {
        object: 'whatsapp_business_account',
        entry: [],
      };
      const rawBody = JSON.stringify(payload);
      const fakeSignature =
        'sha256=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      await expect(service.handleIncomingWebhook(payload, rawBody, fakeSignature)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects webhook missing X-Hub-Signature-256 header', async () => {
      const payload: any = { object: 'whatsapp_business_account', entry: [] };
      const rawBody = JSON.stringify(payload);

      await expect(service.handleIncomingWebhook(payload, rawBody, undefined)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects malformed payload objects', async () => {
      const payload: any = { object: 'user', entry: [] };
      const rawBody = JSON.stringify(payload);
      const signature = createSignature(rawBody);

      await expect(service.handleIncomingWebhook(payload, rawBody, signature)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deduplicates incoming webhook events without creating duplicates', async () => {
      const payload: any = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'waba-1',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    phone_number_id: 'phone-1',
                  },
                  messages: [
                    {
                      id: 'wamid.HBg.duplicate.1',
                      from: '+1234567890',
                      timestamp: '1700000000',
                      type: 'text',
                      text: { body: 'Repeated webhook' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const rawBody = JSON.stringify(payload);
      const signature = createSignature(rawBody);

      // Event already recorded
      mockPrisma.whatsAppWebhookEvent.findUnique.mockResolvedValue({
        id: 'event-existing',
        eventId: 'wamid.HBg.duplicate.1',
      });

      const result = await service.handleIncomingWebhook(payload, rawBody, signature);

      expect(result.status).toBe('acknowledged');
      expect(result.eventCount).toBe(0);
      expect(mockPrisma.whatsAppWebhookEvent.create).not.toHaveBeenCalled();
    });
  });
});
