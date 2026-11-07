# BHUVI – Brain for Human Virtual Intelligence

> A modular, local-first Personal AI Operating System designed to run on a local machine without requiring paid cloud APIs or VPS hosting.

---

## What is BHUVI?

BHUVI is your personal AI brain. It monitors your communications, understands context, executes approved tasks, and surfaces actionable intelligence — running locally on your hardware.

---

## Architecture Overview

```
BHUVI/
├── apps/
│   ├── web/                     # Next.js 14 App Router frontend
│   ├── api/                     # NestJS 10 REST API backend (/api/v1)
│   └── worker/                  # Node.js + BullMQ queue worker
├── packages/
│   ├── database/                # Prisma 5 ORM, schema, migrations, PrismaService
│   ├── queue/                   # BullMQ 5 & Redis connection management
│   └── shared/                  # Universal TypeScript types, DTOs, constants
├── infrastructure/
│   ├── docker/                  # Docker Compose configuration (PostgreSQL 16, Redis 7)
│   └── scripts/                 # PowerShell automation scripts
└── docs/                        # Architecture, API, security, and setup documentation
```

---

## Quick Start

### Prerequisites

| Tool                      | Minimum Version         | Reference                            |
| ------------------------- | ----------------------- | ------------------------------------ |
| Node.js                   | >= 20.0.0               | [nodejs.org](https://nodejs.org)     |
| pnpm                      | >= 9.0.0                | [pnpm.io](https://pnpm.io)           |
| Docker Desktop (Optional) | PostgreSQL 16 & Redis 7 | [docker.com](https://www.docker.com) |

### Setup

```powershell
# 1. Install all dependencies across workspaces
pnpm install

# 2. Configure environment
Copy-Item .env.example .env

# 3. Generate Prisma client
pnpm db:generate

# 4. Start infrastructure (if Docker Desktop is installed)
.\infrastructure\scripts\start-infrastructure.ps1

# 5. Apply migrations
pnpm db:deploy
```

### Useful Root Commands

```powershell
pnpm dev             # Run web, api, and worker in parallel
pnpm build           # Build all packages and applications
pnpm typecheck       # Validate TypeScript strict mode across workspaces
pnpm lint            # Run ESLint across monorepo
pnpm test            # Run all automated unit and integration tests
pnpm db:generate     # Re-generate Prisma Client
pnpm db:migrate      # Create and apply new migrations
pnpm db:deploy       # Apply existing migrations
pnpm db:studio       # Launch Prisma Studio data browser
```

---

## Current Status

- **Module 01: Project Foundation & Environment Setup:** COMPLETE
- **Module 02: Authentication & User Management:** COMPLETE (Dual-transport: HttpOnly cookie + Bearer token, rate limiting)
- **Module 03: Database & Infrastructure:** COMPLETE (PostgreSQL 16, Prisma 5, Redis 7, BullMQ 5, persistent repository)
- **Module 04: Application Dashboard:** PLANNED (Awaiting authorization)
