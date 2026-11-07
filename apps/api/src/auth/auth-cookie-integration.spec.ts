import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { ConfigModule } from '@nestjs/config';
import { AppModule } from '../app.module';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';

describe('Auth Cookie & Dual-Transport Integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
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
  });

  afterAll(async () => {
    await app.close();
  });

  const testUser = {
    name: 'Audit User',
    email: 'audit.tester@example.com',
    password: 'SecureAuditPassword123!',
  };

  let extractedCookie: string;
  let extractedToken: string;

  it('1. POST /api/v1/auth/register should set HttpOnly bhuvi_token cookie and return user payload', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/auth/register').send(testUser);

    expect(res.status).toBe(HttpStatus.CREATED);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testUser.email.toLowerCase());
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.accessToken).toBeDefined();

    extractedToken = res.body.data.accessToken;

    // Verify Set-Cookie header
    const rawCookies = res.headers['set-cookie'];
    expect(rawCookies).toBeDefined();
    const cookies = Array.isArray(rawCookies) ? rawCookies : [rawCookies as string];
    const bhuviCookie = cookies.find((c) => c.startsWith('bhuvi_token='));
    expect(bhuviCookie).toBeDefined();
    expect(bhuviCookie).toMatch(/HttpOnly/i);
    expect(bhuviCookie).toMatch(/SameSite=Lax/i);
    expect(bhuviCookie).toMatch(/Path=\//i);

    // Save cookie for subsequent requests
    extractedCookie = bhuviCookie!.split(';')[0];
  });

  it('2. GET /api/v1/auth/me should succeed using HttpOnly Cookie', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', [extractedCookie]);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(testUser.email.toLowerCase());
    expect(res.body.data.name).toBe(testUser.name);
  });

  it('3. GET /api/v1/auth/me should succeed using Bearer token header (dual transport)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${extractedToken}`);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(testUser.email.toLowerCase());
  });

  it('4. GET /api/v1/auth/me should reject unauthenticated requests without credentials', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/auth/me');

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    expect(res.body.success).toBe(false);
  });

  it('5. POST /api/v1/auth/logout should clear bhuvi_token cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', [extractedCookie]);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.success).toBe(true);

    const rawCookies = res.headers['set-cookie'];
    expect(rawCookies).toBeDefined();
    const cookies = Array.isArray(rawCookies) ? rawCookies : [rawCookies as string];
    const clearedCookie = cookies.find((c) => c.startsWith('bhuvi_token='));
    expect(clearedCookie).toBeDefined();
    // In express, res.clearCookie sets expires to epoch or max-age=0
    expect(clearedCookie).toMatch(/Expires=|Max-Age=0/i);
  });

  it('6. POST /api/v1/auth/login should re-issue HttpOnly cookie upon valid credentials', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: testUser.email,
      password: testUser.password,
    });

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testUser.email.toLowerCase());

    const rawCookies = res.headers['set-cookie'];
    expect(rawCookies).toBeDefined();
    const cookies = Array.isArray(rawCookies) ? rawCookies : [rawCookies as string];
    const bhuviCookie = cookies.find((c) => c.startsWith('bhuvi_token='));
    expect(bhuviCookie).toBeDefined();
    expect(bhuviCookie).toMatch(/HttpOnly/i);
  });
});
