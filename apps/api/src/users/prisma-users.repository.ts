import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { PrismaService, Prisma } from '@bhuvi/database';
import { IUsersRepository } from './users.repository';
import { User } from './interfaces/user.interface';
import { CreateUserData } from './users.types';

@Injectable()
export class PrismaUsersRepository implements IUsersRepository {
  private readonly logger = new Logger(PrismaUsersRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateUserData): Promise<User> {
    const normalizedEmail = data.email.toLowerCase().trim();

    try {
      const created = await this.prisma.user.create({
        data: {
          name: data.name.trim(),
          email: normalizedEmail,
          passwordHash: data.passwordHash,
        },
      });

      return this.mapToDomain(created);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // P2002: Unique constraint failed on target field(s)
        if (error.code === 'P2002') {
          throw new ConflictException('A user with this email address already exists');
        }
      }

      this.logger.error(
        `Failed to create user in PostgreSQL database: ${normalizedEmail}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = email.toLowerCase().trim();

    try {
      const record = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      return record ? this.mapToDomain(record) : null;
    } catch (error: unknown) {
      this.logger.error(
        `Database query failed during findByEmail: ${normalizedEmail}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async findById(id: string): Promise<User | null> {
    try {
      const record = await this.prisma.user.findUnique({
        where: { id },
      });

      return record ? this.mapToDomain(record) : null;
    } catch (error: unknown) {
      this.logger.error(
        `Database query failed during findById: ${id}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  private mapToDomain(record: {
    id: string;
    email: string;
    name: string;
    passwordHash: string;
    createdAt: Date;
    updatedAt: Date;
  }): User {
    return {
      id: record.id,
      email: record.email,
      name: record.name,
      passwordHash: record.passwordHash,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
