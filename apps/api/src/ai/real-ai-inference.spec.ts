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
  }, 20000);

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

  it('3. POST /api/v1/ai/chat should reject unauthenticated requests with 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/ai/chat')
      .send({ message: 'Hello' });

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    expect(res.body.success).toBe(false);
  });

  it('4. POST /api/v1/ai/chat should reject empty prompts with 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/ai/chat')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ message: '   ' });

    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
  });

  it('5. POST /api/v1/ai/chat should execute REAL local inference with qwen2.5:3b and return structured answer', async () => {
    const prompt =
      'In exactly 1 sentence, explain what BHUVI is based on your system instructions.';

    const res = await request(app.getHttpServer())
      .post('/api/v1/ai/chat')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ message: prompt });

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.success).toBe(true);
    expect(res.body.data.model).toBe('qwen2.5:3b');
    expect(res.body.data.provider).toBe('ollama');
    expect(res.body.data.durationMs).toBeGreaterThan(0);
    expect(typeof res.body.data.response).toBe('string');
    expect(res.body.data.response.length).toBeGreaterThan(5);

    // Verify response content mentions BHUVI or AI operating system
    const lowerContent = res.body.data.response.toLowerCase();
    expect(
      lowerContent.includes('bhuvi') ||
        lowerContent.includes('ai') ||
        lowerContent.includes('operating system'),
    ).toBe(true);
  }, 45000);
});
