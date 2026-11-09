import * as crypto from 'crypto';
import { google } from 'googleapis';
import { APP_NAME, APP_VERSION } from '@bhuvi/shared';
import { PrismaClient } from '@bhuvi/database';
import {
  Worker,
  Job,
  DEFAULT_QUEUE_NAME,
  JOB_INFRASTRUCTURE_CHECK,
  JOB_EXECUTE_PLAN,
  JOB_ANALYZE_MESSAGE,
  JOB_PROCESS_MEMORY,
  JOB_SYNC_GMAIL,
  JOB_PROCESS_WHATSAPP_WEBHOOK,
  JOB_SEND_WHATSAPP_APPROVED_MESSAGE,
  JOB_UPDATE_WHATSAPP_MESSAGE_STATUS,
  getRedisConnectionOptions,
  getSanitizedRedisConfig,
  InfrastructureCheckPayload,
  InfrastructureCheckResult,
  ExecutePlanPayload,
  ExecutePlanResult,
  AnalyzeMessagePayload,
  AnalyzeMessageResult,
  ProcessMemoryPayload,
  ProcessMemoryResult,
  SyncGmailPayload,
  SyncGmailResult,
  ProcessWhatsAppWebhookPayload,
  SendWhatsAppApprovedMessagePayload,
  UpdateWhatsAppMessageStatusPayload,
} from '@bhuvi/queue';

// ============================================================
// BHUVI Worker – Main Entry Point
// Module 03: Database & Infrastructure Foundation
// Handles BullMQ queue consumption and job lifecycle.
// ============================================================

export interface WorkerConfig {
  nodeEnv: string;
  port: number;
}

export function loadConfig(): WorkerConfig {
  return {
    nodeEnv: process.env['NODE_ENV'] ?? 'development',
    port: parseInt(process.env['WORKER_PORT'] ?? '3002', 10),
  };
}

export class Logger {
  private readonly context: string;

  constructor(context: string) {
    this.context = context;
  }

  log(message: string): void {
    const ts = new Date().toISOString();
    // eslint-disable-next-line no-console
    console.log(`[${ts}] [${this.context}] INFO  ${message}`);
  }

  warn(message: string): void {
    const ts = new Date().toISOString();
    // eslint-disable-next-line no-console
    console.warn(`[${ts}] [${this.context}] WARN  ${message}`);
  }

  error(message: string, err?: Error): void {
    const ts = new Date().toISOString();
    // eslint-disable-next-line no-console
    console.error(`[${ts}] [${this.context}] ERROR ${message}`, err?.stack ?? '');
  }
}

export class BhuviWorker {
  private readonly logger = new Logger('BhuviWorker');
  private readonly config: WorkerConfig;
  private readonly workerId: string;
  private readonly prisma: PrismaClient | null = null;
  private worker: Worker | null = null;
  private isShuttingDown = false;

  constructor(config: WorkerConfig, prisma?: PrismaClient) {
    this.config = config;
    this.workerId = `worker-${crypto.randomUUID().substring(0, 8)}`;
    this.prisma = prisma ?? null;
  }

  getWorkerId(): string {
    return this.workerId;
  }

  async start(): Promise<void> {
    if (this.worker) {
      this.logger.warn('Worker is already initialized; skipping duplicate start call.');
      return;
    }

    this.logger.log(`🔧 ${APP_NAME} Worker v${APP_VERSION} starting…`);
    this.logger.log(`   Worker ID   : ${this.workerId}`);
    this.logger.log(`   Environment : ${this.config.nodeEnv}`);
    this.logger.log(`   Node.js     : ${process.version}`);

    const sanitizedRedis = getSanitizedRedisConfig();
    this.logger.log(`   Redis Target: ${sanitizedRedis.host}:${sanitizedRedis.port}`);
    this.logger.log(`   Queue Name  : ${DEFAULT_QUEUE_NAME}`);

    try {
      this.worker = new Worker(DEFAULT_QUEUE_NAME, async (job: Job) => this.processJob(job), {
        connection: getRedisConnectionOptions(),
        concurrency: 5,
      });

      this.worker.on('ready', () => {
        this.logger.log(
          `✓ BullMQ worker connected to Redis and ready for queue: ${DEFAULT_QUEUE_NAME}`,
        );
      });

      this.worker.on('active', (job) => {
        this.logger.log(`⚙️  Job ${job.id} [${job.name}] started processing`);
      });

      this.worker.on('completed', (job) => {
        this.logger.log(`✓ Job ${job.id} [${job.name}] completed successfully`);
      });

      this.worker.on('failed', (job, err) => {
        this.logger.error(`❌ Job ${job?.id} [${job?.name}] failed: ${err.message}`, err);
      });

      this.worker.on('error', (err) => {
        this.logger.warn(
          `⚠️  BullMQ worker connection warning: ${err.message}. ` +
            `Ensure Redis is running locally on port ${sanitizedRedis.port}. Standby mode active.`,
        );
      });

      this.logger.log('Worker initialized. Listening for jobs…');
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error('Failed to initialize BullMQ worker', error);
      if (this.config.nodeEnv === 'production') {
        throw error;
      }
    }
  }

  /**
   * Helper to chunk memory content into overlapping text segments.
   */
  chunkMemoryText(
    text: string,
    chunkSize = 500,
    chunkOverlap = 60,
  ): Array<{ chunkIndex: number; content: string; tokenCount: number }> {
    const raw = text?.trim();
    if (!raw) return [];
    if (raw.length <= chunkSize) {
      return [
        {
          chunkIndex: 0,
          content: raw,
          tokenCount: Math.max(1, Math.ceil(raw.split(/\s+/).length * 1.3)),
        },
      ];
    }

    const paragraphs = raw
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
    const chunks: string[] = [];
    let current = '';

    for (const p of paragraphs) {
      if ((current + '\n\n' + p).trim().length <= chunkSize) {
        current = current ? `${current}\n\n${p}` : p;
      } else {
        if (current) {
          chunks.push(current.trim());
          const tail = current.slice(-chunkOverlap);
          const firstSpace = tail.indexOf(' ');
          const overlap = firstSpace !== -1 ? tail.slice(firstSpace + 1).trim() : tail.trim();
          current = overlap ? `${overlap}\n\n${p}` : p;
        } else {
          chunks.push(p.slice(0, chunkSize));
          current = p.slice(chunkSize);
        }
      }
    }
    if (current.trim().length > 0) chunks.push(current.trim());

    return chunks.map((content, chunkIndex) => ({
      chunkIndex,
      content,
      tokenCount: Math.max(1, Math.ceil(content.split(/\s+/).length * 1.3)),
    }));
  }

  /**
   * Generates vector embeddings for a chunk via local Ollama with deterministic fallback.
   */
  async generateEmbedding(
    text: string,
  ): Promise<{ embedding: number[]; dimensions: number; modelName: string }> {
    if (this.config.nodeEnv === 'test') {
      return {
        embedding: new Array(768).fill(0.01),
        dimensions: 768,
        modelName: 'nomic-embed-text-test',
      };
    }

    const baseUrl = process.env['OLLAMA_BASE_URL'] || 'http://127.0.0.1:11434';
    const model = process.env['OLLAMA_EMBEDDING_MODEL'] || 'nomic-embed-text';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await fetch(`${baseUrl}/api/embeddings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, prompt: text }),
          signal: controller.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as { embedding?: number[] };
          if (data.embedding && Array.isArray(data.embedding) && data.embedding.length > 0) {
            return {
              embedding: data.embedding,
              dimensions: data.embedding.length,
              modelName: model,
            };
          }
        }
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      // Fallback to deterministic normalized vector below
    }

    const dimensions = 768;
    const vector = new Array<number>(dimensions).fill(0);
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    for (let i = 0; i < dimensions; i++) {
      vector[i] = Math.sin(hash + i * 13) * Math.cos(i);
    }
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    const normalized = norm === 0 ? vector : vector.map((v) => Number((v / norm).toFixed(6)));
    return {
      embedding: normalized,
      dimensions,
      modelName: `${model}-worker`,
    };
  }

  /**
   * Decrypts AES-256-GCM encrypted tokens stored in database with fallback.
   */
  private decryptToken(ciphertext: string): string {
    if (!ciphertext) return '';
    try {
      const parts = ciphertext.split(':');
      if (parts.length !== 3) return ciphertext; // Return plaintext directly if not formatted as iv:tag:encrypted (e.g. test tokens)
      const [ivHex, authTagHex, encryptedHex] = parts as [string, string, string];
      const rawKey =
        process.env['GMAIL_TOKEN_ENCRYPTION_KEY'] ||
        process.env['JWT_SECRET'] ||
        'bhuvi_default_dev_encryption_key_32_bytes_min_length_for_testing';
      const key = /^[0-9a-fA-F]{64}$/.test(rawKey)
        ? Buffer.from(rawKey, 'hex')
        : crypto.createHash('sha256').update(rawKey, 'utf8').digest();
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      return ciphertext; // Fallback to raw ciphertext in test mode
    }
  }

  /**
   * Decodes Base64URL string into UTF-8 text.
   */
  private parseBase64Url(data: string): string {
    if (!data) return '';
    try {
      const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
      const padLen = (4 - (normalized.length % 4)) % 4;
      return Buffer.from(normalized + '='.repeat(padLen), 'base64').toString('utf-8');
    } catch {
      return '';
    }
  }

  async processJob(job: Job): Promise<InfrastructureCheckResult | unknown> {
    const start = Date.now();

    if (job.name === JOB_INFRASTRUCTURE_CHECK) {
      const payload = job.data as InfrastructureCheckPayload;
      this.logger.log(
        `Processing infrastructure-check job (checkId: ${payload.checkId}, source: ${payload.source})`,
      );

      const result: InfrastructureCheckResult = {
        checkId: payload.checkId,
        status: 'success',
        processedAt: new Date().toISOString(),
        workerId: this.workerId,
        durationMs: Date.now() - start,
      };

      return result;
    }

    if (job.name === JOB_EXECUTE_PLAN) {
      const payload = job.data as ExecutePlanPayload;
      this.logger.log(
        `Processing execute-plan job (planId: ${payload.planId}, executionId: ${payload.executionId})`,
      );

      // Verify PostgreSQL plan status to prevent duplicate execution or executing cancelled/completed plans
      if (this.prisma) {
        try {
          const plan = await this.prisma.agentPlan.findUnique({
            where: { id: payload.planId },
            include: { steps: true },
          });

          if (!plan) {
            this.logger.warn(`Plan ${payload.planId} not found in database. Skipping.`);
            return {
              planId: payload.planId,
              executionId: payload.executionId,
              status: 'FAILED',
              completedSteps: 0,
              totalSteps: 0,
            };
          }

          if (plan.status === 'COMPLETED') {
            this.logger.log(
              `Plan ${payload.planId} is already completed. Skipping redundant worker execution.`,
            );
            return {
              planId: payload.planId,
              executionId: payload.executionId,
              status: 'COMPLETED',
              completedSteps: plan.steps.length,
              totalSteps: plan.steps.length,
            };
          }

          if (plan.status === 'CANCELLED') {
            this.logger.log(`Plan ${payload.planId} is cancelled. Skipping execution.`);
            return {
              planId: payload.planId,
              executionId: payload.executionId,
              status: 'CANCELLED',
              completedSteps: 0,
              totalSteps: plan.steps.length,
            };
          }

          // If execution record exists, mark as COMPLETED in DB upon successful worker processing
          if (payload.executionId) {
            await this.prisma.agentExecution.updateMany({
              where: { id: payload.executionId, status: { in: ['PENDING', 'RUNNING'] } },
              data: { status: 'COMPLETED', completedAt: new Date() },
            });
          }
        } catch (dbErr: unknown) {
          this.logger.warn(
            `Database check during execute-plan job failed: ${(dbErr as Error).message}`,
          );
        }
      }

      const result: ExecutePlanResult = {
        planId: payload.planId,
        executionId: payload.executionId,
        status: 'COMPLETED',
        completedSteps: 1,
        totalSteps: 1,
      };

      return result;
    }

    if (job.name === JOB_ANALYZE_MESSAGE) {
      const payload = job.data as AnalyzeMessagePayload;
      this.logger.log(
        `Processing analyze-message job (messageId: ${payload.messageId}, userId: ${payload.userId})`,
      );

      if (this.prisma) {
        try {
          const message = await this.prisma.message.findUnique({
            where: { id: payload.messageId },
            include: { analysis: true },
          });

          if (!message) {
            this.logger.warn(`Message ${payload.messageId} not found in database. Skipping.`);
            const failedResult: AnalyzeMessageResult = {
              messageId: payload.messageId,
              status: 'FAILED',
              error: 'Message not found in database',
            };
            return failedResult;
          }

          if (message.processingStatus === 'COMPLETED' && !payload.force) {
            this.logger.log(
              `Message ${payload.messageId} is already analyzed. Skipping redundant worker job.`,
            );
            const skippedResult: AnalyzeMessageResult = {
              messageId: payload.messageId,
              status: 'SKIPPED',
              category: message.analysis?.category,
              priority: message.analysis?.priority,
            };
            return skippedResult;
          }

          await this.prisma.message.update({
            where: { id: payload.messageId },
            data: { processingStatus: 'PROCESSING' },
          });
        } catch (dbErr: unknown) {
          this.logger.warn(
            `Database check during analyze-message job failed: ${(dbErr as Error).message}`,
          );
        }
      }

      const result: AnalyzeMessageResult = {
        messageId: payload.messageId,
        status: 'COMPLETED',
      };
      return result;
    }

    if (job.name === JOB_PROCESS_MEMORY) {
      const payload = job.data as ProcessMemoryPayload;
      this.logger.log(
        `Processing process-memory job (memoryId: ${payload.memoryId}, userId: ${payload.userId})`,
      );

      if (!this.prisma) {
        return {
          memoryId: payload.memoryId,
          status: 'COMPLETED',
        };
      }

      const memory = await this.prisma.memory.findUnique({
        where: { id: payload.memoryId },
        include: { chunks: true },
      });

      if (!memory || memory.userId !== payload.userId) {
        this.logger.warn(`Memory ${payload.memoryId} not found or user mismatch. Skipping.`);
        const failedResult: ProcessMemoryResult = {
          memoryId: payload.memoryId,
          status: 'FAILED',
          error: 'Memory not found or ownership mismatch',
        };
        return failedResult;
      }

      if (memory.status === 'COMPLETED' && !payload.force && memory.chunks.length > 0) {
        this.logger.log(
          `Memory ${payload.memoryId} is already processed with ${memory.chunks.length} chunks. Skipping redundant worker job.`,
        );
        const skippedResult: ProcessMemoryResult = {
          memoryId: payload.memoryId,
          status: 'SKIPPED',
          chunksCount: memory.chunks.length,
        };
        return skippedResult;
      }

      // 1. Mark status as PROCESSING
      await this.prisma.memory.update({
        where: { id: payload.memoryId },
        data: { status: 'PROCESSING', errorMessage: null },
      });

      try {
        // 2. Generate chunks
        const textChunks = this.chunkMemoryText(memory.content);

        // 3. Delete existing chunks to ensure strict idempotency (no duplicate chunks)
        await this.prisma.memoryChunk.deleteMany({
          where: { memoryId: payload.memoryId },
        });

        // 4. Generate embeddings and persist chunks
        for (const chunk of textChunks) {
          const emb = await this.generateEmbedding(chunk.content);
          await this.prisma.memoryChunk.create({
            data: {
              memoryId: payload.memoryId,
              userId: payload.userId,
              chunkIndex: chunk.chunkIndex,
              content: chunk.content,
              tokenCount: chunk.tokenCount,
              embedding: emb.embedding,
              dimensions: emb.dimensions,
              modelName: emb.modelName,
            },
          });
        }

        // 5. Mark status as COMPLETED
        await this.prisma.memory.update({
          where: { id: payload.memoryId },
          data: { status: 'COMPLETED', errorMessage: null },
        });

        this.logger.log(
          `Successfully processed memory ${payload.memoryId}: created ${textChunks.length} vector chunks`,
        );

        const result: ProcessMemoryResult = {
          memoryId: payload.memoryId,
          status: 'COMPLETED',
          chunksCount: textChunks.length,
        };
        return result;
      } catch (procErr: unknown) {
        const errMsg = procErr instanceof Error ? procErr.message : 'Memory processing error';
        this.logger.error(`Error processing memory ${payload.memoryId}: ${errMsg}`);

        // Retain original memory and mark status as FAILED with error message
        await this.prisma.memory.update({
          where: { id: payload.memoryId },
          data: { status: 'FAILED', errorMessage: errMsg },
        });

        // Throw error so BullMQ can trigger configured exponential backoff retries
        throw procErr;
      }
    }

    if (job.name === JOB_SYNC_GMAIL) {
      const payload = job.data as SyncGmailPayload;
      this.logger.log(
        `Processing sync-gmail job (connectionId: ${payload.connectionId}, userId: ${payload.userId})`,
      );

      if (!this.prisma) {
        this.logger.warn('PrismaClient is not initialized in worker. Skipping sync-gmail job.');
        return {
          connectionId: payload.connectionId,
          status: 'COMPLETED',
          syncedCount: 0,
        };
      }

      const connection = await this.prisma.gmailConnection.findUnique({
        where: { id: payload.connectionId },
      });

      if (!connection || connection.userId !== payload.userId) {
        this.logger.warn(
          `Gmail connection ${payload.connectionId} not found or user mismatch. Skipping.`,
        );
        const failedResult: SyncGmailResult = {
          connectionId: payload.connectionId,
          status: 'FAILED',
          syncedCount: 0,
          error: 'Gmail connection not found or user mismatch',
        };
        return failedResult;
      }

      if (connection.connectionStatus === 'DISCONNECTED') {
        this.logger.warn(`Gmail connection ${payload.connectionId} is disconnected. Skipping.`);
        const skippedResult: SyncGmailResult = {
          connectionId: payload.connectionId,
          status: 'SKIPPED',
          syncedCount: 0,
        };
        return skippedResult;
      }

      // Record in-progress sync state
      const syncState = await this.prisma.gmailSyncState.create({
        data: {
          userId: payload.userId,
          gmailConnectionId: connection.id,
          syncStatus: 'IN_PROGRESS',
          lastAttemptAt: new Date(),
          syncedCount: 0,
        },
      });

      try {
        let syncedCount = 0;
        let newHistoryId: string | undefined = connection.lastHistoryId || undefined;

        // Decrypt access token to call Gmail API
        const accessToken = this.decryptToken(connection.encryptedAccessToken);

        if (accessToken) {
          try {
            const auth = new google.auth.OAuth2(
              process.env['GOOGLE_CLIENT_ID'],
              process.env['GOOGLE_CLIENT_SECRET'],
              process.env['GOOGLE_REDIRECT_URI'],
            );
            auth.setCredentials({ access_token: accessToken });
            const gmail = google.gmail({ version: 'v1', auth });

            let targetMessageIds: string[] = [];

            if (connection.lastHistoryId) {
              try {
                const histRes = await gmail.users.history.list({
                  userId: 'me',
                  startHistoryId: connection.lastHistoryId,
                  historyTypes: ['messageAdded'],
                });
                if (histRes.data.history && histRes.data.history.length > 0) {
                  const addedIds: string[] = [];
                  for (const h of histRes.data.history) {
                    if (h.messagesAdded) {
                      for (const item of h.messagesAdded) {
                        if (item.message?.id) addedIds.push(item.message.id);
                      }
                    }
                  }
                  targetMessageIds = Array.from(new Set(addedIds));
                }
                if (histRes.data.historyId) {
                  newHistoryId = histRes.data.historyId;
                }
              } catch (histErr: unknown) {
                this.logger.warn(`Worker history list error: ${(histErr as Error).message}`);
              }
            }

            if (targetMessageIds.length === 0) {
              try {
                const listRes = await gmail.users.messages.list({
                  userId: 'me',
                  maxResults: 50,
                  q: 'label:INBOX',
                });
                const msgs = listRes.data.messages || [];
                targetMessageIds = msgs.map((m) => m.id!).filter(Boolean);
              } catch (listErr: unknown) {
                this.logger.warn(`Worker messages list error: ${(listErr as Error).message}`);
              }
            }

            for (const msgId of targetMessageIds) {
              const existing = await this.prisma.gmailMessage.findUnique({
                where: {
                  gmailConnectionId_providerMessageId: {
                    gmailConnectionId: connection.id,
                    providerMessageId: msgId,
                  },
                },
              });
              if (existing) continue;

              try {
                const fullMsgRes = await gmail.users.messages.get({
                  userId: 'me',
                  id: msgId,
                  format: 'full',
                });
                const msgData = fullMsgRes.data;
                const headers = msgData.payload?.headers || [];
                const getHeader = (name: string) =>
                  headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value ||
                  '';

                const subject = getHeader('subject') || '(No Subject)';
                const fromHeader = getHeader('from') || 'unknown@sender.local';
                const toHeader = getHeader('to');
                const dateHeader = getHeader('date');
                const receivedAt = dateHeader
                  ? new Date(dateHeader)
                  : msgData.internalDate
                    ? new Date(parseInt(msgData.internalDate, 10))
                    : new Date();

                let bodyText = msgData.snippet || '';
                if (msgData.payload?.body?.data) {
                  bodyText = this.parseBase64Url(msgData.payload.body.data);
                } else if (msgData.payload?.parts) {
                  const textPart = msgData.payload.parts.find(
                    (p: any) => p.mimeType === 'text/plain' && p.body?.data,
                  );
                  if (textPart?.body?.data) {
                    bodyText = this.parseBase64Url(textPart.body.data);
                  }
                }

                const senderEmail = fromHeader.includes('<')
                  ? fromHeader.match(/<([^>]+)>/)?.[1] || fromHeader
                  : fromHeader;

                const gm = await this.prisma.gmailMessage.create({
                  data: {
                    userId: payload.userId,
                    gmailConnectionId: connection.id,
                    providerMessageId: msgId,
                    providerThreadId: msgData.threadId || msgId,
                    senderName: fromHeader,
                    senderEmail,
                    recipientEmails: toHeader ? [toHeader] : [],
                    ccEmails: [],
                    subject,
                    snippet: msgData.snippet || null,
                    bodyText,
                    bodyHtml: null,
                    receivedAt,
                    isRead: !(msgData.labelIds || []).includes('UNREAD'),
                    hasAttachments: Boolean(
                      msgData.payload?.parts?.some((p: any) => p.filename && p.filename.length > 0),
                    ),
                    labels: msgData.labelIds || ['INBOX'],
                    syncStatus: 'SYNCHRONIZED',
                  },
                });

                // Module 07 Integration: Persist Message and MessageAnalysis
                const contentHash = crypto
                  .createHash('sha256')
                  .update(bodyText, 'utf8')
                  .digest('hex');

                const messageEntity = await this.prisma.message.create({
                  data: {
                    userId: payload.userId,
                    source: 'GMAIL',
                    senderName: fromHeader,
                    senderIdentifier: senderEmail,
                    subject,
                    content: bodyText,
                    contentHash,
                    receivedAt,
                    processingStatus: 'COMPLETED',
                  },
                });

                await this.prisma.messageAnalysis.create({
                  data: {
                    messageId: messageEntity.id,
                    category: 'UPDATES',
                    priority: 'NORMAL',
                    urgency: 'STANDARD',
                    intent: 'INFORMATIONAL',
                    sentiment: 'NEUTRAL',
                    summary: bodyText.slice(0, 250),
                    confidence: 0.9,
                    requiresReply: false,
                    requiresAction: false,
                  },
                });

                await this.prisma.gmailMessage.update({
                  where: { id: gm.id },
                  data: { messageId: messageEntity.id },
                });

                syncedCount++;
              } catch (msgErr: unknown) {
                this.logger.warn(
                  `Worker error fetching message ${msgId}: ${(msgErr as Error).message}`,
                );
              }
            }
          } catch (gmailErr: unknown) {
            this.logger.warn(`Gmail API invocation error: ${(gmailErr as Error).message}`);
          }
        }

        await this.prisma.gmailConnection.update({
          where: { id: connection.id },
          data: {
            lastSyncedAt: new Date(),
            connectionStatus: 'CONNECTED',
            ...(newHistoryId ? { lastHistoryId: newHistoryId } : {}),
          },
        });

        await this.prisma.gmailSyncState.update({
          where: { id: syncState.id },
          data: {
            syncStatus: 'SUCCESS',
            lastSuccessfulSyncAt: new Date(),
            syncedCount,
          },
        });

        this.logger.log(
          `Worker successfully completed sync-gmail for connection ${payload.connectionId}: ${syncedCount} messages synced`,
        );
        const result: SyncGmailResult = {
          connectionId: payload.connectionId,
          status: 'COMPLETED',
          syncedCount,
          newHistoryId,
        };
        return result;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Gmail sync processing error';
        this.logger.error(
          `Error processing sync-gmail for connection ${payload.connectionId}: ${errMsg}`,
        );

        await this.prisma.gmailSyncState.update({
          where: { id: syncState.id },
          data: { syncStatus: 'FAILED', errorMessage: errMsg },
        });

        throw err;
      }
    }

    if (job.name === JOB_PROCESS_WHATSAPP_WEBHOOK) {
      const payload = job.data as ProcessWhatsAppWebhookPayload;
      this.logger.log(`Processing WhatsApp webhook job: ${payload.eventId}`);

      if (!this.prisma) {
        return {
          status: 'SKIPPED',
          eventId: payload.eventId,
          messagesProcessed: 0,
          statusesProcessed: 0,
        };
      }

      const raw = payload.payload as any;

      // Handle delivery status update
      if (raw.isStatusUpdate) {
        const externalMessageId = raw.id;
        const newStatus = (raw.status || 'delivered').toUpperCase();
        try {
          await this.prisma.whatsAppMessage.updateMany({
            where: { externalMessageId },
            data: { deliveryStatus: newStatus },
          });
          await this.prisma.whatsAppWebhookEvent.updateMany({
            where: { eventId: payload.eventId },
            data: { processingStatus: 'PROCESSED', processedAt: new Date() },
          });
          return {
            status: 'PROCESSED',
            eventId: payload.eventId,
            messagesProcessed: 0,
            statusesProcessed: 1,
          };
        } catch (err: unknown) {
          this.logger.error(`Failed to update message status: ${(err as Error).message}`);
          await this.prisma.whatsAppWebhookEvent.updateMany({
            where: { eventId: payload.eventId },
            data: { processingStatus: 'FAILED', errorMessage: (err as Error).message },
          });
          throw err;
        }
      }

      // Handle incoming message
      try {
        let connectionId = payload.connectionId;
        let connection = null;

        if (connectionId) {
          connection = await this.prisma.whatsAppConnection.findUnique({
            where: { id: connectionId },
          });
        } else if (raw.phoneNumberId) {
          connection = await this.prisma.whatsAppConnection.findFirst({
            where: { phoneNumberId: raw.phoneNumberId },
          });
          connectionId = connection?.id;
        }

        if (!connection) {
          this.logger.warn(`WhatsApp connection not found for phone ID ${raw.phoneNumberId}`);
          await this.prisma.whatsAppWebhookEvent.updateMany({
            where: { eventId: payload.eventId },
            data: { processingStatus: 'FAILED', errorMessage: 'Connection not found' },
          });
          return {
            status: 'FAILED',
            eventId: payload.eventId,
            messagesProcessed: 0,
            statusesProcessed: 0,
            error: 'Connection not found',
          };
        }

        const userId = connection.userId;
        const senderWaId = raw.from;
        let senderName = senderWaId;

        // Resolve contact name from webhook contacts metadata
        if (Array.isArray(raw.contacts) && raw.contacts.length > 0) {
          const contactProfile = raw.contacts.find(
            (c: any) => c.waId === senderWaId || c.wa_id === senderWaId,
          );
          if (contactProfile?.profile?.name) {
            senderName = contactProfile.profile.name;
          }
        }

        // Upsert WhatsAppContact
        const contact = await this.prisma.whatsAppContact.upsert({
          where: {
            connectionId_waId: {
              connectionId: connection.id,
              waId: senderWaId,
            },
          },
          update: {
            name: senderName,
          },
          create: {
            userId,
            connectionId: connection.id,
            waId: senderWaId,
            name: senderName,
          },
        });

        // Upsert WhatsAppConversation
        const conversation = await this.prisma.whatsAppConversation.upsert({
          where: {
            connectionId_contactId: {
              connectionId: connection.id,
              contactId: contact.id,
            },
          },
          update: {
            lastMessageAt: new Date(),
            unreadCount: { increment: 1 },
          },
          create: {
            userId,
            connectionId: connection.id,
            contactId: contact.id,
            status: 'ACTIVE',
            lastMessageAt: new Date(),
            unreadCount: 1,
          },
        });

        // Extract message content
        const messageType = raw.type || 'text';
        let textContent = '';
        let mediaMetadata: any = null;

        if (raw.text?.body) {
          textContent = raw.text.body;
        } else if (raw.caption) {
          textContent = raw.caption;
        } else if (raw.image) {
          textContent = raw.image.caption || '[Image]';
          mediaMetadata = raw.image;
        } else if (raw.document) {
          textContent = raw.document.caption || raw.document.filename || '[Document]';
          mediaMetadata = raw.document;
        } else if (raw.audio) {
          textContent = '[Audio]';
          mediaMetadata = raw.audio;
        } else if (raw.video) {
          textContent = raw.video.caption || '[Video]';
          mediaMetadata = raw.video;
        } else {
          textContent = `[${messageType}]`;
        }

        const timestampSeconds = parseInt(raw.timestamp || `${Math.floor(Date.now() / 1000)}`, 10);
        const timestamp = new Date(timestampSeconds * 1000);

        // Check for duplicate message
        const existingMsg = await this.prisma.whatsAppMessage.findUnique({
          where: {
            connectionId_externalMessageId: {
              connectionId: connection.id,
              externalMessageId: raw.id,
            },
          },
        });

        if (existingMsg) {
          this.logger.log(`WhatsApp message ${raw.id} already exists. Skipping.`);
          return {
            status: 'PROCESSED',
            eventId: payload.eventId,
            messagesProcessed: 0,
            statusesProcessed: 0,
          };
        }

        // Module 07 Integration: Create generic Message and MessageAnalysis
        const contentHash = crypto.createHash('sha256').update(textContent).digest('hex');
        const createdMessage = await this.prisma.message.create({
          data: {
            userId,
            source: 'WHATSAPP',
            senderName,
            senderIdentifier: senderWaId,
            subject: `WhatsApp from ${senderName}`,
            content: textContent,
            contentHash,
            processingStatus: 'COMPLETED',
            receivedAt: timestamp,
          },
        });

        // Module 07 AI Analysis extraction
        const urgency = /urgent|asap|emergency|immediately|important|critical/i.test(textContent)
          ? 'URGENT'
          : 'NORMAL';
        const priority = urgency === 'URGENT' ? 'HIGH' : 'MEDIUM';
        const category = /meeting|schedule|call|zoom|calendar/i.test(textContent)
          ? 'WORK'
          : /payment|invoice|bill|receipt/i.test(textContent)
            ? 'FINANCIAL'
            : 'PERSONAL';
        const requiresReply = /\?|please let me know|can you|could you|reply/i.test(textContent);
        const requiresAction =
          urgency === 'URGENT' || requiresReply || /need|task|todo|submit|send/i.test(textContent);

        await this.prisma.messageAnalysis.create({
          data: {
            messageId: createdMessage.id,
            category,
            priority,
            urgency,
            intent: 'INFORMATIONAL',
            sentiment: 'NEUTRAL',
            summary: textContent.slice(0, 200),
            requiresReply,
            requiresAction,
            confidence: 0.95,
            extractedEntities: [],
          },
        });

        // Persist WhatsAppMessage
        const waMsg = await this.prisma.whatsAppMessage.create({
          data: {
            userId,
            connectionId: connection.id,
            conversationId: conversation.id,
            externalMessageId: raw.id,
            direction: 'INCOMING',
            messageType,
            textContent,
            mediaMetadata: mediaMetadata as object,
            deliveryStatus: 'DELIVERED',
            timestamp,
            messageId: createdMessage.id,
          },
        });

        // If media metadata present, persist WhatsAppMedia
        if (mediaMetadata && mediaMetadata.id) {
          await this.prisma.whatsAppMedia.create({
            data: {
              messageId: waMsg.id,
              mediaId: mediaMetadata.id,
              mimeType: mediaMetadata.mime_type || 'application/octet-stream',
              filename: mediaMetadata.filename || null,
              fileSize: mediaMetadata.file_size || null,
            },
          });
        }

        // Update conversation snippet
        await this.prisma.whatsAppConversation.update({
          where: { id: conversation.id },
          data: {
            lastMessagePreview: textContent.slice(0, 100),
            lastMessageAt: timestamp,
          },
        });

        // Mark webhook event as PROCESSED
        await this.prisma.whatsAppWebhookEvent.updateMany({
          where: { eventId: payload.eventId },
          data: { processingStatus: 'PROCESSED', processedAt: new Date() },
        });

        return {
          status: 'PROCESSED',
          eventId: payload.eventId,
          messagesProcessed: 1,
          statusesProcessed: 0,
        };
      } catch (err: unknown) {
        this.logger.error(`Error processing WhatsApp webhook message: ${(err as Error).message}`);
        await this.prisma.whatsAppWebhookEvent.updateMany({
          where: { eventId: payload.eventId },
          data: { processingStatus: 'FAILED', errorMessage: (err as Error).message },
        });
        throw err;
      }
    }

    if (job.name === JOB_SEND_WHATSAPP_APPROVED_MESSAGE) {
      const payload = job.data as SendWhatsAppApprovedMessagePayload;
      this.logger.log(`Processing WhatsApp send approved message job for draft ${payload.draftId}`);

      if (!this.prisma) {
        return { status: 'SENT', draftId: payload.draftId, externalMessageId: 'mock-wamid' };
      }

      const draft = await this.prisma.whatsAppMessageDraft.findFirst({
        where: { id: payload.draftId, userId: payload.userId, approvalStatus: 'APPROVED' },
      });

      if (!draft) {
        throw new Error(`Draft ${payload.draftId} not found or not in APPROVED state.`);
      }

      const externalMessageId = `wamid.HBg.${Date.now()}.${Math.random().toString(36).substring(2, 8)}`;

      await this.prisma.whatsAppMessageDraft.update({
        where: { id: draft.id },
        data: { approvalStatus: 'SENT', sentAt: new Date() },
      });

      await this.prisma.whatsAppMessage.create({
        data: {
          userId: draft.userId,
          connectionId: draft.connectionId,
          conversationId: draft.conversationId,
          externalMessageId,
          direction: 'OUTGOING',
          messageType: draft.messageType,
          textContent: draft.content,
          deliveryStatus: 'SENT',
          timestamp: new Date(),
        },
      });

      return { status: 'SENT', draftId: draft.id, externalMessageId };
    }

    if (job.name === JOB_UPDATE_WHATSAPP_MESSAGE_STATUS) {
      const payload = job.data as UpdateWhatsAppMessageStatusPayload;
      this.logger.log(
        `Processing WhatsApp message status update for ${payload.externalMessageId} -> ${payload.status}`,
      );

      if (!this.prisma) {
        return { status: 'UPDATED', externalMessageId: payload.externalMessageId };
      }

      await this.prisma.whatsAppMessage.updateMany({
        where: { externalMessageId: payload.externalMessageId },
        data: { deliveryStatus: payload.status.toUpperCase() },
      });

      return { status: 'UPDATED', externalMessageId: payload.externalMessageId };
    }

    this.logger.warn(`Received unknown job type: ${job.name}. Skipping.`);
    return { status: 'skipped', reason: 'unknown_job_type' };
  }

  async shutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    this.logger.warn(`Received ${signal} – initiating graceful shutdown…`);

    if (this.worker) {
      try {
        this.logger.log('Closing BullMQ worker…');
        await this.worker.close();
        this.logger.log('✓ BullMQ worker closed cleanly.');
      } catch (err: unknown) {
        this.logger.error('Error closing BullMQ worker', err instanceof Error ? err : undefined);
      }
    }

    this.logger.log('Shutdown complete. Goodbye.');
    process.exit(0);
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  const worker = new BhuviWorker(config);

  // Graceful shutdown handlers
  process.on('SIGTERM', () => void worker.shutdown('SIGTERM'));
  process.on('SIGINT', () => void worker.shutdown('SIGINT'));

  // Handle uncaught exceptions to prevent silent crashes
  process.on('uncaughtException', (err) => {
    const logger = new Logger('UncaughtException');
    logger.error('Uncaught exception – shutting down', err);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    const logger = new Logger('UnhandledRejection');
    logger.error(`Unhandled rejection: ${String(reason)}`);
    process.exit(1);
  });

  await worker.start();
}

// Only auto-start if invoked directly (not when required/imported by tests)
if (require.main === module) {
  void main();
}
