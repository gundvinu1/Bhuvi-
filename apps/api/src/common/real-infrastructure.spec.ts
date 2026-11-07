import { execSync } from 'node:child_process';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { ConfigModule } from '@nestjs/config';
import { AppModule } from '../app.module';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';
import { PrismaService } from '@bhuvi/database';
import {
  createDefaultQueue,
  enqueueInfrastructureCheck,
  getRedisConnectionOptions,
  JOB_INFRASTRUCTURE_CHECK,
  Queue,
  QueueEvents,
  Redis,
  Worker,
} from '@bhuvi/queue';

describe('Real Infrastructure Verification (PostgreSQL 16 + Redis 7 + BullMQ)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const testEmail = `persistent-${Date.now()}@example.com`;
  const testPassword = 'RealPostgresPassword123!';
  const testName = 'Persistent Tester';
  let createdUserId: string;

  async function createApplication(): Promise<INestApplication> {
    process.env['AUTH_DEV_MODE'] = 'false';

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['.env', '../../.env'],
        }),
        AppModule,
      ],
    }).compile();

    const application = moduleRef.createNestApplication();
    application.setGlobalPrefix('/api/v1');
    application.use(cookieParser());
    application.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    application.useGlobalFilters(new AllExceptionsFilter());
    await application.init();
    return application;
  }

  beforeAll(async () => {
    app = await createApplication();
    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // ------------------------------------------------------------
  // SECTION 3 & 4: PostgreSQL & Prisma Persistence Across Restart
  // ------------------------------------------------------------
  describe('PostgreSQL Persistence & API Restart Simulation', () => {
    it('1. should register a new user and persist directly to PostgreSQL', async () => {
      const res = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        name: testName,
        email: testEmail,
        password: testPassword,
      });

      expect(res.status).toBe(HttpStatus.CREATED);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(testEmail);
      createdUserId = res.body.data.user.id;
      expect(createdUserId).toBeDefined();

      // Verify the record physically exists in PostgreSQL database
      const dbRecord = await prisma.user.findUnique({
        where: { email: testEmail },
      });

      expect(dbRecord).not.toBeNull();
      expect(dbRecord?.id).toBe(createdUserId);
      expect(dbRecord?.name).toBe(testName);
      expect(dbRecord?.passwordHash).toBeDefined();
      expect(dbRecord?.passwordHash).not.toBe(testPassword); // Must be bcrypt hash
    });

    it('2. should stop and restart the API server process', async () => {
      // Physically shut down the first application instance
      await app.close();

      // Bootstrap a brand new NestJS application instance simulating process restart
      app = await createApplication();
      prisma = app.get<PrismaService>(PrismaService);

      expect(app).toBeDefined();
    });

    it('3. should successfully log in with original credentials after server restart', async () => {
      const res = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
        email: testEmail,
        password: testPassword,
      });

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe(createdUserId);
      expect(res.body.data.user.email).toBe(testEmail);

      const token = res.body.data.accessToken;
      expect(token).toBeDefined();

      // Verify profile retrieval via /api/v1/auth/me
      const meRes = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(meRes.status).toBe(HttpStatus.OK);
      expect(meRes.body.success).toBe(true);
      expect(meRes.body.data.id).toBe(createdUserId);
      expect(meRes.body.data.email).toBe(testEmail);
      expect(meRes.body.data.name).toBe(testName);
    });

    it('4. should reject duplicate registration against real PostgreSQL unique constraint', async () => {
      const res = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        name: 'Duplicate Attempt',
        email: testEmail,
        password: 'AnotherPassword123!',
      });

      expect(res.status).toBe(HttpStatus.CONFLICT);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('USER_ALREADY_EXISTS');
    });
  });

  // ------------------------------------------------------------
  // SECTION 5: Redis 7 & BullMQ Real Queue Processing
  // ------------------------------------------------------------
  describe('Redis 7 & BullMQ Integration', () => {
    let redisClient: Redis;
    let queue: Queue;
    let queueEvents: QueueEvents;
    let worker: Worker;

    afterAll(async () => {
      if (queueEvents) await queueEvents.close();
      if (worker) await worker.close();
      if (queue) await queue.close();
      if (redisClient) await redisClient.quit();
    });

    it('1. should connect to real Redis and verify PING returns PONG', async () => {
      const opts = getRedisConnectionOptions();
      redisClient = new Redis({
        ...opts,
        maxRetriesPerRequest: null,
      });

      const pong = await redisClient.ping();
      expect(pong).toBe('PONG');
    });

    it('2. should submit and process an infrastructure-check job via BullMQ', async () => {
      const queueName = 'bhuvi-test-queue';
      queue = createDefaultQueue(queueName);
      queueEvents = new QueueEvents(queueName, { connection: getRedisConnectionOptions() });

      const checkId = `infra-chk-${Date.now()}`;

      // Initialize BullMQ worker for the test queue
      worker = new Worker(
        queueName,
        async (job) => {
          if (job.name === JOB_INFRASTRUCTURE_CHECK) {
            return {
              checkId: job.data.checkId,
              status: 'success',
              processedAt: new Date().toISOString(),
              workerId: 'test-real-worker-1',
              durationMs: 15,
            };
          }
          return { status: 'skipped' };
        },
        { connection: getRedisConnectionOptions() },
      );

      // Submit the job
      const job = await enqueueInfrastructureCheck(queue, {
        checkId,
        source: 'real-infrastructure-spec',
        timestamp: new Date().toISOString(),
      });

      expect(job.id).toBeDefined();

      // Await job completion via queueEvents
      const completedJob = await job.waitUntilFinished(queueEvents);
      expect(completedJob).toBeDefined();
      expect(completedJob.status).toBe('success');
      expect(completedJob.checkId).toBe(checkId);
      expect(completedJob.workerId).toBe('test-real-worker-1');
      expect(completedJob.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ------------------------------------------------------------
  // SECTION 6: Health Endpoint Real Dependency Status & Resilience
  // ------------------------------------------------------------
  describe('Health Endpoint Real Dependency Connectivity', () => {
    it('1. should report healthy status with postgres: connected and redis: connected', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/health');

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.application).toBe('BHUVI');
      expect(res.body.status).toBe('healthy');
      expect(res.body.dependencies).toEqual({
        postgres: 'connected',
        redis: 'connected',
      });
    });

    it('2. should degrade to status: degraded and redis: disconnected when Redis is stopped', async () => {
      try {
        execSync('docker stop bhuvi-redis', { stdio: 'ignore' });

        const res = await request(app.getHttpServer()).get('/api/v1/health');

        expect(res.status).toBe(HttpStatus.OK);
        expect(res.body.status).toBe('degraded');
        expect(res.body.dependencies.postgres).toBe('connected');
        expect(res.body.dependencies.redis).toBe('disconnected');
      } finally {
        execSync('docker start bhuvi-redis', { stdio: 'ignore' });
        // Allow Redis container to finish startup probe
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }, 15000);

    it('3. should recover to status: healthy after Redis container is restarted', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/health');

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.status).toBe('healthy');
      expect(res.body.dependencies.postgres).toBe('connected');
      expect(res.body.dependencies.redis).toBe('connected');
    });
  });
});
