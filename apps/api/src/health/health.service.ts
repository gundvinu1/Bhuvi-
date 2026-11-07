import { Injectable, Optional } from '@nestjs/common';
import { HealthCheckResponse, APP_NAME, APP_VERSION } from '@bhuvi/shared';
import { PrismaService } from '@bhuvi/database';
import { getRedisConnectionOptions, Redis } from '@bhuvi/queue';

@Injectable()
export class HealthService {
  private readonly startTime = Date.now();

  constructor(
    @Optional()
    private readonly prismaService?: PrismaService,
  ) {}

  async getHealth(): Promise<HealthCheckResponse> {
    const uptimeSec = Math.floor((Date.now() - this.startTime) / 1000);

    // 1. Check PostgreSQL connectivity
    let postgresStatus: 'connected' | 'disconnected' = 'disconnected';
    if (this.prismaService) {
      try {
        const dbHealth = await this.prismaService.isHealthy();
        postgresStatus = dbHealth.status;
      } catch {
        postgresStatus = 'disconnected';
      }
    }

    // 2. Check Redis connectivity
    const redisStatus = await this.checkRedisHealth();

    // 3. Compute aggregate health status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (postgresStatus === 'disconnected' && redisStatus === 'disconnected') {
      status = 'unhealthy';
    } else if (postgresStatus === 'disconnected' || redisStatus === 'disconnected') {
      status = 'degraded';
    }

    return {
      application: APP_NAME,
      status,
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
      uptime: uptimeSec,
      dependencies: {
        postgres: postgresStatus,
        redis: redisStatus,
      },
    };
  }

  private async checkRedisHealth(): Promise<'connected' | 'disconnected'> {
    const options = getRedisConnectionOptions();
    let client: Redis | null = null;

    try {
      client = new Redis({
        ...options,
        connectTimeout: 1500,
        commandTimeout: 1500,
        retryStrategy: () => null, // Prevent infinite reconnection loops in health check
      });

      const pong = await Promise.race([
        client.ping(),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('Redis ping timeout')), 1500),
        ),
      ]);

      return pong === 'PONG' ? 'connected' : 'disconnected';
    } catch {
      return 'disconnected';
    } finally {
      if (client) {
        try {
          client.disconnect();
        } catch {
          // Ignore disconnection error during cleanup
        }
      }
    }
  }
}
