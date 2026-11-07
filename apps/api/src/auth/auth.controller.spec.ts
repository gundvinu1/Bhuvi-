import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthResponseData, SafeUser } from '@bhuvi/shared';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockSafeUser: SafeUser = {
    id: 'user-uuid-1234',
    email: 'vinayak@example.com',
    name: 'Vinayak',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockAuthResponse: AuthResponseData = {
    user: mockSafeUser,
    accessToken: 'signed_jwt_token_sample',
    expiresIn: '15m',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn().mockResolvedValue(mockAuthResponse),
            login: jest.fn().mockResolvedValue(mockAuthResponse),
            getMe: jest.fn().mockResolvedValue(mockSafeUser),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('POST /auth/register should return standardized ApiResponse', async () => {
    const res = await controller.register({
      name: 'Vinayak',
      email: 'vinayak@example.com',
      password: 'StrongPassword123!',
    });

    expect(res.success).toBe(true);
    expect(res.data).toEqual(mockAuthResponse);
    expect(res.meta?.version).toBeDefined();
    expect(res.meta?.timestamp).toBeDefined();
    expect(authService.register).toHaveBeenCalledWith({
      name: 'Vinayak',
      email: 'vinayak@example.com',
      password: 'StrongPassword123!',
    });
  });

  it('POST /auth/login should return standardized ApiResponse', async () => {
    const res = await controller.login({
      email: 'vinayak@example.com',
      password: 'StrongPassword123!',
    });

    expect(res.success).toBe(true);
    expect(res.data).toEqual(mockAuthResponse);
    expect(authService.login).toHaveBeenCalledWith({
      email: 'vinayak@example.com',
      password: 'StrongPassword123!',
    });
  });

  it('GET /auth/me should return current user profile in standardized envelope', async () => {
    const res = await controller.getMe(mockSafeUser);

    expect(res.success).toBe(true);
    expect(res.data.id).toBe(mockSafeUser.id);
    expect(res.data.email).toBe(mockSafeUser.email);
    expect(authService.getMe).toHaveBeenCalledWith(mockSafeUser.id);
  });
});
