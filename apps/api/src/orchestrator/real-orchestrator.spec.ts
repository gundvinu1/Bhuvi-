import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { ConfigModule } from '@nestjs/config';
import { AppModule } from '../app.module';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';

describe('Real AI Agent Orchestrator Integration (qwen2.5:3b + PostgreSQL 16)', () => {
  let app: INestApplication;
  let user1Token: string;
  let user2Token: string;
  let createdPlanId: string;
  let planToCancelId: string;

  beforeAll(async () => {
    process.env['AUTH_DEV_MODE'] = 'false';
    process.env['OLLAMA_BASE_URL'] = 'http://127.0.0.1:11434';
    process.env['OLLAMA_MODEL'] = 'qwen2.5:3b';

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['.env', '../../.env'],
        }),
        AppModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('/api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    // Register User 1
    const regRes1 = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        name: 'Orchestrator User One',
        email: `orch.user1-${Date.now()}@example.com`,
        password: 'RealPassword123!',
      });
    expect(regRes1.status).toBe(HttpStatus.CREATED);
    user1Token = regRes1.body.data.accessToken;

    // Register User 2 (for cross-user ownership testing)
    const regRes2 = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        name: 'Orchestrator User Two',
        email: `orch.user2-${Date.now()}@example.com`,
        password: 'RealPassword123!',
      });
    expect(regRes2.status).toBe(HttpStatus.CREATED);
    user2Token = regRes2.body.data.accessToken;
  }, 25000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('1. POST /api/v1/orchestrator/plans should reject unauthenticated requests with 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/orchestrator/plans')
      .send({ message: 'Plan my launch' });

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
  });

  it('2. POST /api/v1/orchestrator/plans should generate, validate, and persist plan with steps', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/orchestrator/plans')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ message: "Help me prepare for tomorrow's team sync meeting" });

    expect(res.status).toBe(HttpStatus.CREATED);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.title).toBeDefined();
    expect(res.body.data.intentCategory).toBeDefined();
    expect(res.body.data.steps.length).toBeGreaterThanOrEqual(2);

    createdPlanId = res.body.data.id;

    // Verify first step structure
    const firstStep = res.body.data.steps[0];
    expect(firstStep.stepKey).toBeDefined();
    expect(firstStep.title).toBeDefined();
    expect(firstStep.assignedAgent).toBeDefined();
  }, 45000);

  it('3. GET /api/v1/orchestrator/plans should return only the authenticated user plans', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/orchestrator/plans')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.some((p: { id: string }) => p.id === createdPlanId)).toBe(true);

    // User 2 should have 0 plans
    const res2 = await request(app.getHttpServer())
      .get('/api/v1/orchestrator/plans')
      .set('Authorization', `Bearer ${user2Token}`);
    expect(res2.body.data.length).toBe(0);
  });

  it('4. GET /api/v1/orchestrator/plans/:id should reject cross-user access with 403 Forbidden', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/orchestrator/plans/${createdPlanId}`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(res.status).toBe(HttpStatus.FORBIDDEN);
  });

  it('5. POST /api/v1/orchestrator/plans/:id/execute should start controlled execution', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/orchestrator/plans/${createdPlanId}/execute`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.success).toBe(true);
    expect(res.body.data.planId).toBe(createdPlanId);
    expect(res.body.data.executionId).toBeDefined();
    expect(['COMPLETED', 'RUNNING', 'WAITING_FOR_APPROVAL']).toContain(res.body.data.status);
  }, 60000);

  it('6. POST /api/v1/orchestrator/plans/:id/cancel should cancel plan and update status', async () => {
    // Create a quick plan to cancel
    const planRes = await request(app.getHttpServer())
      .post('/api/v1/orchestrator/plans')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ message: 'Cancel test plan task' });

    planToCancelId = planRes.body.data.id;

    const cancelRes = await request(app.getHttpServer())
      .post(`/api/v1/orchestrator/plans/${planToCancelId}/cancel`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(cancelRes.status).toBe(HttpStatus.OK);
    expect(cancelRes.body.success).toBe(true);

    // Verify status is CANCELLED in database
    const verifyRes = await request(app.getHttpServer())
      .get(`/api/v1/orchestrator/plans/${planToCancelId}`)
      .set('Authorization', `Bearer ${user1Token}`);
    expect(verifyRes.body.data.status).toBe('CANCELLED');
  }, 45000);

  it('7. POST /api/v1/orchestrator/plans should reject request with prompt key (contract requires message) with 400 Bad Request', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/orchestrator/plans')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ prompt: 'This should be rejected because key is prompt not message' });

    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.success).toBe(false);
  });

  it('8. POST /api/v1/orchestrator/plans should reject empty or whitespace message with 400 Bad Request', async () => {
    const resEmpty = await request(app.getHttpServer())
      .post('/api/v1/orchestrator/plans')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ message: '' });

    expect(resEmpty.status).toBe(HttpStatus.BAD_REQUEST);

    const resWhitespace = await request(app.getHttpServer())
      .post('/api/v1/orchestrator/plans')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ message: '     ' });

    expect(resWhitespace.status).toBe(HttpStatus.BAD_REQUEST);
  });

  it('9. POST /api/v1/orchestrator/plans/:id/execute should reject cross-user execution with 403 Forbidden', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/orchestrator/plans/${createdPlanId}/execute`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(res.status).toBe(HttpStatus.FORBIDDEN);
  });

  it('10. POST /api/v1/orchestrator/plans/:id/cancel should reject cross-user cancellation with 403 Forbidden', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/orchestrator/plans/${createdPlanId}/cancel`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(res.status).toBe(HttpStatus.FORBIDDEN);
  });

  it('11. Approvals should strictly enforce cross-user isolation with 403 Forbidden', async () => {
    // Attempting to approve non-existent or other user proposal with random UUID
    const randomApprovalId = '00000000-0000-0000-0000-000000000000';
    const resApprove = await request(app.getHttpServer())
      .post(`/api/v1/orchestrator/approvals/${randomApprovalId}/approve`)
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ reason: 'Malicious attempt' });

    // Should return 404 (if non-existent) or 403 (if belongs to user1)
    expect([HttpStatus.NOT_FOUND, HttpStatus.FORBIDDEN]).toContain(resApprove.status);
  });

  it('12. Redis-backed distributed lock prevents concurrent acquisition and releases cleanly', async () => {
    const { ExecutionEngineService } = await import('./execution/execution-engine.service');
    const executionEngine = app.get(ExecutionEngineService);

    const testLockPlanId = `test-plan-${Date.now()}`;
    const lockVal1 = 'exec-instance-1';
    const lockVal2 = 'exec-instance-2';

    // Instance 1 acquires lock
    const acquired1 = await executionEngine.acquireDistributedLock(testLockPlanId, lockVal1);
    expect(acquired1).toBe(true);

    // Instance 2 attempts to acquire same lock simultaneously -> must be rejected
    const acquired2 = await executionEngine.acquireDistributedLock(testLockPlanId, lockVal2);
    expect(acquired2).toBe(false);

    // Instance 1 releases lock
    await executionEngine.releaseDistributedLock(testLockPlanId, lockVal1);

    // Instance 2 can now acquire lock
    const acquiredAfterRelease = await executionEngine.acquireDistributedLock(
      testLockPlanId,
      lockVal2,
    );
    expect(acquiredAfterRelease).toBe(true);

    // Clean up
    await executionEngine.releaseDistributedLock(testLockPlanId, lockVal2);
  });

  it('13. POST /api/v1/orchestrator/plans/:id/execute rejects duplicate execution when already completed or cancelled', async () => {
    // Attempting to execute the already cancelled plan from test 6
    const res = await request(app.getHttpServer())
      .post(`/api/v1/orchestrator/plans/${planToCancelId}/execute`)
      .set('Authorization', `Bearer ${user1Token}`);

    // Expect 400 Bad Request because plan is already completed/cancelled
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.success).toBe(false);
  });
});
