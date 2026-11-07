# BHUVI – Module Roadmap

All 18 planned modules with their descriptions, dependencies, and current status.

---

## Module Index

| # | Name | Status | Depends On |
|---|------|--------|-----------|
| 01 | [Project Foundation](#01-project-foundation) | ✅ Complete | — |
| 02 | [Authentication & User Management](#02-authentication--user-management) | ✅ Complete | 01 |
| 03 | [Database & Infrastructure](#03-database--infrastructure) | 📋 Planned | 01 |
| 04 | [Application Dashboard](#04-application-dashboard) | 📋 Planned | 02, 03 |
| 05 | [AI Brain & Model Integration](#05-ai-brain--model-integration) | 📋 Planned | 03 |
| 06 | [AI Agent Orchestrator](#06-ai-agent-orchestrator) | 📋 Planned | 05 |
| 07 | [Message Intelligence Engine](#07-message-intelligence-engine) | 📋 Planned | 06 |
| 08 | [Personal Memory & Knowledge](#08-personal-memory--knowledge) | 📋 Planned | 05, 03 |
| 09 | [Gmail Integration](#09-gmail-integration) | 📋 Planned | 07, 03 |
| 10 | [WhatsApp Integration](#10-whatsapp-integration) | 📋 Planned | 07, 03 |
| 11 | [Social Media Integrations](#11-social-media-integrations) | 📋 Planned | 07, 03 |
| 12 | [Calendar & Task Management](#12-calendar--task-management) | 📋 Planned | 03, 02 |
| 13 | [Morning Intelligence System](#13-morning-intelligence-system) | 📋 Planned | 07, 08, 12 |
| 14 | [Natural Language Command Center](#14-natural-language-command-center) | 📋 Planned | 06 |
| 15 | [Action & Automation Engine](#15-action--automation-engine) | 📋 Planned | 14, 03 |
| 16 | [Voice Assistant](#16-voice-assistant) | 📋 Planned | 14, 05 |
| 17 | [Mobile Application & Remote Access](#17-mobile-application--remote-access) | 📋 Planned | 04, 02 |
| 18 | [Security, Monitoring & Deployment](#18-security-monitoring--deployment) | 📋 Planned | All |

---

## Detailed Module Descriptions

### 01 Project Foundation
**Package:** Root monorepo + `@bhuvi/shared`
**Goal:** Establish the monorepo structure, tooling, and working applications for all three tiers (web, API, worker).

**Delivers:**
- pnpm workspace monorepo
- Next.js web application with landing page
- NestJS API with `/api/v1/health` endpoint
- Node.js worker with graceful shutdown
- Shared TypeScript types, constants, and utilities
- Development tooling (ESLint, Prettier, TypeScript)
- Documentation and conventions

---

### 02 Authentication & User Management
**Package:** `@bhuvi/security` (auth portions)
**Goal:** Secure the API and provide user identity.

**Delivers:**
- Local user accounts (single-user initially)
- JWT-based session management
- Protected route middleware
- Login UI
- Password hashing (bcrypt)
- Session refresh

**Dependencies:** Module 01, Module 03 (user storage)

---

### 03 Database & Infrastructure
**Package:** `@bhuvi/database`
**Goal:** Add persistent storage and queuing.

**Delivers:**
- PostgreSQL schema via Prisma
- Database migrations
- Redis connection
- BullMQ queue configuration
- Docker Compose setup for local development
- Database seed scripts

**Dependencies:** Module 01

---

### 04 Application Dashboard
**Package:** `apps/web` (expanded)
**Goal:** Replace the landing page with an operational dashboard.

**Delivers:**
- Authenticated dashboard layout
- Status widgets
- Module activity feed
- shadcn/ui component integration
- Responsive sidebar navigation

**Dependencies:** Modules 02, 03

---

### 05 AI Brain & Model Integration
**Package:** `@bhuvi/ai-engine`
**Goal:** Integrate local AI via Ollama.

**Delivers:**
- Ollama HTTP client
- Model management (list, pull, run)
- Prompt template system
- Streaming response support
- Context window management
- Model selection per use case

**Dependencies:** Module 03

---

### 06 AI Agent Orchestrator
**Package:** `@bhuvi/agent-core`
**Goal:** Coordinate multiple AI agents for complex tasks.

**Delivers:**
- Agent lifecycle management
- Tool/function calling framework
- Multi-step reasoning chains
- Agent memory context injection
- Task delegation and results aggregation

**Dependencies:** Module 05

---

### 07 Message Intelligence Engine
**Package:** `@bhuvi/message-intelligence`
**Goal:** Classify and score incoming messages.

**Delivers:**
- Message ingestion pipeline
- Urgency and importance scoring
- Sender trust levels
- Topic extraction
- Action item detection
- Notification triggers

**Dependencies:** Module 06

---

### 08 Personal Memory & Knowledge
**Package:** `@bhuvi/memory`
**Goal:** Give BHUVI persistent, searchable memory.

**Delivers:**
- Entity extraction (people, places, topics)
- Vector embeddings (via Ollama)
- Semantic search
- Knowledge graph (optional: Neo4j or pg_vector)
- User preference learning

**Dependencies:** Modules 05, 03

---

### 09 Gmail Integration
**Package:** `@bhuvi/integrations` (gmail sub-module)
**Goal:** Monitor and act on Gmail.

**Delivers:**
- Gmail OAuth2 flow
- Webhook/push notifications
- Email ingestion into message pipeline
- Draft and send capabilities
- Label management

**Dependencies:** Modules 07, 03

---

### 10 WhatsApp Integration
**Package:** `@bhuvi/integrations` (whatsapp sub-module)
**Goal:** Monitor WhatsApp messages.

**Delivers:**
- WhatsApp Business API connection
- Message ingestion
- Read receipt management
- Response drafting (human approval required)

**Dependencies:** Modules 07, 03

---

### 11 Social Media Integrations
**Package:** `@bhuvi/integrations` (social sub-module)
**Goal:** Monitor relevant social platforms.

**Delivers:**
- Twitter/X mentions and DMs
- LinkedIn notifications
- Telegram (optional)
- Unified social feed

**Dependencies:** Modules 07, 03

---

### 12 Calendar & Task Management
**Package:** `apps/api` (calendar module)
**Goal:** Integrate with Google Calendar and task systems.

**Delivers:**
- Google Calendar read/write
- Task list management
- Availability inference
- Scheduling suggestions

**Dependencies:** Modules 03, 02

---

### 13 Morning Intelligence System
**Package:** `@bhuvi/notifications`
**Goal:** Daily briefing generation and delivery.

**Delivers:**
- Scheduled morning report (configurable time)
- Email digest summary
- Priority action items for the day
- Calendar overview
- Push notification delivery

**Dependencies:** Modules 07, 08, 12

---

### 14 Natural Language Command Center
**Package:** `@bhuvi/command-engine`
**Goal:** Accept and route natural language commands.

**Delivers:**
- Intent parsing via AI
- Command routing to appropriate modules
- Confirmation prompts for destructive actions
- Command history
- Web and voice input modes

**Dependencies:** Module 06

---

### 15 Action & Automation Engine
**Package:** `@bhuvi/action-engine`
**Goal:** Execute approved actions and automate workflows.

**Delivers:**
- Action approval workflow
- n8n webhook integration
- File system actions (Windows)
- Email/calendar write actions
- Action audit log

**Dependencies:** Modules 14, 03

---

### 16 Voice Assistant
**Package:** `apps/web` (voice module)
**Goal:** Add voice input and output.

**Delivers:**
- Browser-based speech-to-text (Web Speech API)
- Whisper transcription fallback (via Ollama)
- Text-to-speech responses
- Wake word detection (optional)

**Dependencies:** Modules 14, 05

---

### 17 Mobile Application & Remote Access
**Package:** `apps/web` (PWA enhancements)
**Goal:** Make BHUVI accessible from mobile devices.

**Delivers:**
- Progressive Web App manifest
- Service worker (offline support)
- Mobile-optimized UI
- Secure remote access (Tailscale or Cloudflare Tunnel)
- Push notifications (Web Push API)

**Dependencies:** Modules 04, 02

---

### 18 Security, Monitoring & Deployment
**Package:** `@bhuvi/security` (full)
**Goal:** Harden and prepare for reliable operation.

**Delivers:**
- Helmet.js security headers
- Rate limiting
- API key rotation
- Structured logging and audit trail
- Health monitoring dashboard
- Docker production compose
- Backup and restore scripts
- Optional: Windows Service installation

**Dependencies:** All modules

