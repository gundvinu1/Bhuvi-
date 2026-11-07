import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { DatabaseHealthStatus } from './database.types';
import { parseSanitizedDatabaseConfig } from './database.config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private isConnected = false;

  constructor() {
    super({
      log:
        process.env['NODE_ENV'] === 'development'
          ? [
              { emit: 'event', level: 'query' },
              { emit: 'stdout', level: 'info' },
              { emit: 'stdout', level: 'warn' },
              { emit: 'stdout', level: 'error' },
            ]
          : [{ emit: 'stdout', level: 'error' }],
    });
  }

  async onModuleInit(): Promise<void> {
    const sanitized = parseSanitizedDatabaseConfig();
    const endpointDesc = sanitized
      ? `${sanitized.user}@${sanitized.host}:${sanitized.port}/${sanitized.database}`
      : 'unconfigured';

    try {
      this.logger.log(`Connecting to PostgreSQL (${endpointDesc})…`);
      await this.$connect();
      this.isConnected = true;
      this.logger.log(`✓ PostgreSQL connection established (${endpointDesc})`);
    } catch (error: unknown) {
      this.isConnected = false;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `⚠️  PostgreSQL connection could not be established (${endpointDesc}). ` +
          `Database queries will fail until PostgreSQL is running. Error: ${message}`,
      );

      // In production mode, failing to connect to the persistent database is fatal
      if (process.env['NODE_ENV'] === 'production') {
        throw new Error(
          `FATAL: Failed to connect to production PostgreSQL database (${endpointDesc}). Process terminating.`,
          { cause: error },
        );
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.isConnected) {
      this.logger.log('Disconnecting from PostgreSQL…');
      try {
        await this.$disconnect();
        this.isConnected = false;
        this.logger.log('✓ PostgreSQL disconnected cleanly');
      } catch (err: unknown) {
        this.logger.error('Error during PostgreSQL disconnect', err instanceof Error ? err : undefined);
      }
    }
  }

  /**
   * Performs an active round-trip ping query against the database to measure
   * health and response latency without leaking connection credentials.
   */
  async isHealthy(): Promise<DatabaseHealthStatus> {
    const start = Date.now();
    try {
      await this.$queryRaw`SELECT 1`;
      this.isConnected = true;
      return {
        status: 'connected',
        latencyMs: Date.now() - start,
      };
    } catch (err: unknown) {
      this.isConnected = false;
      const message = err instanceof Error ? err.message : String(err);
      return {
        status: 'disconnected',
        error: message,
      };
    }
  }
}
