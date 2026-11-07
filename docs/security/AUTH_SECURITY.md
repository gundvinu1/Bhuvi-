# BHUVI – Authentication Security Architecture

## 1. Security Philosophy

BHUVI operates on a **defense-in-depth, local-first security model**. Even in local execution, authentication controls guarantee user isolation, protect private communications, and establish verified audit trails.

---

## 2. Threat Mitigation Matrix

| Threat | Risk Level | Mitigation Strategy in Module 02 |
|---|---|---|
| Plaintext Credential Exposure | Critical | `bcryptjs` salted hashing with work factor 10. Plaintext passwords never stored or logged. |
| Password Hash Leakage | Critical | `toSafeUser()` strictly strips `passwordHash` before any user object reaches controllers, services, or responses. |
| User Enumeration | Medium | Both non-existent emails and incorrect passwords return the identical generic error: `"Invalid email or password"`. |
| Weak Password Attacks | Medium | `RegisterDto` enforces min 8 chars, uppercase, lowercase, and number/symbol character classes via regex validation. |
| Token Forgery | High | Standard HMAC-SHA256 JWT signatures. Verified via Passport JWT strategy on every protected endpoint. |
| Token Replay / Stale Tokens | Medium | Tokens expire in 15 minutes by default (`JWT_ACCESS_TOKEN_EXPIRY`). Expired tokens rejected with 401. |
| Production Leak of Dev Adapters | Critical | `InMemoryUsersRepository` contains runtime checks throwing fatal exceptions if `NODE_ENV === 'production'`. |
| Insecure / Default Secrets | High | `authConfig` verifies that in production, `JWT_SECRET` exists, is ≥ 32 characters, and does not contain placeholder patterns. |

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

## 4. JWT Implementation Details

- **Header:** `{"alg": "HS256", "typ": "JWT"}`
- **Claims:**
  - `sub`: User UUID.
  - `email`: Normalized user email.
  - `name`: User full name.
  - `iat`: Issued-at timestamp.
  - `exp`: Expiration timestamp.
- **Transport:** Delivered in `Authorization: Bearer <token>` HTTP request headers.
- **URL Parameters:** Explicitly prohibited (tokens in URL parameters leak into browser history, proxies, and access logs).

---

## 5. Client Token Security (Module 02 Status)

- **Current Implementation:** Next.js client stores the Bearer token in transient browser session storage or memory.
- **Limitation:** In Module 18 (Security, Monitoring & Deployment), authentication will be migrated to `HttpOnly`, `SameSite=Strict`, `Secure` cookies to guard against Cross-Site Scripting (XSS) extraction.
