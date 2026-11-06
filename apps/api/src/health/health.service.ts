import { Injectable } from '@nestjs/common';
import { HealthCheckResponse, APP_NAME, APP_VERSION } from '@bhuvi/shared';

@Injectable()
export class HealthService {
  private readonly startTime = Date.now();

  getHealth(): HealthCheckResponse {
    const uptimeMs = Date.now() - this.startTime;
    return {
      application: APP_NAME,
      status: 'healthy',
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptimeMs / 1000),
    };
  }
}

