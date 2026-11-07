import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';
import { InMemoryUsersRepository, USERS_REPOSITORY } from './users.repository';

@Module({
  imports: [ConfigModule],
  providers: [
    UsersService,
    {
      provide: USERS_REPOSITORY,
      useFactory: (configService: ConfigService) => {
        const isProd = (process.env['NODE_ENV'] ?? 'development') === 'production';
        const authDevMode = configService.get<boolean>('auth.authDevMode') ?? !isProd;

        if (isProd || !authDevMode) {
          throw new Error(
            'SECURITY VIOLATION: InMemoryUsersRepository cannot be used in production mode or when AUTH_DEV_MODE=false! ' +
              'A persistent PostgreSQL database via Prisma is required (scheduled for Module 03).',
          );
        }

        return new InMemoryUsersRepository();
      },
      inject: [ConfigService],
    },
  ],
  exports: [UsersService, USERS_REPOSITORY],
})
export class UsersModule {}
