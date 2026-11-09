# BHUVI — Module 10: WhatsApp Integration

## Official Meta WhatsApp Business Cloud API &bull; AI Conversation Intelligence &bull; Strict Human Approval Outbound Workflow

## 1. Executive Summary

Module 10 integrates BHUVI with the official **Meta WhatsApp Business Platform Cloud API (v20.0+)**. It equips BHUVI with the capability to securely synchronize multi-account WhatsApp conversations, understand customer and personal message content via the Module 07 Intelligence Engine, deliver grounded local AI summaries and tone-tailored suggested replies via Ollama (`qwen2.5:3b`), and enforce a zero-trust, human-approval-only outbound messaging workflow.

In accordance with strict enterprise security policies:

- **Official Cloud API Only:** Strictly zero use of unofficial libraries, reverse-engineered protocols, browser automation, or QR code scrapers.
- **Multi-Account Architecture:** A single BHUVI user can connect, manage, and synchronize multiple WhatsApp Business accounts and phone numbers independently.
- **Token Security:** All Meta System User access tokens are encrypted locally with **AES-256-GCM** using unique 12-byte initialization vectors and 16-byte authentication tags. Raw tokens are never sent to the frontend or written to logs.
- **Webhook Integrity:** All incoming Meta webhooks are verified using cryptographic constant-time comparison (`crypto.timingSafeEqual`) of HMAC-SHA256 signatures (`X-Hub-Signature-256`).
- **Critical Outbound Policy:** BHUVI **never** sends messages automatically. Outbound replies are created strictly as drafts in `PENDING_APPROVAL` status and require explicit authenticated user confirmation via an approval dialog before dispatch.

---

## 2. Architecture & Data Flow

```mermaid
flowchart TD
    subgraph Meta Cloud ["Meta WhatsApp Business Cloud Platform"]
        WA_API["Cloud API v20.0 (Messages Endpoint)"]
        WA_WH["Webhook Dispatcher (Messages & Statuses)"]
    end

    subgraph BHUVI API ["BHUVI API (NestJS)"]
        WH_CTRL["Webhook Controller (/api/v1/whatsapp/webhook)"]
        SIG_VAL["HMAC-SHA256 & Timing-Safe Validator"]
        CONN_SRV["WhatsApp Connection Service (AES-256-GCM)"]
        DRAFT_SRV["WhatsApp Draft & Approval Service"]
        AI_SRV["WhatsApp AI Intelligence Service"]
    end

    subgraph Storage ["PostgreSQL 16 & Redis 7"]
        PG[("PostgreSQL 16 (Multi-Account Schema)")]
        BULL[("BullMQ Queue Broker (Redis 7)")]
    end

    subgraph Worker ["BHUVI Asynchronous Worker"]
        WA_WRK["WhatsApp Worker Pipeline"]
        MOD07["Module 07 Intelligence Engine"]
        OLLAMA["Local Ollama (qwen2.5:3b)"]
    end

    subgraph Web ["Next.js 14 Web Dashboard"]
        DASH["/dashboard/whatsapp (Unified Inbox & Reply Modal)"]
    end

    WA_WH -->|POST with X-Hub-Signature-256| WH_CTRL
    WH_CTRL --> SIG_VAL
    SIG_VAL -->|Persist Event & Deduplicate| PG
    SIG_VAL -->|Enqueue Job| BULL
    BULL --> WA_WRK
    WA_WRK -->|Resolve Contacts & Conversations| PG
    WA_WRK -->|Classify, Priority & Urgency| MOD07
    MOD07 --> PG

    DASH -->|Browse & Filter Conversations| BHUVI API
    DASH -->|Generate Summaries & Suggest Replies| AI_SRV
    AI_SRV --> OLLAMA
    DASH -->|Create Draft (PENDING_APPROVAL)| DRAFT_SRV
    DASH -->|Explicit Human Approval Action| DRAFT_SRV
    DRAFT_SRV -->|Authenticated POST| WA_API
```

---

## 3. Database Schema Models

Seven relational models were designed and deployed via Prisma migration `20261109023723_add_whatsapp_integration_module_10`:

1. **`WhatsAppConnection` (`whatsapp_connections`):**
   - Holds WABA ID, Phone Number ID, Display Phone Number, Channel Name, and encrypted access credentials (`encryptedAccessToken`, `tokenIV`, `tokenAuthTag`).
   - `@@unique([userId, phoneNumberId])` ensures multi-phone support per user while preventing duplicate registrations.
2. **`WhatsAppContact` (`whatsapp_contacts`):**
   - Stores resolved contact profiles (`waId`, `name`, `profileData`).
   - `@@unique([connectionId, waId])` scopes contacts to their owning business phone line.
3. **`WhatsAppConversation` (`whatsapp_conversations`):**
   - Thread container tracking conversation status, `unreadCount`, `lastMessagePreview`, and `lastMessageAt`.
   - `@@unique([connectionId, contactId])` provides 1:1 conversation threads per contact.
4. **`WhatsAppMessage` (`whatsapp_messages`):**
   - Incoming and outgoing message records with `externalMessageId` (Meta `wamid`), `direction`, `messageType`, `textContent`, `mediaMetadata`, and `deliveryStatus`.
   - Relates to Module 07 `Message` (`messageId`) for centralized intelligence.
5. **`WhatsAppMedia` (`whatsapp_media`):**
   - Metadata for images, documents, audio, and video messages (`mediaId`, `mimeType`, `filename`, `fileSize`, `storagePath`).
6. **`WhatsAppWebhookEvent` (`whatsapp_webhook_events`):**
   - Audit log and deduplication registry preventing redundant ingestion or status loops.
   - `@@unique([eventId])` guarantees at-most-once processing.
7. **`WhatsAppMessageDraft` (`whatsapp_message_drafts`):**
   - Outbound drafts holding `approvalStatus` (`PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `SENT`), `approvedByUserId`, and `approvedAt`.

---

## 4. API Endpoints

All endpoints (except the public webhook handshake) require authentication via `JwtAuthGuard` and enforce tenant ownership validation.

| Method | Endpoint                                           | Description                                                                              |
| ------ | -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `GET`  | `/api/v1/whatsapp/webhook`                         | Meta verification challenge (`hub.mode`, `hub.verify_token`, `hub.challenge`)            |
| `POST` | `/api/v1/whatsapp/webhook`                         | Meta webhook receiver (verifies `X-Hub-Signature-256`, deduplicates, enqueues to BullMQ) |
| `GET`  | `/api/v1/whatsapp/connections`                     | Lists all WhatsApp Business accounts for authenticated user                              |
| `GET`  | `/api/v1/whatsapp/connections/:id`                 | Returns single connection details (tokens redacted)                                      |
| `POST` | `/api/v1/whatsapp/connections`                     | Connects a new WhatsApp Business account / phone number                                  |
| `POST` | `/api/v1/whatsapp/connections/:id/disconnect`      | Gracefully disconnects a connection preserving past history                              |
| `GET`  | `/api/v1/whatsapp/conversations`                   | Lists conversations with account, unread, urgent, and search filters                     |
| `GET`  | `/api/v1/whatsapp/conversations/:id`               | Returns conversation details with contact and channel information                        |
| `GET`  | `/api/v1/whatsapp/conversations/:id/messages`      | Returns paginated message timeline with attachments & AI analysis                        |
| `GET`  | `/api/v1/whatsapp/messages`                        | Multi-conversation message search                                                        |
| `GET`  | `/api/v1/whatsapp/messages/:id`                    | Single message detail with Module 07 classification                                      |
| `POST` | `/api/v1/whatsapp/conversations/:id/summarize`     | AI conversation summary with action items and urgent highlights                          |
| `POST` | `/api/v1/whatsapp/conversations/:id/suggest-reply` | Generates tone-tailored replies (`Professional`, `Friendly`, `Direct`)                   |
| `POST` | `/api/v1/whatsapp/ask`                             | Grounded Q&A across WhatsApp history with citations                                      |
| `POST` | `/api/v1/whatsapp/drafts`                          | Creates a new outbound draft strictly in `PENDING_APPROVAL` status                       |
| `GET`  | `/api/v1/whatsapp/drafts`                          | Lists drafts with optional account or approval status filter                             |
| `POST` | `/api/v1/whatsapp/drafts/:id/approve`              | Explicit authenticated user approval action                                              |
| `POST` | `/api/v1/whatsapp/drafts/:id/send`                 | Dispatches approved draft to Meta Cloud API (strictly rejects unapproved drafts)         |
| `GET`  | `/api/v1/whatsapp/stats`                           | Aggregated dashboard statistics                                                          |

---

## 5. Security & Prompt Injection Defense

1. **HMAC-SHA256 Webhook Verification:**
   - Webhook payloads are hashed using `META_APP_SECRET` and compared against `X-Hub-Signature-256` using constant-time comparison (`crypto.timingSafeEqual`).
2. **AES-256-GCM Token Encryption:**
   - Meta access tokens are encrypted using `WHATSAPP_TOKEN_ENCRYPTION_KEY` with a unique 12-byte cryptographic IV and 16-byte GCM authentication tag.
3. **Prompt Injection Resistance:**
   - Untrusted message bodies and contact names are isolated within `<untrusted_whatsapp_message>` XML tags.
   - Any raw attempts to nest closing XML tags are stripped prior to LLM submission.
   - LLM system prompts strictly forbid executing commands or overriding directives found in untrusted content.
4. **Secret Detector & Redaction:**
   - `SecretDetectorService` scans and redacts API keys, private keys, passwords, and tokens before summaries, suggested replies, or Q&A answers are displayed.
5. **Strict Human Approval Enforcement:**
   - Zero automatic message sending. Outbound messages can only be dispatched after explicit authenticated user confirmation in the frontend UI.
