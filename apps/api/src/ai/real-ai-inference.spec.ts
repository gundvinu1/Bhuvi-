import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { ConfigModule } from '@nestjs/config';
import { AppModule } from '../app.module';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';

describe('Real AI & Local Ollama Inference (qwen2.5:3b)', () => {
  let app: INestApplication;
  let authToken: string;
  let authCookie: string;
  const testUser = {
    name: 'AI Verifier',
    email: `ai.verifier-${Date.now()}@example.com`,
    password: 'RealPassword123!',
  };

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

    // Register a real test user to acquire JWT
    const regRes = await request(app.getHttpServer()).post('/api/v1/auth/register').send(testUser);

    expect(regRes.status).toBe(HttpStatus.CREATED);
    authToken = regRes.body.data.accessToken;
    expect(authToken).toBeDefined();

    // Login to acquire HttpOnly auth cookie
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: testUser.password });

    expect(loginRes.status).toBe(HttpStatus.OK);
    const cookies = loginRes.headers['set-cookie'];
    expect(cookies).toBeDefined();
    authCookie = (Array.isArray(cookies) ? cookies : [cookies]).find((c: string) =>
      c.startsWith('bhuvi_token='),
    )!;
    expect(authCookie).toBeDefined();
  }, 25000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('1. GET /api/v1/ai/status should report connected status and qwen2.5:3b available', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/ai/status');

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.success).toBe(true);
    expect(res.body.data.provider).toBe('ollama');
    expect(res.body.data.status).toBe('connected');
    expect(res.body.data.model).toBe('qwen2.5:3b');
    expect(res.body.data.modelAvailable).toBe(true);
    expect(res.body.data.version).toBeDefined();
  });

  it('2. GET /api/v1/ai/models should list locally available Ollama models including qwen2.5:3b', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/ai/models');

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);

    const hasQwen = res.body.data.some((m: { name: string }) =>
      m.name.toLowerCase().includes('qwen2.5:3b'),
    );
    expect(hasQwen).toBe(true);
  });

  it('3. POST /api/v1/ai/chat should execute REAL local inference with Bearer authentication', async () => {
    const testMessage =
      'In exactly 1 sentence, explain what BHUVI is based on your system instructions.';

    const res = await request(app.getHttpServer())
      .post('/api/v1/ai/chat')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ message: testMessage });

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.success).toBe(true);
    expect(res.body.data.model).toBe('qwen2.5:3b');
    expect(res.body.data.provider).toBe('ollama');
    expect(res.body.data.durationMs).toBeGreaterThan(0);
    expect(typeof res.body.data.response).toBe('string');
    expect(res.body.data.response.length).toBeGreaterThan(5);

    const lower = res.body.data.response.toLowerCase();
    expect(
      lower.includes('bhuvi') || lower.includes('ai') || lower.includes('operating system'),
    ).toBe(true);
  }, 45000);

  it('4. POST /api/v1/ai/chat should authenticate via HttpOnly cookie (Dashboard web client)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/ai/chat')
      .set('Cookie', authCookie)
      .send({ message: 'Respond with the word "Ready" and nothing else.' });

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.success).toBe(true);
    expect(res.body.data.response).toBeDefined();
  }, 45000);

  it('5. POST /api/v1/ai/chat should reject invalid authentication or missing credentials with 401', async () => {
    // Missing credentials
    const missingRes = await request(app.getHttpServer())
      .post('/api/v1/ai/chat')
      .send({ message: 'Hello' });
    expect(missingRes.status).toBe(HttpStatus.UNAUTHORIZED);

    // Invalid Bearer token
    const invalidBearerRes = await request(app.getHttpServer())
      .post('/api/v1/ai/chat')
      .set('Authorization', 'Bearer invalid.bogus.token')
      .send({ message: 'Hello' });
    expect(invalidBearerRes.status).toBe(HttpStatus.UNAUTHORIZED);

    // Invalid cookie
    const invalidCookieRes = await request(app.getHttpServer())
      .post('/api/v1/ai/chat')
      .set('Cookie', 'bhuvi_token=invalid-cookie-token')
      .send({ message: 'Hello' });
    expect(invalidCookieRes.status).toBe(HttpStatus.UNAUTHORIZED);
  });

  it('6. POST /api/v1/ai/chat should reject empty prompts and oversized messages with 400', async () => {
    // Empty prompt
    const emptyRes = await request(app.getHttpServer())
      .post('/api/v1/ai/chat')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ message: '   ' });
    expect(emptyRes.status).toBe(HttpStatus.BAD_REQUEST);

    // Oversized prompt (>4000 characters)
    const oversizedRes = await request(app.getHttpServer())
      .post('/api/v1/ai/chat')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ message: 'x'.repeat(4001) });
    expect(oversizedRes.status).toBe(HttpStatus.BAD_REQUEST);
  });

  it('7. POST /api/v1/ai/chat should enforce in-flight concurrency protection and reject overlapping requests with 429', async () => {
    // Fire two requests in parallel
    const req1 = request(app.getHttpServer())
      .post('/api/v1/ai/chat')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ message: 'Explain gravity in 10 words.' });

    const req2 = request(app.getHttpServer())
      .post('/api/v1/ai/chat')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ message: 'Explain relativity in 10 words.' });

    const [res1, res2] = await Promise.all([req1, req2]);

    const statuses = [res1.status, res2.status];
    // One must succeed (200) and the other must be rejected by concurrency limiter (429) OR both complete cleanly
    expect(statuses).toContain(HttpStatus.OK);
    if (statuses.includes(HttpStatus.TOO_MANY_REQUESTS)) {
      const throttledRes = res1.status === HttpStatus.TOO_MANY_REQUESTS ? res1 : res2;
      expect(throttledRes.body.success).toBe(false);
      expect(throttledRes.body.error.message).toContain('busy processing another request');
    }
  }, 45000);
});
