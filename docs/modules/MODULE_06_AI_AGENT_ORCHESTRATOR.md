# BHUVI — MODULE 06: AI AGENT ORCHESTRATOR

## 1. Executive Summary

Module 06 establishes the **AI Agent Orchestrator** for BHUVI (Brain for Human Virtual Intelligence). It builds directly upon the local Ollama LLM integration (`qwen2.5:3b`) established in Module 05, transforming single-turn question answering into a structured, multi-step orchestration pipeline.

The orchestrator decomposes complex natural language goals into sequential execution plans, assigns tasks to 4 specialized logical agents, manages step dependencies and error handling, enforces human approval boundaries for sensitive actions, and tracks execution state persistently in PostgreSQL with BullMQ worker compatibility.

All orchestration capabilities run strictly on local hardware (AMD Ryzen 7 7445HS, NVIDIA GeForce RTX 4050 Laptop GPU, 16GB RAM, ASUS TUF A16) without paid third-party APIs, internet data scraping, dynamic code execution, or unconstrained autonomous actions.

---

## 2. Architecture & Pipeline Overview

The orchestration pipeline follows a deterministic state machine:

```
                  ┌────────────────────────┐
                  │ Natural Language Goal  │
                  └───────────┬────────────┘
                              │
                              ▼
                  ┌────────────────────────┐
                  │ Intent Analyzer Service│
                  │ (Strict JSON + Rules)  │
                  └───────────┬────────────┘
                              │
                              ▼
                  ┌────────────────────────┐
                  │    Planner Service     │
                  │ (Decompose ≤ 10 steps) │
                  └───────────┬────────────┘
                              │
                              ▼
                  ┌────────────────────────┐
                  │ Plan Validation Engine │
                  │ (Cycle detection & DAG)│
                  └───────────┬────────────┘
                              │
                              ▼
                  ┌────────────────────────┐
                  │ PostgreSQL Persistence │
                  │ (AgentPlan & Steps)    │
                  └───────────┬────────────┘
                              │
                              ▼
            ┌─────────────────┴─────────────────┐
            │                                   │
            ▼                                   ▼
┌────────────────────────┐         ┌────────────────────────┐
│ Sequential Execution   │         │ Background Worker Job  │
│ Engine (REST API)      │         │ (BullMQ execute-plan)  │
└───────────┬────────────┘         └───────────┬────────────┘
            │                                   │
            └─────────────────┬─────────────────┘
                              │
                              ▼
            ┌─────────────────┴─────────────────┐
            │                                   │
            │  Step requires human approval?    │
            │                                   │
            ├─────────────────┬─────────────────┤
            │ YES             │ NO              │
            ▼                 ▼                 ▼
┌────────────────────────┐  ┌────────────────────────┐
│ Create ApprovalRequest │  │ Execute Step via Agent │
│ Status: PENDING        │  │ (Capture output)       │
│ Halt step execution    │  └───────────┬────────────┘
└───────────┬────────────┘              │
            │                           ▼
            │ User Approves via UI?     │ Next step dependencies
            │ [POST /approvals/:id/app] │ met?
            └───────────────────────────┴───────► Completed Plan
```

---

## 3. Four Logical Agents & Hard Boundaries

All agents implement the standard `BaseAgent` contract (`apps/api/src/orchestrator/agents/base-agent.interface.ts`):

```typescript
export interface BaseAgent {
  readonly role: AgentRole;
  readonly description: string;
  readonly capabilities: string[];
  executeStep(context: AgentExecutionContext): Promise<AgentStepResult>;
}
```

Dynamic creation of arbitrary or unauthorized agents is strictly forbidden and rejected with `BadRequestException` by `AgentRegistryService`.

### 3.1 Planning Agent (`PLANNING`)

- **Role:** High-level problem decomposition, milestone tracking, and risk assessment.
- **System Boundaries:**
  - Evaluates provided goals without asserting unverified facts.
  - Generates clear milestones and dependencies.
  - Never schedules real external calendar events or alters user files.

### 3.2 Research Agent (`RESEARCH`)

- **Role:** Deep structured analysis, context synthesis, trade-off evaluation, and identifying missing information.
- **System Boundaries:**
  - Analyzes **only** the context supplied by the user or previous step outputs.
  - **Explicitly disclaims access to the live internet, external search engines, private email accounts, or unauthorized databases.**
  - Flags missing facts or required inputs instead of hallucinating them.

### 3.3 Communication Agent (`COMMUNICATION`)

- **Role:** Drafting executive summaries, professional emails, meeting memos, and user announcements.
- **System Boundaries:**
  - **Drafts and proposals only.**
  - Flags all external communication steps with `requiresApproval = true`.
  - Emits structured `proposalData` containing recipient, subject, preview, and payload.
  - **Never sends messages, dispatches emails, or contacts any third-party service directly.** Real communication integrations are reserved for Modules 09–11.

### 3.4 Task Agent (`TASK`)

- **Role:** Extracting actionable checklists, priority categorization (HIGH, MEDIUM, LOW), time estimates, and follow-up reminders.
- **System Boundaries:**
  - Outputs structured task items and checklist breakdowns.
  - **Never modifies calendar systems, databases, or local operating system tasks.**
  - Prepares task lists ready for human execution or downstream task engine ingestion.

---

## 4. Intent Analysis & Categorization

The `IntentAnalyzerService` parses user requests into 7 distinct categories:

1. `GENERAL_QUESTION`: Simple queries, definitions, or single-turn prompts.
2. `RESEARCH`: Investigation, technical trade-offs, synthesis of notes or documents.
3. `PLANNING`: Strategy formulation, milestone roadmaps, event preparation.
4. `COMMUNICATION`: Drafting emails, follow-up messages, status updates.
5. `TASK_MANAGEMENT`: Checklists, prioritization, action breakdowns.
6. `MULTI_STEP`: Complex, composite workflows requiring multiple specialized agent roles.
7. `UNKNOWN`: Unclear or ambiguous requests requiring clarification.

### Robust Parsing & Resilience

- **Strict JSON Parsing:** The system extracts structured JSON from Ollama responses, handling markdown code fences (` ```json `) and raw JSON objects.
- **Deterministic Keyword Fallback:** If the local model outputs invalid JSON or experiences a transient timeout, the intent analyzer applies deterministic rule-based keyword pattern matching. It never crashes the request.
- **Clarification Flagging:** When intent is ambiguous or the prompt is empty, `clarificationNeeded: true` is assigned to request user refinement.

---

## 5. Planning Engine & Topological Dependency Validation

The `PlannerService` transforms user intent and prompt context into an actionable `PlanDraft`:

- **Step Cap Enforcement:** Plans are capped at a maximum of 10 steps to prevent unbounded computation and context window overflow.
- **Role Assignment:** Each step is assigned to one of the 4 valid logical agents.
- **Dependency Tracking:** Steps declare explicit dependencies on earlier step keys (e.g., `["step_1"]`).
- **Strict Topological Validation & Cycle Rejection:**
  - Cycle detection using depth-first search (DFS) with recursion stack tracking.
  - **Controlled Error Rejection:** If a cyclic dependency is detected (e.g. `step_1 -> step_2 -> step_1`), `PlannerService.validatePlanStructure` rejects it immediately with a controlled `BadRequestException`. The engine **never silently linearizes or rewrites invalid dependency graphs**.
  - **Missing Reference Rejection:** Referencing any undefined step key throws a controlled `BadRequestException`.
  - **Self-Dependency Rejection:** A step referencing itself throws a controlled `BadRequestException`.
  - **Valid DAG Execution:** Acyclic dependency graphs pass validation and execute in verified topological order.

---

## 6. Execution Engine & State Machine

The `ExecutionEngineService` coordinates step-by-step agent execution:

- **Atomic Concurrency Protection:** Execution claims are committed atomically in PostgreSQL via conditional updates (`updateMany` with `status: { in: ['PENDING', 'WAITING_FOR_APPROVAL', 'FAILED', 'READY'] }`), preventing simultaneous execution across multiple API instances. Duplicate concurrent execution requests receive `HTTP 400 BadRequestException: Plan is already actively running`.
- **In-Memory Fast Fail:** An in-process `activeExecutions` Set provides instant duplicate rejection within a single process.
- **Server Restart & Crash Recovery:** `ExecutionEngineService` implements NestJS `OnModuleInit` to detect and recover orphaned `RUNNING` records on system boot, marking them as `FAILED` with an explanatory audit error.
- **Cancellation Guarantee:** Active plan cancellation is verified before each step and at completion; `CANCELLED` status cannot be overwritten by `COMPLETED` or `RUNNING`.
- **Sequential Execution:** Steps are executed in topological order. A step runs only when all prerequisite dependencies have status `COMPLETED`.
- **Human Approval Gate:** When a step requires approval (`requiresApproval: true`), the execution engine creates an `ApprovalRequest` record with status `PENDING`, sets the step to `WAITING_FOR_APPROVAL`, sets the plan to `WAITING_FOR_APPROVAL`, and halts until human resolution.
- **Step Output Chaining:** Completed step outputs (summaries, details, extracted data) are accumulated and fed into downstream step contexts as `previousOutputs`.
- **User Ownership Validation:** Verifies the requesting user owns the plan before starting (`ForbiddenException`).
- **Sequential Execution:** Steps are executed in topological order. A step runs only when all prerequisite dependencies have status `COMPLETED`.
- **Human Approval Gate:** When a step requires approval (`requiresApproval: true`), the execution engine creates an `ApprovalRequest` record with status `PENDING`, sets the step to `WAITING_FOR_APPROVAL`, sets the plan to `WAITING_FOR_APPROVAL`, and halts until human resolution.
- **Step Output Chaining:** Completed step outputs (summaries, details, extracted data) are accumulated and fed into downstream step contexts as `previousOutputs`.
- **Cancellation & Failure:**
  - Users can cancel active plans at any time via `POST /plans/:id/cancel`.
  - If a step throws an error, the step is marked `FAILED`, the plan is marked `FAILED`, and the error message is recorded without crashing the server.

---

## 7. Human Approval Boundary (`ApprovalService`)

Human-in-the-loop governance guarantees that sensitive agent actions are never performed autonomously:

- **Approval Lifecycle:** `PENDING` -> `APPROVED` | `REJECTED` | `CANCELLED`
- **Ownership Check:** Only the user who created the plan can approve or reject proposals. Cross-user modification attempts receive `HTTP 403 Forbidden`.
- **Idempotence & Validation:** Attempting to approve or reject an already-resolved proposal returns `HTTP 400 Bad Request`.
- **No Unapproved Side Effects:** Communication proposals remain strictly in proposal status until explicitly approved by the user.

---

## 8. Database Architecture & Migrations

Prisma migration `20261107090648_add_agent_orchestrator_models` applies four normalized models in PostgreSQL 16:

### `AgentPlan`

- `id`: UUID (Primary Key)
- `userId`: Foreign key to `users.id` (Indexed)
- `title`: String
- `prompt`: Text (The original user instruction)
- `intentCategory`: String
- `status`: String (`DRAFT`, `PENDING`, `RUNNING`, `WAITING_FOR_APPROVAL`, `COMPLETED`, `FAILED`, `CANCELLED`)
- `clarificationNeeded`: Boolean
- `explanation`: Text (Optional reasoning)
- `createdAt`, `updatedAt`: Timestamps

### `AgentPlanStep`

- `id`: UUID (Primary Key)
- `planId`: Foreign key to `agent_plans.id` (CASCADE delete, Indexed)
- `stepKey`: String (`step_1`, `step_2`, etc.)
- `stepIndex`: Int
- `title`: String
- `description`: Text
- `assignedAgent`: String (`PLANNING`, `RESEARCH`, `COMMUNICATION`, `TASK`)
- `dependencies`: String array (`text[]`)
- `status`: String (`PENDING`, `RUNNING`, `WAITING_FOR_APPROVAL`, `COMPLETED`, `FAILED`, `CANCELLED`)
- `requiresApproval`: Boolean
- `output`: JSONB (Structured agent output)
- `error`: Text (Optional error log)
- `startedAt`, `completedAt`: Timestamps

### `AgentExecution`

- `id`: UUID (Primary Key)
- `planId`: Foreign key to `agent_plans.id` (CASCADE delete, Indexed)
- `status`: String (`PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED`)
- `logs`: JSONB (Execution event log)
- `startedAt`, `completedAt`: Timestamps

### `ApprovalRequest`

- `id`: UUID (Primary Key)
- `planId`: Foreign key to `agent_plans.id` (CASCADE delete, Indexed)
- `stepId`: Foreign key to `agent_plan_steps.id` (CASCADE delete, Indexed)
- `userId`: Foreign key to `users.id` (Indexed)
- `actionType`: String (`PROPOSAL_MESSAGE_DRAFT`, etc.)
- `description`: Text
- `proposalData`: JSONB (Structured draft parameters)
- `status`: String (`PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`)
- `decisionReason`: Text (Optional)
- `decidedBy`: String (Optional)
- `decidedAt`: Timestamp

---

## 9. REST API Contract

All endpoints reside under `/api/v1/orchestrator` and require JWT authentication (HttpOnly cookie or Bearer token):

| Method | Endpoint                                     | Request Body            | Response Meta / Data                            | Description                                                          |
| ------ | -------------------------------------------- | ----------------------- | ----------------------------------------------- | -------------------------------------------------------------------- |
| `POST` | `/api/v1/orchestrator/plans`                 | `{ "message": string }` | `AgentPlanDto`                                  | Analyzes intent, creates a structured execution plan, persists to DB |
| `GET`  | `/api/v1/orchestrator/plans`                 | Query: `page`, `limit`  | `{ items: AgentPlanDto[], total, page, limit }` | Lists paginated plans for the authenticated user                     |
| `GET`  | `/api/v1/orchestrator/plans/:id`             | None                    | `AgentPlanDto`                                  | Retrieves single plan with steps and approval details                |
| `POST` | `/api/v1/orchestrator/plans/:id/execute`     | None                    | `ExecutePlanResponse`                           | Executes plan steps sequentially with dependency resolution          |
| `POST` | `/api/v1/orchestrator/plans/:id/cancel`      | None                    | `AgentPlanDto`                                  | Cancels an active or waiting plan                                    |
| `GET`  | `/api/v1/orchestrator/approvals`             | None                    | `ApprovalRequestDto[]`                          | Lists pending approval requests for the authenticated user           |
| `POST` | `/api/v1/orchestrator/approvals/:id/approve` | `{ "reason"?: string }` | `ApprovalRequestDto`                            | Human user approves a sensitive proposal                             |
| `POST` | `/api/v1/orchestrator/approvals/:id/reject`  | `{ "reason"?: string }` | `ApprovalRequestDto`                            | Human user rejects a proposal with optional reason                   |

---

## 10. Dashboard Web UI (`/dashboard/orchestrator`)

The Next.js 14 frontend provides a responsive orchestration console:

- **Natural Language Task Prompt:** Clean input form with quick suggestion chips for common tasks.
- **Generated Plans Browser:** Sidebar list of user plans showing status badges, creation timestamps, and step counts.
- **Active Plan Details:** Header with intent badge, original prompt, and progress indicators.
- **Step Timeline:** Sequential step cards with assigned agent badges (`PLANNING`, `RESEARCH`, `COMMUNICATION`, `TASK`), dependency tags, step outputs, and status indicators.
- **Approval Decision Cards:** Prominent amber alerts for proposals requiring human decision, displaying recipient, subject, preview body, and one-click "Approve" / "Reject" buttons.
- **Execution Controls:** "Execute Plan" button with loading spinners, "Cancel" button for in-flight tasks.
- **Navigation Integration:** Linked in desktop sidebar (`AI Orchestrator`), mobile drawer, and topbar breadcrumbs.

---

## 11. Background Worker & Execution Architecture

- **API Execution Pipeline:** In Module 06, plan execution triggered via `POST /api/v1/orchestrator/plans/:id/execute` runs directly in-process via `ExecutionEngineService`. This ensures deterministic, synchronous step execution and immediate status reporting without requiring an external worker process.
- **Worker Queue Infrastructure:** Registered `JOB_EXECUTE_PLAN` (`execute-plan`) in `packages/queue` and implemented processor in `apps/worker/src/main.ts` for asynchronous worker consumption.
- **Concurrency & Locking:** We do **not** claim distributed Redlock. Instead, multi-instance concurrency safety is achieved natively via PostgreSQL atomic conditional updates (`updateMany` with `status: { in: ['PENDING', 'WAITING_FOR_APPROVAL', 'FAILED', 'READY'] }`), combined with an in-process execution Set for fast local rejection.
- **Worker Test Suite:** `apps/worker/src/main.spec.ts` verifies valid job handling and graceful unknown job skips.

---

## 12. Hardware Resource Constraints & Safety

- **Local Model Execution:** Uses `qwen2.5:3b` running on local Ollama daemon (`http://127.0.0.1:11434`).
- **GPU VRAM & CPU Protection:** Enforces sequential step execution (never concurrent inference bursts), preventing Out-of-Memory (OOM) faults on the NVIDIA RTX 4050 6GB.
- **Timeouts & Fallbacks:** Ollama HTTP requests enforce 60-second timeouts. If the model is busy or unresponsive, deterministic fallbacks complete the step safely.
- **Process Isolation:** The orchestrator runs in standard Node.js / NestJS runtime with no `eval()`, `child_process.exec`, or arbitrary script execution capabilities.
