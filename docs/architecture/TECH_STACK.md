# BHUVI – Technology Stack

## Core Technologies

### Runtime

| Technology | Version | Role                         |
| ---------- | ------- | ---------------------------- |
| Node.js    | 20+ LTS | Runtime for all services     |
| TypeScript | 5.5+    | Language (strict mode)       |
| pnpm       | 9+      | Package manager + workspaces |

### Frontend (`apps/web`)

| Technology   | Version         | Role                          |
| ------------ | --------------- | ----------------------------- |
| Next.js      | 14 (App Router) | React framework               |
| React        | 18              | UI library                    |
| Tailwind CSS | 3.4             | Utility-first styling         |
| shadcn/ui    | latest          | Component library (Module 04) |

### Backend (`apps/api`)

| Technology          | Version | Role                      |
| ------------------- | ------- | ------------------------- |
| NestJS              | 10      | API framework             |
| `@nestjs/config`    | 3       | Environment configuration |
| `class-validator`   | 0.14    | Request validation        |
| `class-transformer` | 0.5     | DTO transformation        |

### Worker (`apps/worker`)

| Technology | Version       | Role            |
| ---------- | ------------- | --------------- |
| Node.js    | 20+           | Process runtime |
| BullMQ     | _(Module 03)_ | Job queue       |

### Shared (`packages/shared`)

| Technology | Role                                   |
| ---------- | -------------------------------------- |
| TypeScript | Type definitions, utilities, constants |

## Future Technology Stack (by module)

| Module | Technology                       | Purpose                 |
| ------ | -------------------------------- | ----------------------- |
| 02     | Passport.js, JWT                 | Authentication          |
| 03     | PostgreSQL 16, Prisma 5, Redis 7 | Persistence and queuing |
| 04     | shadcn/ui, Recharts              | Dashboard components    |
| 05     | Ollama                           | Local LLM inference     |
| 05     | LangChain.js                     | AI orchestration        |
| 09     | Google APIs                      | Gmail integration       |
| 10     | WhatsApp Business API            | Messaging               |
| 13     | n8n                              | Workflow automation     |
| 16     | Whisper (via Ollama)             | Voice transcription     |
| 18     | Helmet, rate-limit               | Security hardening      |

## Tooling

| Tool                          | Purpose                   |
| ----------------------------- | ------------------------- |
| ESLint + `@typescript-eslint` | Code linting              |
| Prettier                      | Code formatting           |
| Jest                          | Unit testing              |
| `ts-jest`                     | TypeScript Jest transform |
| `ts-node`                     | Development runtime       |

## Architecture Decisions

### Why NestJS over Express?

NestJS provides opinionated, modular structure with built-in support for dependency injection, decorators, and pipes. This aligns with BHUVI's modular growth plan and reduces boilerplate as services expand.

### Why pnpm Workspaces over Turborepo?

pnpm workspaces provides sufficient monorepo capabilities for the current scale without adding a build orchestration dependency. Turborepo can be added in Module 03 if build times become an issue.

### Why local Ollama over cloud APIs?

Privacy (all data stays on-device), zero ongoing costs, and Windows compatibility without Docker dependencies for the core development flow.

### Why App Router over Pages Router?

Next.js App Router is the current direction of the framework, provides React Server Components for performance, and better aligns with PWA requirements in Module 17.
