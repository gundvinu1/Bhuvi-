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
| Ollama (Local AI)         | >= 0.1.0                | [ollama.com](https://ollama.com)     |

---

### Local AI Model Setup (Ollama)

BHUVI uses Ollama to run local Large Language Models without requiring paid cloud APIs.

```powershell
# 1. Verify Ollama installation
ollama --version

# 2. Check installed models
ollama list

# 3. Pull recommended lightweight model (qwen2.5:3b, ~1.9 GB)
ollama pull qwen2.5:3b

# 4. (Optional) Pull alternative fallback model (llama3.2:3b, ~2.0 GB)
ollama pull llama3.2:3b

# 5. Start Ollama server (if not already running as a Windows service)
ollama serve

# 6. Test direct model inference
ollama run qwen2.5:3b "Hello BHUVI!"
```

#### Ollama Troubleshooting on Windows 11

- **Port in use (`bind: Only one usage of each socket address is normally permitted`):**
  Ollama is already running as a Windows background service. Verify with:
  ```powershell
  curl http://127.0.0.1:11434/api/tags
  ```
- **Model not found (`404 Not Found: model 'qwen2.5:3b' not found`):**
  Pull the model explicitly using `ollama pull qwen2.5:3b`.
- **Request timeouts on cold start:**
  The first request loads the model into GPU/RAM. Subsequent warm requests respond within 1-2 seconds. The API has a built-in 60s timeout guard.

---

### Environment Setup

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
pnpm format:check    # Verify Prettier code formatting
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
- **Module 04: Application Dashboard:** COMPLETE (Central AI OS interface, collapsible sidebar & drawer, personalized greeting, honest metric placeholders, /auth/me profile, live /health telemetry)
- **Module 05: AI Brain & Model Integration:** COMPLETE (Local Ollama integration at `127.0.0.1:11434`, `qwen2.5:3b` model, live conversational assistant panel, rate-limited & concurrency-guarded `/api/v1/ai/chat`, standardized `{ "message": "..." }` contract, zero paid APIs)
- **Module 06: AI Agent Orchestrator:** COMPLETE (Multi-agent orchestration pipeline, 4 logical agents: Planning, Research, Communication, Task; topological cycle resolution, human approval boundary, PostgreSQL persistence, `/dashboard/orchestrator` console, worker execution)
- **Module 07: Message Intelligence Engine:** COMPLETE (Message classification across 10 categories, priority & urgency detection, action item extraction, duplicate detection, prompt injection defense, `/dashboard/messages` UI, background worker integration)
