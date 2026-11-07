import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { HealthCheckResponse } from '@bhuvi/shared';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * GET /api/v1/health
   * Returns real runtime application status along with actual PostgreSQL
   * and Redis connectivity states without exposing internal secrets.
   */
  @Get()
  async getHealth(): Promise<HealthCheckResponse> {
    return this.healthService.getHealth();
  }
}
