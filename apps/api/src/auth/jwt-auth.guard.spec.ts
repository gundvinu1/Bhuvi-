import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SafeUser } from '@bhuvi/shared';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  const mockSafeUser: SafeUser = {
    id: 'user-uuid-1',
    email: 'user@example.com',
    name: 'Test User',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    guard = new JwtAuthGuard();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should return user when authentication succeeds', () => {
    const user = guard.handleRequest(null, mockSafeUser, null);
    expect(user).toEqual(mockSafeUser);
  });

  it('should throw UnauthorizedException when token is missing', () => {
    expect(() => guard.handleRequest(null, false as unknown as SafeUser, null)).toThrow(
      new UnauthorizedException('Authentication required: missing or invalid bearer token'),
    );
  });

  it('should throw UnauthorizedException when token is expired', () => {
    const expiredError = new Error('jwt expired');
    expiredError.name = 'TokenExpiredError';

    expect(() => guard.handleRequest(null, false as unknown as SafeUser, expiredError)).toThrow(
      new UnauthorizedException('Token has expired'),
    );
  });

  it('should throw UnauthorizedException when token signature is invalid', () => {
    const invalidError = new Error('invalid signature');
    invalidError.name = 'JsonWebTokenError';

    expect(() => guard.handleRequest(null, false as unknown as SafeUser, invalidError)).toThrow(
      new UnauthorizedException('Invalid authentication token'),
    );
  });

  it('should propagate explicit UnauthorizedExceptions', () => {
    const customError = new UnauthorizedException('Custom auth error');
    expect(() => guard.handleRequest(customError, false as unknown as SafeUser, null)).toThrow(
      customError,
    );
  });
});

