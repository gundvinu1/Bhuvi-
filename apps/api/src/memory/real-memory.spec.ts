import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { ConfigModule } from '@nestjs/config';
import { AppModule } from '../app.module';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';

describe('Real Memory & Knowledge Integration (Ollama + PostgreSQL 16 + Redis)', () => {
  let app: INestApplication;
  let user1Token: string;
  let user2Token: string;
  let user1MemoryId: string;

  beforeAll(async () => {
    process.env['AUTH_DEV_MODE'] = 'false';
    process.env['OLLAMA_BASE_URL'] = 'http://127.0.0.1:11434';
    process.env['OLLAMA_MODEL'] = 'qwen2.5:3b';
    process.env['OLLAMA_EMBEDDING_MODEL'] = 'nomic-embed-text';

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
        name: 'Memory User One',
        email: `memory.user1-${Date.now()}@example.com`,
        password: 'RealPassword123!',
      });
    expect(regRes1.status).toBe(HttpStatus.CREATED);
    user1Token = regRes1.body.data.accessToken;

    // Register User 2 (for strict multi-tenant isolation verification)
    const regRes2 = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        name: 'Memory User Two',
        email: `memory.user2-${Date.now()}@example.com`,
        password: 'RealPassword123!',
      });
    expect(regRes2.status).toBe(HttpStatus.CREATED);
    user2Token = regRes2.body.data.accessToken;
  }, 45000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('1. Memory Creation & Local Embedding Generation', () => {
    it('should create memory, split chunks, and compute vector embeddings via Ollama', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/memory')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Home WiFi Network Details',
          content:
            'Our home WiFi network SSID is HomeNet-5G and the WPA3 pre-shared key is StarLight#9942. The main router is located in the study room on the second floor.',
          category: 'PERSONAL',
          importance: 'HIGH',
          tags: ['wifi', 'home', 'credentials'],
        });

      expect(res.status).toBe(HttpStatus.CREATED);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Home WiFi Network Details');
      expect(res.body.data.status).toBe('COMPLETED');
      expect(res.body.data.chunksCount).toBeGreaterThanOrEqual(1);
      expect(res.body.data.tags).toContain('wifi');
      expect(res.body.data.chunks[0].dimensions).toBe(768);

      user1MemoryId = res.body.data.id;
    }, 30000);

    it('should create a second memory in a different category', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/memory')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Project Phoenix Deployment Notes',
          content:
            'Project Phoenix runs on Docker Compose with PostgreSQL 16 on port 5432 and Redis 7 on port 6379. All microservices communicate over internal bridge network.',
          category: 'PROJECT',
          importance: 'CRITICAL',
          tags: ['docker', 'devops', 'phoenix'],
        });

      expect(res.status).toBe(HttpStatus.CREATED);
      expect(res.body.data.status).toBe('COMPLETED');
    }, 30000);
  });

  describe('2. Vector Semantic Search', () => {
    it('should retrieve most relevant memory via cosine vector search', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/memory/search')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          query: 'What is the WiFi password for my home network?',
          limit: 3,
          threshold: 0.4,
        });

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const topResult = res.body.data[0];
      expect(topResult.title).toBe('Home WiFi Network Details');
      expect(topResult.similarity).toBeGreaterThanOrEqual(0.5);
    }, 20000);
  });

  describe('3. Strict Multi-Tenant Isolation', () => {
    it('should NOT return User 1 memories when User 2 searches with the exact same query', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/memory/search')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          query: 'What is the WiFi password for my home network?',
          limit: 5,
        });

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.data).toHaveLength(0);
    }, 20000);

    it('should forbid User 2 from retrieving User 1 memory details (404 Not Found)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/memory/${user1MemoryId}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(HttpStatus.NOT_FOUND);
    });

    it('should forbid User 2 from deleting User 1 memory (404 Not Found)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/memory/${user1MemoryId}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(HttpStatus.NOT_FOUND);
    });
  });

  describe('4. RAG (Retrieval-Augmented Generation) Question Answering', () => {
    it('should answer questions grounded in personal memories with source citations', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/memory/ask')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          question: 'What is my home WiFi password?',
        });

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.foundRelevantMemory).toBe(true);
      expect(res.body.data.confidence).toBeGreaterThanOrEqual(0.5);
      expect(res.body.data.sources).toHaveLength(1);
      expect(res.body.data.sources[0].title).toBe('Home WiFi Network Details');
      expect(res.body.data.answer).toMatch(/StarLight#9942/i);
    }, 45000);

    it('should provide honest fallback when asked about information not in memory', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/memory/ask')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          question: 'What is my maternal grandfather birthday and hometown?',
        });

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.data.foundRelevantMemory).toBe(false);
      expect(res.body.data.sources).toEqual([]);
      expect(res.body.data.answer).toContain('do not have any recorded memories');
    }, 20000);
  });

  describe('5. Memory Statistics & Metadata', () => {
    it('should return accurate memory counts and category distribution', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/memory/stats')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.data.totalMemories).toBe(2);
      expect(res.body.data.completedMemories).toBe(2);
      expect(res.body.data.categoryDistribution.PERSONAL).toBe(1);
      expect(res.body.data.categoryDistribution.PROJECT).toBe(1);
    });

    it('should return supported memory categories and importances', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/memory/categories')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.data.categories).toHaveLength(8);
      expect(res.body.data.importances).toEqual(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
    });
  });
});
