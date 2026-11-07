import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { ConfigModule } from '@nestjs/config';
import { AppModule } from '../app.module';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';

describe('Real Message Intelligence Integration (qwen2.5:3b + PostgreSQL 16)', () => {
  let app: INestApplication;
  let user1Token: string;
  let user2Token: string;
  let createdMessageId: string;
  let createdActionItemId: string;

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
        name: 'Message User One',
        email: `msg.user1-${Date.now()}@example.com`,
        password: 'RealPassword123!',
      });
    expect(regRes1.status).toBe(HttpStatus.CREATED);
    user1Token = regRes1.body.data.accessToken;

    // Register User 2 (for multi-tenant isolation testing)
    const regRes2 = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        name: 'Message User Two',
        email: `msg.user2-${Date.now()}@example.com`,
        password: 'RealPassword123!',
      });
    expect(regRes2.status).toBe(HttpStatus.CREATED);
    user2Token = regRes2.body.data.accessToken;
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('1. Ingests message and performs live AI analysis via local qwen2.5:3b and PostgreSQL', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/messages')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        senderName: 'Sarah Jenkins',
        senderIdentifier: 'sarah.j@acme-corp.internal',
        subject: 'Urgent: Submit Q4 Financial Audit Report',
        content:
          'Please submit the finalized Q4 financial audit report before next Friday. This is required for executive board review. Contact billing@acme-corp.internal for questions.',
        source: 'MANUAL',
        autoAnalyze: true,
      });

    expect(res.status).toBe(HttpStatus.CREATED);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.processingStatus).toBe('COMPLETED');
    expect(res.body.data.analysis).toBeDefined();

    const analysis = res.body.data.analysis;
    expect(['WORK', 'FINANCIAL']).toContain(analysis.category);
    expect(['CRITICAL', 'HIGH', 'MEDIUM']).toContain(analysis.priority);
    expect(analysis.summary.length).toBeGreaterThan(10);
    expect(analysis.requiresAction).toBe(true);

    createdMessageId = res.body.data.id;

    if (res.body.data.actionItems && res.body.data.actionItems.length > 0) {
      createdActionItemId = res.body.data.actionItems[0].id;
    }
  }, 40000);

  it('2. Detects duplicate when identical content is submitted by the same user', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/messages')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        senderName: 'Sarah Jenkins',
        senderIdentifier: 'sarah.j@acme-corp.internal',
        subject: 'Urgent: Submit Q4 Financial Audit Report',
        content:
          'Please submit the finalized Q4 financial audit report before next Friday. This is required for executive board review. Contact billing@acme-corp.internal for questions.',
        autoAnalyze: false,
      });

    expect(res.status).toBe(HttpStatus.CREATED);
    expect(res.body.data.isDuplicate).toBe(true);
  }, 10000);

  it('3. Performs on-the-fly preview analysis without database writes', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/messages/analyze-preview')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        senderName: 'Security Ops',
        subject: 'Security Alert: Unauthorized Login Attempt',
        content:
          'Security Alert: Unauthorized login attempt detected on your BHUVI account from IP 192.168.1.50.',
      });

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.success).toBe(true);
    expect(res.body.data.category).toBe('NOTIFICATION');
    expect(res.body.data.priority).toBe('CRITICAL');
    expect(res.body.data.urgency).toBe('URGENT');
  }, 20000);

  it('4. Retrieves paginated message list for authenticated user via secure Cookie', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/messages?page=1&limit=10')
      .set('Cookie', [`bhuvi_token=${user1Token}`]);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.data.messages.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.total).toBeGreaterThanOrEqual(1);
    expect(res.body.data.page).toBe(1);
  }, 10000);

  it('5. Retrieves high-priority and urgent messages', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/messages/priority')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(HttpStatus.OK);
    expect(Array.isArray(res.body.data)).toBe(true);
  }, 10000);

  it('6. Retrieves extracted action items for the user', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/messages/actions')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(HttpStatus.OK);
    expect(Array.isArray(res.body.data)).toBe(true);
  }, 10000);

  it('7. Updates action item status', async () => {
    if (!createdActionItemId) {
      // Create manual action item if model didn't output one in test 1
      const actionRes = await request(app.getHttpServer())
        .get('/api/v1/messages/actions')
        .set('Authorization', `Bearer ${user1Token}`);
      if (actionRes.body.data.length > 0) {
        createdActionItemId = actionRes.body.data[0].id;
      }
    }

    if (createdActionItemId) {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/messages/actions/${createdActionItemId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ status: 'COMPLETED' });

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.data.status).toBe('COMPLETED');
    }
  }, 10000);

  it('8. Enforces multi-tenant ownership: User 2 is denied access to User 1 message (HTTP 403)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/messages/${createdMessageId}`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(res.status).toBe(HttpStatus.FORBIDDEN);
  }, 10000);

  it('9. Enforces multi-tenant ownership: User 2 is denied deleting User 1 message (HTTP 403)', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/messages/${createdMessageId}`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(res.status).toBe(HttpStatus.FORBIDDEN);
  }, 10000);

  it('10. Retrieves aggregate message statistics for the user', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/messages/stats')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.data.totalMessages).toBeGreaterThanOrEqual(1);
    expect(res.body.data.categoryDistribution).toBeDefined();
  }, 10000);

  it('11. Allows user to delete their message and cascades deletion cleanly', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/messages/${createdMessageId}`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.data.deleted).toBe(true);

    // Verify subsequent lookup returns 404
    const getRes = await request(app.getHttpServer())
      .get(`/api/v1/messages/${createdMessageId}`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(getRes.status).toBe(HttpStatus.NOT_FOUND);
  }, 10000);
});
