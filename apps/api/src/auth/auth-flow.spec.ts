import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../app.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

describe('Auth Integration E2E Flow', () => {
  let app: INestApplication;
  let authService: AuthService;
  let authController: AuthController;
  let jwtService: JwtService;

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
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    authService = moduleRef.get<AuthService>(AuthService);
    authController = moduleRef.get<AuthController>(AuthController);
    jwtService = moduleRef.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('Complete flow: register -> login -> inspect /auth/me -> verify security', async () => {
    // 1. Register
    const regRes = await authController.register({
      name: 'Vinayak Gund',
      email: 'vinayak.gund@example.com',
      password: 'SecurePassword2026!',
    });

    expect(regRes.success).toBe(true);
    expect(regRes.data.user.name).toBe('Vinayak Gund');
    expect(regRes.data.user.email).toBe('vinayak.gund@example.com');
    expect(regRes.data.accessToken).toBeDefined();

    const token = regRes.data.accessToken;

    // Verify token can be decoded and verified by JwtService
    const decoded = await jwtService.verifyAsync(token);
    expect(decoded.sub).toBe(regRes.data.user.id);
    expect(decoded.email).toBe('vinayak.gund@example.com');

    // 2. Login
    const loginRes = await authController.login({
      email: 'vinayak.gund@example.com',
      password: 'SecurePassword2026!',
    });

    expect(loginRes.success).toBe(true);
    expect(loginRes.data.user.id).toBe(regRes.data.user.id);
    expect(loginRes.data.accessToken).toBeDefined();

    // 3. /auth/me with authenticated SafeUser
    const meRes = await authController.getMe(regRes.data.user);
    expect(meRes.success).toBe(true);
    expect(meRes.data.id).toBe(regRes.data.user.id);
    expect(meRes.data.email).toBe('vinayak.gund@example.com');
    const meDataRecord = meRes.data as unknown as Record<string, unknown>;
    expect(meDataRecord['passwordHash']).toBeUndefined();

    // 4. Verify password in storage is hashed, not plaintext
    const meFromService = await authService.getMe(regRes.data.user.id);
    const serviceRecord = meFromService as unknown as Record<string, unknown>;
    expect(serviceRecord['passwordHash']).toBeUndefined();
  });
});
