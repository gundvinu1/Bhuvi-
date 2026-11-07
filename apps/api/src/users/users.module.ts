import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '@bhuvi/database';
import { UsersService } from './users.service';
import { InMemoryUsersRepository, USERS_REPOSITORY } from './users.repository';
import { PrismaUsersRepository } from './prisma-users.repository';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [
    UsersService,
    PrismaUsersRepository,
    InMemoryUsersRepository,
    {
      provide: USERS_REPOSITORY,
      useFactory: (configService: ConfigService, prismaRepo: PrismaUsersRepository) => {
        const isProd = (process.env['NODE_ENV'] ?? 'development') === 'production';
        const rawDevMode = configService.get<string>('AUTH_DEV_MODE') ?? process.env['AUTH_DEV_MODE'];
        const configDevMode = configService.get<boolean>('auth.authDevMode');
        const authDevMode = !isProd && (configDevMode !== undefined ? configDevMode : rawDevMode !== 'false');

        // In production or when AUTH_DEV_MODE=false, persistent PostgreSQL storage is required
        if (isProd || !authDevMode) {
          return prismaRepo;
        }

        // Test/isolated development adapter when explicitly active in non-production
        return new InMemoryUsersRepository();
      },
      inject: [ConfigService, PrismaUsersRepository],
    },
  ],
  exports: [UsersService, USERS_REPOSITORY, PrismaUsersRepository],
})
export class UsersModule {}
