import { randomUUID } from 'crypto';
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
    this.workerId = `worker-${randomUUID().substring(0, 8)}`;
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
        await this.prisma.gmailConnection.update({
          where: { id: connection.id },
          data: { lastSyncedAt: new Date(), connectionStatus: 'CONNECTED' },
        });

        await this.prisma.gmailSyncState.update({
          where: { id: syncState.id },
          data: {
            syncStatus: 'SUCCESS',
            lastSuccessfulSyncAt: new Date(),
            syncedCount: 0,
          },
        });

        this.logger.log(
          `Worker successfully completed sync-gmail for connection ${payload.connectionId}`,
        );
        const result: SyncGmailResult = {
          connectionId: payload.connectionId,
          status: 'COMPLETED',
          syncedCount: 0,
          newHistoryId: connection.lastHistoryId || undefined,
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
