import { Inject, Injectable } from '@nestjs/common';
import { IUsersRepository, USERS_REPOSITORY } from './users.repository';
import { User } from './interfaces/user.interface';
import { SafeUser } from '@bhuvi/shared';

@Injectable()
export class UsersService {
  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: IUsersRepository,
  ) {}

  async create(name: string, email: string, passwordHash: string): Promise<User> {
    return this.usersRepository.create({
      name,
      email,
      passwordHash,
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findById(id);
  }

  /**
   * Transforms a User entity into a safe, client-facing profile.
   * Strips passwordHash and guarantees sensitive fields never leak.
   */
  toSafeUser(user: User): SafeUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
