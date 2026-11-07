# BHUVI – Database Migrations Guide

## 1. Migration History

### Migration 1: `20261107000000_init_user`

- **Date:** 2026-11-07
- **Target Table:** `users`
- **Changes:**
  - Creates the `users` table with UUID primary key.
  - Adds unique constraint and index on `email`.
  - Sets default timestamp on `created_at` and triggers on `updated_at`.

SQL Reference:

```sql
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_email_idx" ON "users"("email");
```

---

## 2. Creating New Migrations

When modifying `packages/database/prisma/schema.prisma` in future modules:

1. Update the Prisma schema with the new entity or field.
2. Ensure PostgreSQL is running (`docker compose up -d postgres`).
3. Run migration creation:
   ```powershell
   pnpm db:migrate
   ```
4. Prisma will prompt for a migration name (e.g., `add_messages_table`), generate SQL in `packages/database/prisma/migrations/<timestamp>_<name>/migration.sql`, apply it, and re-generate the Prisma Client.

---

## 3. Production Deployment Migrations

In production environments (e.g. CI/CD or staging containers), run:

```powershell
pnpm db:deploy
```

This applies all pending migrations from the version-controlled `prisma/migrations/` directory without prompting or resetting data.
