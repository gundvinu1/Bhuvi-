import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { AppModule } from '../app.module';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';

describe('Auth Rate Limiting Security', () => {
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
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should allow up to 5 login requests and block the 6th with HTTP 429 Too Many Requests', async () => {
    const payload = {
      email: 'ratelimit@example.com',
      password: 'SomePassword123!',
    };

    // 5 attempts allowed by the throttle limit
    for (let i = 0; i < 5; i++) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send(payload);

      // Status will be 401 because credentials don't exist, but NOT 429
      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    }

    // 6th attempt MUST be blocked by ThrottlerGuard
    const throttledRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send(payload);

    expect(throttledRes.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(throttledRes.body.success).toBe(false);
    expect(throttledRes.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});
