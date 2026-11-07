# BHUVI – Database Architecture (Module 03)

## 1. Overview & Architectural Principles

BHUVI employs a **local-first, PostgreSQL-backed** relational storage architecture mediated by **Prisma ORM**.
All database logic is strictly isolated in the dedicated monorepo package `@bhuvi/database`, exposing standard NestJS services and domain models to backend applications.

```
┌─────────────────────────────────────────────────────────────┐
│                      API Layer (NestJS)                     │
│        AuthController           HealthController            │
│               │                         │                   │
│               ▼                         ▼                   │
│          UsersService             HealthService             │
│               │                         │                   │
│               ▼                         ▼                   │
│    IUsersRepository (Interface)         │                   │
│               │                         │                   │
│               ▼                         │                   │
│      PrismaUsersRepository              │                   │
├───────────────┼─────────────────────────┼───────────────────┤
│               ▼                         ▼                   │
│       PrismaService (packages/database)                     │
│               │                                             │
│               ▼                                             │
│         Prisma Client (ORM query engine)                    │
├─────────────────────────────────────────────────────────────┤
│               ▼                                             │
│       PostgreSQL 16 Database Server                         │
│       - Port: 5432                                          │
│       - Database: bhuvi                                     │
│       - Persistent Volume: postgres_data                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Package Isolation: `@bhuvi/database`

To avoid code duplication and circular dependencies, all database responsibilities are centralized:

- **Prisma Schema (`prisma/schema.prisma`):** Single source of truth for the database schema.
- **Prisma Migrations (`prisma/migrations/`):** Version-controlled SQL migration scripts.
- **`PrismaService` (`src/prisma.service.ts`):** NestJS service managing lifecycle (`onModuleInit`, `onModuleDestroy`, `isHealthy`).
- **`PrismaModule` (`src/prisma.module.ts`):** `@Global()` NestJS module exporting `PrismaService`.
- **Sanitized Config (`src/database.config.ts`):** Utilities parsing database URLs without leaking credentials in logs.

---

## 3. Schema Design: `User` Model

```prisma
model User {
  id           String   @id @default(uuid())
  name         String
  email        String   @unique
  passwordHash String   @map("password_hash")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  @@index([email])
  @@map("users")
}
```

### Table & Column Mapping

- Table name is explicitly mapped to snake_case `"users"`.
- Column names are mapped to snake_case (`password_hash`, `created_at`, `updated_at`) conforming to PostgreSQL conventions.
- Field types match domain types in `@bhuvi/shared`:
  - `id`: UUID string (`TEXT NOT NULL PRIMARY KEY`).
  - `email`: Normalized unique lowercase string.
  - `passwordHash`: Bcrypt hash string.
  - `createdAt` / `updatedAt`: Timestamps with microsecond precision.

---

## 4. Repository Abstraction & Swapping

`PrismaUsersRepository` implements `IUsersRepository` without changing consumers (`AuthService`, `UsersService`):

```typescript
export interface IUsersRepository {
  create(data: CreateUserData): Promise<User>;
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
}
```

In `UsersModule`, dependency injection resolves `USERS_REPOSITORY` to `PrismaUsersRepository` for production and normal persistent operation. If `AUTH_DEV_MODE=true` is explicitly set in development/unit test mode, it safely falls back to `InMemoryUsersRepository`.
