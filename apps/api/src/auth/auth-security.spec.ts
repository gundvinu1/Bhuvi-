import { validate } from 'class-validator';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { InMemoryUsersRepository } from '../users/users.repository';
import { UsersService } from '../users/users.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ConfigService } from '@nestjs/config';
import authConfig from '../config/auth.config';

describe('Auth Security Verification', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Repository Safeguards', () => {
    it('InMemoryUsersRepository must throw fatal error in production mode', () => {
      process.env['NODE_ENV'] = 'production';

      expect(() => new InMemoryUsersRepository()).toThrow(
        /SECURITY VIOLATION: InMemoryUsersRepository cannot be used in production mode/i,
      );
    });

    it('InMemoryUsersRepository initializes with warning in development mode', () => {
      process.env['NODE_ENV'] = 'development';
      expect(() => new InMemoryUsersRepository()).not.toThrow();
    });

    it('authConfig must throw error if AUTH_DEV_MODE is true in production', () => {
      process.env['NODE_ENV'] = 'production';
      process.env['AUTH_DEV_MODE'] = 'true';
      process.env['JWT_SECRET'] = 'a_very_long_valid_jwt_secret_with_more_than_32_characters!';

      expect(() => authConfig()).toThrow(
        /AUTH_DEV_MODE cannot be enabled in production environment/i,
      );
    });
  });

  describe('JWT and Secret Safeguards', () => {
    it('authConfig must throw error in production if JWT_SECRET is missing or empty', () => {
      process.env['NODE_ENV'] = 'production';
      delete process.env['JWT_SECRET'];

      expect(() => authConfig()).toThrow(
        /FATAL CONFIGURATION ERROR: JWT_SECRET must be configured/i,
      );
    });

    it('authConfig must throw error in production if JWT_SECRET is shorter than 32 characters', () => {
      process.env['NODE_ENV'] = 'production';
      process.env['JWT_SECRET'] = 'short_insecure_secret';

      expect(() => authConfig()).toThrow(
        /at least 32 characters long in production/i,
      );
    });

    it('authConfig must throw error in production if JWT_SECRET contains insecure placeholder words', () => {
      process.env['NODE_ENV'] = 'production';
      process.env['JWT_SECRET'] = 'change_this_secret_value_for_production_use_1234';

      expect(() => authConfig()).toThrow(
        /Insecure or placeholder JWT_SECRET detected/i,
      );
    });

    it('JwtStrategy must fail if auth.jwtSecret is not provided by ConfigService', () => {
      const mockConfigService = {
        get: jest.fn().mockReturnValue(null),
      } as unknown as ConfigService;

      const mockUsersService = {} as unknown as UsersService;

      expect(() => new JwtStrategy(mockConfigService, mockUsersService)).toThrow(
        /FATAL: auth.jwtSecret configuration is required for JwtStrategy/i,
      );
    });
  });

  describe('Input Validation & Password Complexity', () => {
    it('RegisterDto should reject weak passwords lacking required character classes', async () => {
      const dto = new RegisterDto();
      dto.name = 'Vinayak';
      dto.email = 'vinayak@example.com';
      dto.password = 'lowercaseonly';

      const errors = await validate(dto);
      const passwordError = errors.find((e) => e.property === 'password');
      expect(passwordError).toBeDefined();
    });

    it('RegisterDto should reject passwords shorter than 8 characters', async () => {
      const dto = new RegisterDto();
      dto.name = 'Vinayak';
      dto.email = 'vinayak@example.com';
      dto.password = 'Sh0rt!';

      const errors = await validate(dto);
      const passwordError = errors.find((e) => e.property === 'password');
      expect(passwordError).toBeDefined();
    });

    it('RegisterDto should reject invalid email formats', async () => {
      const dto = new RegisterDto();
      dto.name = 'Vinayak';
      dto.email = 'not-an-email';
      dto.password = 'ValidPassword123!';

      const errors = await validate(dto);
      const emailError = errors.find((e) => e.property === 'email');
      expect(emailError).toBeDefined();
    });

    it('RegisterDto should reject empty required fields', async () => {
      const dto = new RegisterDto();
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThanOrEqual(3);
    });

    it('RegisterDto should pass for valid, strong credentials', async () => {
      const dto = new RegisterDto();
      dto.name = 'Vinayak';
      dto.email = 'vinayak@example.com';
      dto.password = 'StrongP@ssw0rd2026!';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('LoginDto should reject invalid email format', async () => {
      const dto = new LoginDto();
      dto.email = 'invalid-email-string';
      dto.password = 'SomePassword123!';

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'email')).toBe(true);
    });
  });
});
