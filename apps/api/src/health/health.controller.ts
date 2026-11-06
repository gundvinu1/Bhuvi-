import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { HealthCheckResponse } from '@bhuvi/shared';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * GET /api/v1/health
   * Returns real runtime status. Does NOT claim database/Redis/Ollama
   * are healthy – those integrations are not yet implemented.
   */
  @Get()
  getHealth(): HealthCheckResponse {
    return this.healthService.getHealth();
  }
}

