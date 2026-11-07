import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { InMemoryUsersRepository, USERS_REPOSITORY } from './users.repository';

describe('UsersService', () => {
  let service: UsersService;
  let repository: InMemoryUsersRepository;

  beforeEach(async () => {
    repository = new InMemoryUsersRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: USERS_REPOSITORY,
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    repository.clear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a user and retrieve by email and id', async () => {
    const user = await service.create('Vinayak', 'vinayak@example.com', 'hashed_pass_123');
    expect(user.id).toBeDefined();
    expect(user.email).toBe('vinayak@example.com');
    expect(user.name).toBe('Vinayak');
    expect(user.passwordHash).toBe('hashed_pass_123');

    const byEmail = await service.findByEmail('vinayak@example.com');
    expect(byEmail).toBeDefined();
    expect(byEmail?.id).toBe(user.id);

    const byId = await service.findById(user.id);
    expect(byId).toBeDefined();
    expect(byId?.email).toBe('vinayak@example.com');
  });

  it('should normalize emails when looking up or creating', async () => {
    await service.create('Vinayak', '  VINAYAK@example.COM  ', 'hashed');
    const found = await service.findByEmail('vinayak@example.com');
    expect(found).toBeDefined();
    expect(found?.email).toBe('vinayak@example.com');
  });

  it('toSafeUser should strictly strip passwordHash', async () => {
    const user = await service.create('Vinayak', 'vinayak@example.com', '$2a$10$supersecretpasswordhash');
    const safeUser = service.toSafeUser(user);

    const record = safeUser as unknown as Record<string, unknown>;
    expect(record['passwordHash']).toBeUndefined();
    expect(record['password']).toBeUndefined();
    expect(safeUser.id).toBe(user.id);
    expect(safeUser.email).toBe('vinayak@example.com');
    expect(safeUser.name).toBe('Vinayak');
    expect(typeof safeUser.createdAt).toBe('string');
  });
});
