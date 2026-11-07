# BHUVI – Module 03: Database & Infrastructure Foundation

## 1. Overview

Module 03 establishes the persistent relational database, queue messaging, and background processing foundation for **BHUVI (Brain for Human Virtual Intelligence)**.

All subsequent modules (AI model orchestration, message ingestion, memory storage, action execution) rely on the database and queue contracts established here.

---

## 2. Key Accomplishments

### 1. Dedicated Database Package (`@bhuvi/database`)

- Implemented `packages/database` configured with Prisma ORM 5.22.
- Created `schema.prisma` mapping the `User` model to PostgreSQL table `"users"`.
- Created initial SQL migration `20261107000000_init_user`.
- Built `PrismaService` extending `PrismaClient` with connection lifecycle management (`onModuleInit`, `onModuleDestroy`) and health pinging (`isHealthy()`).
- Exported globally scoped `PrismaModule`.

### 2. Persistent User Repository (`PrismaUsersRepository`)

- Implemented `PrismaUsersRepository` in `apps/api/src/users/prisma-users.repository.ts`.
- Satisfies `IUsersRepository` contract.
- Handles Prisma `P2002` unique constraint errors, mapping them to `ConflictException`.
- Maps database records to domain `User` entities while guaranteeing `passwordHash` is never exposed.
- Integrated into `UsersModule` dependency injection for production and standard persistent execution.

### 3. Reusable Queue Foundation (`@bhuvi/queue`)

- Created `packages/queue` wrapping **BullMQ** (v5) and **ioredis** (v5).
- Standardized default queue name: `bhuvi-default`.
- Defined `infrastructure-check` job contract (`InfrastructureCheckPayload`, `InfrastructureCheckResult`).
- Sanitized Redis configuration parsing to prevent password leaks in telemetry and logs.

### 4. Worker Integration (`apps/worker`)

- Enhanced `BhuviWorker` to initialize BullMQ worker listening on `bhuvi-default`.
- Implemented handler for `infrastructure-check` jobs.
- Implemented duplicate start prevention.
- Added graceful shutdown handlers closing BullMQ worker and Redis connections.

### 5. Dependency-Aware Health Checks (`GET /api/v1/health`)

- Extended `HealthService` and `HealthController` to probe real connectivity to:
  - `postgres`: Active roundtrip ping via `prismaService.isHealthy()`.
  - `redis`: Active ping with 1.5s timeout via `ioredis`.
- Reports accurate status (`healthy`, `degraded`, `unhealthy`) without exposing credentials.

---

## 3. Environment & Local Infrastructure

```env
# Database
DATABASE_URL=postgresql://bhuvi:bhuvi_dev_password@localhost:5432/bhuvi

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_URL=redis://localhost:6379

# Authentication Dev Mode
# Set to false to enforce live PostgreSQL database via Prisma (required in production).
AUTH_DEV_MODE=true
```

---

## 4. Host Environment Transparency (Windows 11)

- **Docker Status on Host:** Docker Desktop CLI (`docker`, `docker compose`) is not currently installed or in the system PATH on this Windows 11 host.
- **Support Provided:**
  - Complete Docker Compose configuration provided at `infrastructure/docker/docker-compose.yml`.
  - PowerShell automation scripts provided at `infrastructure/scripts/start-infrastructure.ps1`.
  - Alternative native setup guides provided for PostgreSQL and Redis (Memurai / WSL2).
  - Unit tests use realistic mocks and in-memory test drivers to guarantee 100% test coverage and CI reliability without requiring external daemon dependencies.
