import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { InMemoryUsersRepository, USERS_REPOSITORY } from '../users/users.repository';

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: UsersService;
  let repository: InMemoryUsersRepository;

  beforeEach(async () => {
    repository = new InMemoryUsersRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        UsersService,
        {
          provide: USERS_REPOSITORY,
          useValue: repository,
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'auth.jwtSecret') return 'test_jwt_secret_at_least_32_characters_long!';
              if (key === 'auth.jwtExpiresIn') return '15m';
              return null;
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('mocked_jwt_token_header.payload.signature'),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    repository.clear();
  });

  describe('Registration', () => {
    it('should successfully register a new user', async () => {
      const result = await authService.register({
        name: 'Vinayak',
        email: 'vinayak@example.com',
        password: 'StrongPassword123!',
      });

      expect(result).toBeDefined();
      expect(result.accessToken).toBe('mocked_jwt_token_header.payload.signature');
      expect(result.expiresIn).toBe('15m');
      expect(result.user).toBeDefined();
      expect(result.user.name).toBe('Vinayak');
      expect(result.user.email).toBe('vinayak@example.com');
      const userRecord = result.user as unknown as Record<string, unknown>;
      expect(userRecord['password']).toBeUndefined();
      expect(userRecord['passwordHash']).toBeUndefined();
    });

    it('should hash the password before saving and never store plaintext', async () => {
      const plaintextPassword = 'StrongPassword123!';
      await authService.register({
        name: 'Vinayak',
        email: 'vinayak@example.com',
        password: plaintextPassword,
      });

      const savedUser = await usersService.findByEmail('vinayak@example.com');
      expect(savedUser).toBeDefined();
      expect(savedUser!.passwordHash).not.toBe(plaintextPassword);
      // Valid bcrypt hash starts with $2a$ or $2b$
      expect(savedUser!.passwordHash.startsWith('$2')).toBe(true);

      const isValidHash = await bcrypt.compare(plaintextPassword, savedUser!.passwordHash);
      expect(isValidHash).toBe(true);
    });

    it('should reject duplicate email registrations with ConflictException', async () => {
      await authService.register({
        name: 'Vinayak',
        email: 'vinayak@example.com',
        password: 'StrongPassword123!',
      });

      await expect(
        authService.register({
          name: 'Another Vinayak',
          email: 'vinayak@example.com',
          password: 'AnotherPassword456!',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should normalize email before checking duplicates and creating', async () => {
      await authService.register({
        name: 'Vinayak',
        email: 'vinayak@example.com',
        password: 'StrongPassword123!',
      });

      await expect(
        authService.register({
          name: 'Vinayak Space',
          email: '  VINAYAK@EXAMPLE.COM  ',
          password: 'Password999!',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Login', () => {
    beforeEach(async () => {
      await authService.register({
        name: 'Vinayak',
        email: 'vinayak@example.com',
        password: 'StrongPassword123!',
      });
    });

    it('should successfully log in with correct credentials', async () => {
      const result = await authService.login({
        email: 'vinayak@example.com',
        password: 'StrongPassword123!',
      });

      expect(result).toBeDefined();
      expect(result.accessToken).toBe('mocked_jwt_token_header.payload.signature');
      expect(result.user.email).toBe('vinayak@example.com');
      const userRecord = result.user as unknown as Record<string, unknown>;
      expect(userRecord['passwordHash']).toBeUndefined();
    });

    it('should reject incorrect password with generic error message', async () => {
      await expect(
        authService.login({
          email: 'vinayak@example.com',
          password: 'WrongPassword123!',
        }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    });

    it('should reject unknown email with identical generic error message to prevent enumeration', async () => {
      await expect(
        authService.login({
          email: 'nonexistent@example.com',
          password: 'AnyPassword123!',
        }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    });
  });

  describe('getMe', () => {
    it('should retrieve safe profile for existing user', async () => {
      const reg = await authService.register({
        name: 'Vinayak',
        email: 'vinayak@example.com',
        password: 'StrongPassword123!',
      });

      const me = await authService.getMe(reg.user.id);
      expect(me.id).toBe(reg.user.id);
      expect(me.email).toBe('vinayak@example.com');
      const meRecord = me as unknown as Record<string, unknown>;
      expect(meRecord['passwordHash']).toBeUndefined();
    });

    it('should throw UnauthorizedException if user no longer exists', async () => {
      await expect(authService.getMe('non-existent-user-id')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
