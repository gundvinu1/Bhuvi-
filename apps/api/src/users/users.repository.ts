import { Injectable, Logger } from '@nestjs/common';
import { User } from './interfaces/user.interface';
import { CreateUserData } from './users.types';
import { randomUUID } from 'crypto';

// ============================================================
// User Repository Abstraction & Development Adapter
// ============================================================

/** Injection token for UsersRepository */
export const USERS_REPOSITORY = 'USERS_REPOSITORY';

/**
 * Storage-agnostic interface for user persistence.
 * Module 03 will provide a PrismaUsersRepository implementing this exact interface.
 */
export interface IUsersRepository {
  create(data: CreateUserData): Promise<User>;
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
}

/**
 * DEVELOPMENT-ONLY In-Memory Users Repository
 *
 * ⚠️ WARNING: NON-PRODUCTION IMPLEMENTATION
 * - Intended exclusively for local testing during Module 02.
 * - DOES NOT PERSIST DATA across application restarts.
 * - Strictly rejected if NODE_ENV === 'production'.
 * - Replaced by PostgreSQL + Prisma repository in Module 03.
 */
@Injectable()
export class InMemoryUsersRepository implements IUsersRepository {
  private readonly logger = new Logger(InMemoryUsersRepository.name);
  private readonly users = new Map<string, User>();

  constructor() {
    // Fail immediately if someone attempts to run this in production
    const isProd = process.env['NODE_ENV'] === 'production';
    if (isProd) {
      throw new Error(
        'SECURITY VIOLATION: InMemoryUsersRepository cannot be used in production mode! ' +
          'A persistent PostgreSQL database via Prisma is required (scheduled for Module 03).',
      );
    }

    this.logger.warn(
      '⚠️  [UsersRepository] Running with NON-PRODUCTION InMemoryUsersRepository. ' +
        'User data is transient and will reset upon server restart. ' +
        'Module 03 will replace this with PostgreSQL/Prisma.',
    );
  }

  async create(data: CreateUserData): Promise<User> {
    const now = new Date();
    const user: User = {
      id: randomUUID(),
      email: data.email.toLowerCase().trim(),
      name: data.name.trim(),
      passwordHash: data.passwordHash,
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(user.id, user);
    return { ...user };
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalized = email.toLowerCase().trim();
    for (const user of this.users.values()) {
      if (user.email === normalized) {
        return { ...user };
      }
    }
    return null;
  }

  async findById(id: string): Promise<User | null> {
    const user = this.users.get(id);
    if (!user) {
      return null;
    }
    return { ...user };
  }

  /**
   * Helper for unit tests only: reset repository state
   */
  clear(): void {
    this.users.clear();
  }
}

