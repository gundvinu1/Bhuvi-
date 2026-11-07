import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaService } from '@bhuvi/database';

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: HealthService;

  beforeEach(async () => {
    const mockPrismaService = {
      isHealthy: jest.fn().mockResolvedValue({ status: 'connected', latencyMs: 5 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthService = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('GET /health should return real status with dependencies', async () => {
    jest
      .spyOn(
        healthService as unknown as { checkRedisHealth: () => Promise<string> },
        'checkRedisHealth',
      )
      .mockResolvedValue('connected');

    const result = await controller.getHealth();
    expect(result.application).toBe('BHUVI');
    expect(result.status).toBe('healthy');
    expect(result.version).toBe('1.0.0');
    expect(result.timestamp).toBeDefined();
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    expect(result.dependencies?.postgres).toBe('connected');
    expect(result.dependencies?.redis).toBe('connected');
  });

  it('GET /health should report degraded when postgres is connected but redis is disconnected', async () => {
    jest
      .spyOn(
        healthService as unknown as { checkRedisHealth: () => Promise<string> },
        'checkRedisHealth',
      )
      .mockResolvedValue('disconnected');

    const result = await controller.getHealth();
    expect(result.status).toBe('degraded');
    expect(result.dependencies?.postgres).toBe('connected');
    expect(result.dependencies?.redis).toBe('disconnected');
  });
});
