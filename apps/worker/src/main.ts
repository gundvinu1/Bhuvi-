import { randomUUID } from 'crypto';
import { APP_NAME, APP_VERSION } from '@bhuvi/shared';
import { PrismaClient } from '@bhuvi/database';
import {
  Worker,
  Job,
  DEFAULT_QUEUE_NAME,
  JOB_INFRASTRUCTURE_CHECK,
  JOB_EXECUTE_PLAN,
  getRedisConnectionOptions,
  getSanitizedRedisConfig,
  InfrastructureCheckPayload,
  InfrastructureCheckResult,
  ExecutePlanPayload,
  ExecutePlanResult,
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
