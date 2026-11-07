# BHUVI – Prisma ORM Guide

## 1. Quick Reference Commands

All database commands are available from the root of the monorepo:

```powershell
# 1. Generate Prisma Client after schema changes
pnpm db:generate

# 2. Create and apply new migrations (development mode)
pnpm db:migrate

# 3. Apply existing migrations to a production/staging database
pnpm db:deploy

# 4. Launch Prisma Studio GUI (interactive data browser on http://localhost:5555)
pnpm db:studio
```

---

## 2. Using `PrismaService` in NestJS

To access the database from any NestJS module:

1. Import `PrismaModule` into your module (or utilize its `@Global()` export).
2. Inject `PrismaService` into your service or repository constructor:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@bhuvi/database';

@Injectable()
export class ExampleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async countUsers(): Promise<number> {
    return this.prisma.user.count();
  }
}
```

---

## 3. Connection Lifecycle & Graceful Shutdown

`PrismaService` implements:
- `OnModuleInit`: Executes `$connect()` during NestJS bootstrap.
- `OnModuleDestroy`: Executes `$disconnect()` during application termination.
- `isHealthy()`: Pings PostgreSQL (`SELECT 1`) to measure latency and confirm active connectivity without leaking secrets.

---

## 4. Query Logging Conventions

In development (`NODE_ENV=development`), `PrismaService` enables structured query and error logging:
- Query events are emitted at `debug` level.
- Warnings and errors are captured via the standard NestJS logger.
In production, only error logs are output to prevent sensitive queries from entering production logs.
