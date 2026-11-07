# BHUVI – Module 02: Authentication & User Management

## 1. Overview

Module 02 establishes the identity, registration, credential verification, and session authentication layer for **BHUVI (Brain for Human Virtual Intelligence)**.

All subsequent user-scoped data (messages, contacts, tasks, memories, intelligence briefings) will rely on the identity context established in this module.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Tier (Next.js)                  │
│   /login (Form)                 /register (Form)            │
│          │                               │                  │
│          ▼ Bearer Authorization Token     ▼ Registration DTO│
├─────────────────────────────────────────────────────────────┤
│                      API Tier (NestJS)                      │
│                                                             │
│   AuthController                                            │
│   ├── POST /api/v1/auth/register                            │
│   ├── POST /api/v1/auth/login                               │
│   └── GET  /api/v1/auth/me (Protected by JwtAuthGuard)       │
│          │                                                  │
│          ▼                                                  │
│   AuthService ──► bcrypt (Password Hashing / Verify)        │
│          │    ──► JwtService (Sign / Verify Token)          │
│          ▼                                                  │
│   UsersService                                              │
│          │                                                  │
│          ▼                                                  │
│   IUsersRepository (Interface Abstraction)                  │
│          │                                                  │
│          ├── [Module 02] InMemoryUsersRepository (Dev Only) │
│          └── [Module 03] PrismaUsersRepository (Postgres)   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Storage Abstraction & Module 03 Transition

### The Repository Pattern

To maintain clean separation of concerns and avoid introducing temporary persistence hacks (such as SQLite or MongoDB), Module 02 introduces `IUsersRepository`:

```typescript
export interface IUsersRepository {
  create(data: CreateUserData): Promise<User>;
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
}
```

### Development Adapter (`InMemoryUsersRepository`)

For Module 02 local development and automated testing:
- Uses an in-memory `Map<string, User>`.
- **Strictly Non-Production:** Checks `process.env.NODE_ENV === 'production'` upon instantiation and throws a fatal error if executed in production.
- Logs a prominent warning at startup explaining that data is non-persistent.
- **Never stores plaintext passwords**; all stored records contain bcrypt salt-hashed strings.

### How Module 03 Replaces It

When Module 03 (Database & Infrastructure) is activated:
1. PostgreSQL container and Prisma client will be configured.
2. A `PrismaUsersRepository` implementing `IUsersRepository` will be created in `@bhuvi/database`.
3. In `apps/api/src/users/users.module.ts`, the provider binding will switch:
   ```typescript
   {
     provide: USERS_REPOSITORY,
     useClass: PrismaUsersRepository, // Replaces InMemoryUsersRepository
   }
   ```
4. No business logic in `AuthService`, `UsersService`, or `AuthController` requires modification.

---

## 4. Authentication Flows

### Registration Flow (`POST /api/v1/auth/register`)

1. **Input Validation:** Request payload is validated against `RegisterDto`:
   - `name`: 2–100 characters.
   - `email`: valid email format, trimmed and normalized to lowercase.
   - `password`: at least 8 characters, containing uppercase, lowercase, and a number or special character.
2. **Duplicate Check:** `UsersService.findByEmail()` checks if email already exists. If found, a `409 Conflict` error is returned.
3. **Password Hashing:** `bcrypt.hash(password, 10)` generates a salted hash.
4. **User Creation:** Record is stored via `IUsersRepository`.
5. **Token Generation:** A JWT access token is signed containing `{ sub: user.id, email: user.email, name: user.name }`.
6. **Response:** Returns `ApiResponse<AuthResponseData>` containing the safe user profile (without password hash) and the access token.

### Login Flow (`POST /api/v1/auth/login`)

1. **Input Validation:** Request validated against `LoginDto`.
2. **User Lookup:** User retrieved by normalized email.
3. **Anti-Enumeration Guard:** If user does not exist, throws `401 Unauthorized ('Invalid email or password')`.
4. **Credential Verification:** `bcrypt.compare(password, user.passwordHash)` checks the password. If invalid, throws the exact same generic `401 Unauthorized` message.
5. **Token Generation:** Signed JWT access token generated.
6. **Response:** Returns `ApiResponse<AuthResponseData>` with safe user and access token.

### Protected Endpoint Flow (`GET /api/v1/auth/me`)

1. **Guard Execution:** `JwtAuthGuard` intercepts the request and reads `Authorization: Bearer <token>`.
2. **Signature & Expiration Verification:** `JwtStrategy` validates the token against `auth.jwtSecret` and checks expiration (`exp`).
3. **Payload Extraction:** Injects `user` into `request.user`.
4. **Controller Action:** `@CurrentUser() user: SafeUser` retrieves the safe profile.
5. **Response:** Returns `ApiResponse<SafeUser>`.

---

## 5. Environment Configuration

| Variable | Development Default | Production Requirement | Description |
|---|---|---|---|
| `JWT_SECRET` | Default testing key | **Required** (min 32 chars) | Cryptographic secret for signing JWTs |
| `JWT_ACCESS_TOKEN_EXPIRY` | `15m` | `15m` (configurable) | Access token lifetime |
| `AUTH_DEV_MODE` | `true` | `false` | Enables in-memory test adapter in development |

---

## 6. Security Hardening & Audit Verification

As of the Module 02 Security Audit:
- **HttpOnly Cookie Transport:** Access tokens are delivered via `HttpOnly`, `SameSite=Lax` (Strict in production), `Path=/` cookies (`bhuvi_token`). Client-side storage (`localStorage`/`sessionStorage`) is completely bypassed, eliminating client-side XSS token theft vectors.
- **Rate Limiting:** Auth endpoints (`/auth/login`, `/auth/register`) are protected by `@nestjs/throttler` (max 5 requests/min per IP), responding with HTTP 429 `RATE_LIMIT_EXCEEDED` on breach.
- **Secret Hardening:** Production environment strictly requires a 32+ character non-placeholder `JWT_SECRET`. Missing or default secrets prevent application startup.
- **Repository Safety:** `InMemoryUsersRepository` is strictly blocked in production mode and when `AUTH_DEV_MODE=false`.

---

## 7. Known Limitations & Module 03 Scope

- **Persistent Storage:** Registration and login data are held in memory during development and reset on application restart. Module 03 will integrate PostgreSQL and Prisma ORM to provide persistent storage.
- **Refresh Tokens:** Refresh token rotation with family revocation will be introduced post-database integration in Module 03/04.
- **Multi-Factor Authentication (MFA):** Optional TOTP integration is scheduled for Module 18 (Security, Monitoring & Deployment).

