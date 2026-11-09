import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '@bhuvi/database';
import { Queue, createDefaultQueue, enqueueProcessWhatsAppWebhook } from '@bhuvi/queue';
import { MetaWebhookPayload } from '@bhuvi/shared';

@Injectable()
export class WhatsAppWebhookService implements OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppWebhookService.name);
  private queue: Queue | null = null;

  constructor(private readonly prisma: PrismaService) {
    try {
      this.queue = createDefaultQueue();
    } catch (err: unknown) {
      this.logger.warn(`Failed to initialize BullMQ queue for webhooks: ${(err as Error).message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.queue) {
      await this.queue.close();
      this.queue = null;
    }
  }

  /**
   * Verifies the Meta Webhook setup challenge (GET /api/v1/whatsapp/webhook).
   * Official protocol: mode === 'subscribe', verify_token matches META_WEBHOOK_VERIFY_TOKEN.
   */
  verifyWebhookChallenge(mode?: string, verifyToken?: string, challenge?: string): string {
    const expectedToken =
      process.env['META_WEBHOOK_VERIFY_TOKEN'] || 'bhuvi_meta_webhook_dev_token_secret';

    if (mode === 'subscribe' && verifyToken === expectedToken) {
      this.logger.log('Meta webhook challenge successfully verified.');
      return challenge || '';
    }

    this.logger.warn('Meta webhook challenge verification failed: token or mode mismatch.');
    throw new UnauthorizedException('Invalid verification token or subscription mode.');
  }

  /**
   * Validates Meta X-Hub-Signature-256 against raw body buffer using constant-time comparison.
   */
  validateSignature(rawBody: Buffer | string, signatureHeader?: string): boolean {
    const appSecret =
      process.env['META_APP_SECRET'] || 'bhuvi_meta_dev_app_secret_test_key_32_chars';

    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
      this.logger.warn('Missing or malformed X-Hub-Signature-256 header.');
      return false;
    }

    const signature = signatureHeader.substring(7); // remove 'sha256=' prefix
    const bodyBuffer = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;

    const expectedHash = crypto.createHmac('sha256', appSecret).update(bodyBuffer).digest('hex');

    const signatureBuf = Buffer.from(signature, 'hex');
    const expectedBuf = Buffer.from(expectedHash, 'hex');

    if (signatureBuf.length !== expectedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(signatureBuf, expectedBuf);
  }

  /**
   * Processes incoming Meta webhook events (POST /api/v1/whatsapp/webhook).
   * Validates signature, deduplicates, records audit event, and dispatches to BullMQ.
   */
  async handleIncomingWebhook(
    payload: MetaWebhookPayload,
    rawBody: Buffer | string,
    signatureHeader?: string,
  ): Promise<{ status: string; eventCount: number }> {
    // 1. Signature Verification
    if (!this.validateSignature(rawBody, signatureHeader)) {
      throw new UnauthorizedException('Invalid Meta webhook signature (X-Hub-Signature-256).');
    }

    // 2. Payload Validation
    if (payload.object !== 'whatsapp_business_account' || !Array.isArray(payload.entry)) {
      throw new BadRequestException(
        'Unsupported webhook payload object; expected whatsapp_business_account.',
      );
    }

    let processedCount = 0;

    for (const entry of payload.entry) {
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field !== 'messages') continue;

        const val = change.value;
        const phoneNumberId = val?.metadata?.phone_number_id;

        // Find matching connection if registered in database
        let connection = null;
        if (phoneNumberId) {
          connection = await this.prisma.whatsAppConnection.findFirst({
            where: { phoneNumberId },
          });
        }

        // Deduplication and processing for incoming messages
        if (Array.isArray(val.messages)) {
          for (const msg of val.messages) {
            const eventId = msg.id; // wamid
            const existingEvent = await this.prisma.whatsAppWebhookEvent.findUnique({
              where: { eventId },
            });

            if (existingEvent) {
              this.logger.log(`Skipping duplicate webhook message event: ${eventId}`);
              continue;
            }

            // Persist webhook event
            await this.prisma.whatsAppWebhookEvent.create({
              data: {
                eventId,
                connectionId: connection?.id ?? null,
                eventType: 'messages',
                payload: msg as unknown as object,
                processingStatus: 'PENDING',
              },
            });

            // Enqueue asynchronous BullMQ processing
            if (this.queue) {
              await enqueueProcessWhatsAppWebhook(this.queue, {
                eventId,
                payload: {
                  ...msg,
                  phoneNumberId,
                  contacts: val.contacts,
                },
                connectionId: connection?.id,
              });
            }

            processedCount++;
          }
        }

        // Deduplication and processing for delivery / read status updates
        if (Array.isArray(val.statuses)) {
          for (const status of val.statuses) {
            const eventId = `status-${status.id}-${status.status}`;
            const existingEvent = await this.prisma.whatsAppWebhookEvent.findUnique({
              where: { eventId },
            });

            if (existingEvent) {
              continue;
            }

            await this.prisma.whatsAppWebhookEvent.create({
              data: {
                eventId,
                connectionId: connection?.id ?? null,
                eventType: 'message_status',
                payload: status as unknown as object,
                processingStatus: 'PENDING',
              },
            });

            if (this.queue) {
              await enqueueProcessWhatsAppWebhook(this.queue, {
                eventId,
                payload: {
                  ...status,
                  phoneNumberId,
                  isStatusUpdate: true,
                },
                connectionId: connection?.id,
              });
            }

            processedCount++;
          }
        }
      }
    }

    return { status: 'acknowledged', eventCount: processedCount };
  }
}
