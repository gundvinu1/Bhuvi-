import { ConflictException } from '@nestjs/common';
import { PrismaUsersRepository } from './prisma-users.repository';
import { PrismaService, Prisma } from '@bhuvi/database';

describe('PrismaUsersRepository', () => {
  let repository: PrismaUsersRepository;
  let mockPrisma: {
    user: {
      create: jest.Mock;
      findUnique: jest.Mock;
    };
  };

  beforeEach(() => {
    mockPrisma = {
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
    };
    repository = new PrismaUsersRepository(mockPrisma as unknown as PrismaService);
  });

  const mockDate = new Date('2026-11-07T10:00:00.000Z');
  const sampleUser = {
    id: 'usr-12345',
    name: 'Vinayak Gund',
    email: 'vinayak@example.com',
    passwordHash: '$2a$10$hashedPasswordStringHere',
    createdAt: mockDate,
    updatedAt: mockDate,
  };

  describe('create', () => {
    it('should create and return mapped domain user', async () => {
      mockPrisma.user.create.mockResolvedValue(sampleUser);

      const result = await repository.create({
        name: 'Vinayak Gund',
        email: 'VINAYAK@example.com',
        passwordHash: '$2a$10$hashedPasswordStringHere',
      });

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          name: 'Vinayak Gund',
          email: 'vinayak@example.com',
          passwordHash: '$2a$10$hashedPasswordStringHere',
        },
      });

      expect(result).toEqual({
        id: sampleUser.id,
        name: sampleUser.name,
        email: sampleUser.email,
        passwordHash: sampleUser.passwordHash,
        createdAt: mockDate,
        updatedAt: mockDate,
      });
    });

    it('should throw ConflictException on Prisma unique constraint violation (P2002)', async () => {
      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`email`)',
        {
          code: 'P2002',
          clientVersion: '5.22.0',
        },
      );

      mockPrisma.user.create.mockRejectedValue(p2002Error);

      await expect(
        repository.create({
          name: 'Duplicate',
          email: 'vinayak@example.com',
          passwordHash: 'hash',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should rethrow unknown database errors', async () => {
      const dbError = new Error('Database connection failed');
      mockPrisma.user.create.mockRejectedValue(dbError);

      await expect(
        repository.create({
          name: 'Error',
          email: 'error@example.com',
          passwordHash: 'hash',
        }),
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('findByEmail', () => {
    it('should find user with normalized email address', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(sampleUser);

      const result = await repository.findByEmail('  VINAYAK@EXAMPLE.COM  ');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'vinayak@example.com' },
      });
      expect(result?.email).toBe('vinayak@example.com');
    });

    it('should return null if user is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await repository.findByEmail('notfound@example.com');
      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should find user by id and map to domain entity', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(sampleUser);

      const result = await repository.findById('usr-12345');
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'usr-12345' },
      });
      expect(result?.id).toBe('usr-12345');
    });

    it('should return null if user with id does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await repository.findById('nonexistent');
      expect(result).toBeNull();
    });
  });
});
