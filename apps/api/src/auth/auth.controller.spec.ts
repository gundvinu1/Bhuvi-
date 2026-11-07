import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
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

  const mockResponse = () => {
    const res: Partial<Response> = {};
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    return res as Response;
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

  it('POST /auth/register should set HttpOnly cookie and return standardized ApiResponse', async () => {
    const resMock = mockResponse();
    const res = await controller.register(
      {
        name: 'Vinayak',
        email: 'vinayak@example.com',
        password: 'StrongPassword123!',
      },
      resMock,
    );

    expect(res.success).toBe(true);
    expect(res.data).toEqual(mockAuthResponse);
    expect(res.meta?.version).toBeDefined();
    expect(res.meta?.timestamp).toBeDefined();
    expect(authService.register).toHaveBeenCalledWith({
      name: 'Vinayak',
      email: 'vinayak@example.com',
      password: 'StrongPassword123!',
    });
    expect(resMock.cookie).toHaveBeenCalledWith(
      'bhuvi_token',
      mockAuthResponse.accessToken,
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }),
    );
  });

  it('POST /auth/login should set HttpOnly cookie and return standardized ApiResponse', async () => {
    const resMock = mockResponse();
    const res = await controller.login(
      {
        email: 'vinayak@example.com',
        password: 'StrongPassword123!',
      },
      resMock,
    );

    expect(res.success).toBe(true);
    expect(res.data).toEqual(mockAuthResponse);
    expect(authService.login).toHaveBeenCalledWith({
      email: 'vinayak@example.com',
      password: 'StrongPassword123!',
    });
    expect(resMock.cookie).toHaveBeenCalledWith(
      'bhuvi_token',
      mockAuthResponse.accessToken,
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }),
    );
  });

  it('POST /auth/logout should clear HttpOnly cookie and return confirmation', async () => {
    const resMock = mockResponse();
    const res = await controller.logout(resMock);

    expect(res.success).toBe(true);
    expect(res.data.message).toBe('Successfully signed out');
    expect(resMock.clearCookie).toHaveBeenCalledWith(
      'bhuvi_token',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }),
    );
  });

  it('GET /auth/me should return current user profile in standardized envelope', async () => {
    const res = await controller.getMe(mockSafeUser);

    expect(res.success).toBe(true);
    expect(res.data.id).toBe(mockSafeUser.id);
    expect(res.data.email).toBe(mockSafeUser.email);
    expect(authService.getMe).toHaveBeenCalledWith(mockSafeUser.id);
  });
});
