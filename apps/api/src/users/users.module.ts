import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { InMemoryUsersRepository, USERS_REPOSITORY } from './users.repository';

@Module({
  providers: [
    UsersService,
    {
      provide: USERS_REPOSITORY,
      useClass: InMemoryUsersRepository,
    },
  ],
  exports: [UsersService, USERS_REPOSITORY],
})
export class UsersModule {}
