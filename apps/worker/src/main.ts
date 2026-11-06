import { APP_NAME, APP_VERSION } from '@bhuvi/shared';

// ============================================================
// BHUVI Worker – Main Entry Point
// Module 01: Foundation only. Queues and scheduling come in
// Module 03 (BullMQ/Redis) and Module 15 (Action Engine).
// ============================================================

interface WorkerConfig {
  nodeEnv: string;
  port: number;
}

function loadConfig(): WorkerConfig {
  return {
    nodeEnv: process.env['NODE_ENV'] ?? 'development',
    port: parseInt(process.env['WORKER_PORT'] ?? '3002', 10),
  };
}

class Logger {
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

class BhuviWorker {
  private readonly logger = new Logger('BhuviWorker');
  private readonly config: WorkerConfig;
  private isShuttingDown = false;

  constructor(config: WorkerConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    this.logger.log(`🔧 ${APP_NAME} Worker v${APP_VERSION} starting…`);
    this.logger.log(`   Environment : ${this.config.nodeEnv}`);
    this.logger.log(`   Node.js     : ${process.version}`);
    this.logger.log('');
    this.logger.log('Worker initialized successfully.');
    this.logger.log('No queues or schedules active yet (planned: Module 03/15).');
    this.logger.log('Process is running. Send SIGTERM or SIGINT to shut down gracefully.');
  }

  async shutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    this.logger.warn(`Received ${signal} – initiating graceful shutdown…`);
    // Future: drain queues, close DB connections, etc.
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

void main();

