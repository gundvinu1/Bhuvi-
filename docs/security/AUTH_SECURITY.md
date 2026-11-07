# BHUVI – Authentication Security Architecture

## 1. Security Philosophy

BHUVI operates on a **defense-in-depth, local-first security model**. Even in local execution, authentication controls guarantee user isolation, protect private communications, and establish verified audit trails.

---

## 2. Threat Mitigation Matrix

| Threat                                 | Risk Level | Mitigation Strategy in Module 02                                                                                                                                      | Status       |
| -------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Plaintext Credential Exposure          | Critical   | `bcryptjs` salted hashing with work factor 10. Plaintext passwords never stored or logged.                                                                            | **VERIFIED** |
| Password Hash Leakage                  | Critical   | `toSafeUser()` strictly strips `passwordHash` before any user object reaches controllers, services, or responses.                                                     | **VERIFIED** |
| Cross-Site Scripting (XSS) Token Theft | Critical   | JWT tokens delivered as `HttpOnly`, `SameSite=Lax` (Strict in prod), `Path=/` cookies. Tokens are **never** persisted in `localStorage` or `sessionStorage`.          | **VERIFIED** |
| Brute Force / Credential Stuffing      | High       | Rate limiting enforced via `@nestjs/throttler`: max 5 requests/minute on `/auth/login` and `/auth/register`. Exceeded attempts return 429 with `RATE_LIMIT_EXCEEDED`. | **VERIFIED** |
| User Enumeration                       | Medium     | Both non-existent emails and incorrect passwords return the identical generic error: `"Invalid email or password"`.                                                   | **VERIFIED** |
| Weak Password Attacks                  | Medium     | `RegisterDto` enforces min 8 chars, uppercase, lowercase, and number/symbol character classes via regex validation.                                                   | **VERIFIED** |
| Token Forgery                          | High       | Standard HMAC-SHA256 JWT signatures. Verified via Passport JWT strategy on every protected endpoint. Insecure fallback secrets strictly eliminated.                   | **VERIFIED** |
| Token Replay / Stale Tokens            | Medium     | Tokens expire in 15 minutes by default (`JWT_ACCESS_TOKEN_EXPIRY`). Expired tokens rejected with 401.                                                                 | **VERIFIED** |
| Production Leak of Dev Adapters        | Critical   | `InMemoryUsersRepository` contains runtime checks throwing fatal exceptions if `NODE_ENV === 'production'`. `UsersModule` strictly blocks memory adapter if `isProd   |              | !authDevMode`. | **VERIFIED** |
| Insecure / Default Secrets             | High       | `authConfig` verifies that in production, `JWT_SECRET` exists, is ≥ 32 characters, and does not contain placeholder patterns.                                         | **VERIFIED** |

---

## 3. Credential Handling Specification

### Hashing Standard

- **Algorithm:** bcrypt (Blowfish-based adaptive hashing).
- **Salt Rounds:** 10 (balanced for local CPU execution while providing robust protection against offline brute-force attacks).
- **Format:** Modular Crypt Format (`$2a$` / `$2b$`).

### Safe User Profile Pattern

Internal domain entities contain credentials:

```typescript
interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string; // Internal only
  createdAt: Date;
  updatedAt: Date;
}
```

External profiles (`SafeUser`) explicitly exclude `passwordHash`:

```typescript
interface SafeUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}
```

---

## 4. JWT Implementation & Dual-Transport Architecture

- **Header:** `{"alg": "HS256", "typ": "JWT"}`
- **Claims:**
  - `sub`: User UUID.
  - `email`: Normalized user email.
  - `name`: User full name.
  - `iat`: Issued-at timestamp.
  - `exp`: Expiration timestamp.
- **Dual Transport:**
  1. **Primary Browser Transport (HttpOnly Cookie):**
     - Emitted via `Set-Cookie: bhuvi_token=<jwt>; HttpOnly; SameSite=Lax; Path=/; Max-Age=900`.
     - Completely inaccessible to client-side JavaScript, mitigating XSS exfiltration.
     - Automatically included by browsers when requests specify `credentials: 'include'`.
     - Cleared upon `POST /api/v1/auth/logout` via `res.clearCookie('bhuvi_token')`.
  2. **Secondary API / CLI / Worker Transport (Bearer Token Header):**
     - Accepted via `Authorization: Bearer <token>` in `JwtStrategy`.
     - Enables programmatic non-browser clients (worker, CLI, mobile PWA shell) to authenticate cleanly.
- **URL Parameters:** Explicitly prohibited (tokens in URL parameters leak into browser history, proxies, and access logs).

---

## 5. Rate Limiting Architecture

- **Engine:** `@nestjs/throttler` (v5) integrated at application root level.
- **Default Baseline:** 20 requests/minute.
- **Auth Endpoint Throttling:** `@Throttle({ default: { limit: 5, ttl: 60000 } })` applied to:
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/register`
- **Error Response:** Triggers HTTP 429 Too Many Requests intercepted by `AllExceptionsFilter`, returning `{ success: false, error: { code: "RATE_LIMIT_EXCEEDED", message: "..." } }`.
