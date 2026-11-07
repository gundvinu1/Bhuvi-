# BHUVI – System Architecture

## Overview

BHUVI follows a **monorepo, event-driven, modular** architecture designed for local execution on a Windows development machine, with a clear upgrade path to production hosting in later modules.

```
┌─────────────────────────────────────────────────────────┐
│                     User Interfaces                      │
│   Web (Next.js)        Mobile PWA       Voice Input      │
└──────────────────┬──────────────────────────────────────┘
                   │ HTTP / WebSocket
┌──────────────────▼──────────────────────────────────────┐
│                   API Gateway (NestJS)                   │
│         /api/v1   Auth   Validation   Rate Limit         │
└──────┬───────────┬──────────────────────────────────────┘
       │           │
┌──────▼──────┐  ┌─▼──────────────────────────────────────┐
│   Worker    │  │            Core Services                 │
│  (BullMQ)   │  │  AI Brain  │  Memory  │  Intelligence   │
└──────┬──────┘  └─────────────────────────────────────────┘
       │
┌──────▼──────────────────────────────────────────────────┐
│                    Data Layer                            │
│   PostgreSQL (Prisma)    Redis (Cache/Queue)             │
└─────────────────────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│                 External Integrations                    │
│   Ollama (local AI)    Gmail    WhatsApp    Calendar     │
└─────────────────────────────────────────────────────────┘
```

## Design Principles

### 1. Local-First

All AI processing happens via Ollama on the local machine. No data leaves the device without explicit user approval.

### 2. Modular

Each capability is implemented as an isolated package under `packages/`. Modules have declared dependencies and can be developed and tested independently.

### 3. Event-Driven

Background work is processed through BullMQ queues (Module 03). This decouples triggers from execution and enables retry logic and prioritization.

### 4. API-First

All functionality is exposed through versioned REST endpoints (`/api/v1`). The frontend consumes the same API as any future mobile client.

### 5. Security by Default

Secrets are never hardcoded. Authentication is required for all API routes (Module 02). All integrations require explicit user approval.

## Communication Patterns

| Pattern           | Use Case             | Technology         |
| ----------------- | -------------------- | ------------------ |
| Request/Response  | UI → API             | REST HTTP          |
| Background Jobs   | Scheduled processing | BullMQ + Redis     |
| Real-time Updates | Notifications        | WebSocket (future) |
| Local AI          | LLM inference        | Ollama HTTP API    |

## Module Dependency Graph

```
01 Foundation
└── 02 Auth & Users
    └── 03 Database & Infrastructure
        ├── 04 Dashboard
        ├── 05 AI Brain
        │   └── 06 Agent Orchestrator
        │       ├── 07 Message Intelligence
        │       │   ├── 09 Gmail Integration
        │       │   ├── 10 WhatsApp Integration
        │       │   └── 11 Social Media
        │       └── 08 Personal Memory
        ├── 12 Calendar & Tasks
        ├── 13 Morning Intelligence (→ 07, 08, 12)
        ├── 14 Command Center (→ 06)
        ├── 15 Action Engine (→ 14)
        ├── 16 Voice Assistant (→ 14)
        └── 17 Mobile & Remote Access
18 Security (cross-cutting concern)
```

## Data Flow: Message Processing

```
Email Arrives → Gmail Webhook → Worker Queue → Message Intelligence
  → AI Classification → Urgency Scoring → Memory Storage
  → Notification (if important) → Dashboard Update
```

## Data Flow: AI Agent Orchestration (Module 06)

```
User Prompt → Intent Analyzer → Intent Category (7 classes)
  → Planner Service (≤ 10 steps, Cycle Resolution)
  → Persistence (PostgreSQL AgentPlan & Steps)
  → Execution Engine (Sequential, Dependency-checked)
      ├─ Non-sensitive Step → Specialized Agent (Planning, Research, Task) → Output
      └─ Sensitive Proposal (Communication) → ApprovalRequest (PENDING)
            └─ Human Approval via UI → Resume / Finalize
```

## Port Allocation

| Service       | Port  | Notes         |
| ------------- | ----- | ------------- |
| Web (Next.js) | 3000  | Frontend      |
| API (NestJS)  | 3001  | REST API      |
| Worker        | 3002  | Internal only |
| PostgreSQL    | 5432  | Module 03     |
| Redis         | 6379  | Module 03     |
| Ollama        | 11434 | Module 05     |
