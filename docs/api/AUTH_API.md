# BHUVI – Authentication API Specification

Base URL: `http://localhost:3001/api/v1`

---

## 1. POST /api/v1/auth/register

Registers a new user, sets an `HttpOnly` cookie, and returns a signed access token.

### Rate Limit

- **5 requests per 60 seconds** per client IP.

### Request

```http
POST /api/v1/auth/register HTTP/1.1
Host: localhost:3001
Content-Type: application/json

{
  "name": "Vinayak Gund",
  "email": "vinayak.gund@example.com",
  "password": "StrongPassword2026!"
}
```

### Success Response (201 Created)

**Headers:**

```http
Set-Cookie: bhuvi_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; Path=/; Expires=Sat, 07 Nov 2026 10:20:00 GMT; HttpOnly; SameSite=Lax
```

**Body:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "150b688a-b611-4522-8d50-281d0475c64e",
      "email": "vinayak.gund@example.com",
      "name": "Vinayak Gund",
      "createdAt": "2026-11-07T03:43:55.225Z",
      "updatedAt": "2026-11-07T03:43:55.225Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "15m"
  },
  "meta": {
    "timestamp": "2026-11-07T03:43:55.300Z",
    "version": "1.0.0"
  }
}
```

### Error Responses

#### 400 Bad Request (Validation Failed)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Password must contain at least one uppercase letter, one lowercase letter, and at least one number or special character",
    "details": [
      "Password must contain at least one uppercase letter, one lowercase letter, and at least one number or special character"
    ]
  },
  "meta": {
    "timestamp": "2026-11-07T03:43:55.350Z",
    "version": "1.0.0"
  }
}
```

#### 409 Conflict (Duplicate Email)

```json
{
  "success": false,
  "error": {
    "code": "USER_ALREADY_EXISTS",
    "message": "A user with this email address already exists"
  },
  "meta": {
    "timestamp": "2026-11-07T03:43:55.400Z",
    "version": "1.0.0"
  }
}
```

#### 429 Too Many Requests (Rate Limit Exceeded)

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please slow down and try again later."
  },
  "meta": {
    "timestamp": "2026-11-07T03:43:55.450Z",
    "version": "1.0.0"
  }
}
```

---

## 2. POST /api/v1/auth/login

Authenticates credentials, sets an `HttpOnly` cookie, and returns a signed access token.

### Rate Limit

- **5 requests per 60 seconds** per client IP.

### Request

```http
POST /api/v1/auth/login HTTP/1.1
Host: localhost:3001
Content-Type: application/json

{
  "email": "vinayak.gund@example.com",
  "password": "StrongPassword2026!"
}
```

### Success Response (200 OK)

**Headers:**

```http
Set-Cookie: bhuvi_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; Path=/; Expires=Sat, 07 Nov 2026 10:20:00 GMT; HttpOnly; SameSite=Lax
```

**Body:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "150b688a-b611-4522-8d50-281d0475c64e",
      "email": "vinayak.gund@example.com",
      "name": "Vinayak Gund",
      "createdAt": "2026-11-07T03:43:55.225Z",
      "updatedAt": "2026-11-07T03:43:55.225Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "15m"
  },
  "meta": {
    "timestamp": "2026-11-07T03:43:55.500Z",
    "version": "1.0.0"
  }
}
```

### Error Responses

#### 401 Unauthorized (Invalid Credentials)

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid email or password"
  },
  "meta": {
    "timestamp": "2026-11-07T03:43:55.550Z",
    "version": "1.0.0"
  }
}
```

#### 429 Too Many Requests (Rate Limit Exceeded)

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please slow down and try again later."
  },
  "meta": {
    "timestamp": "2026-11-07T03:43:55.580Z",
    "version": "1.0.0"
  }
}
```

---

## 3. GET /api/v1/auth/me

Returns the authenticated user's safe profile. Supports dual-transport authentication:

- **Option A:** Automatic `bhuvi_token` HttpOnly cookie.
- **Option B:** `Authorization: Bearer <token>` HTTP header.

### Request

```http
GET /api/v1/auth/me HTTP/1.1
Host: localhost:3001
Cookie: bhuvi_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

_Or via header:_

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "id": "150b688a-b611-4522-8d50-281d0475c64e",
    "email": "vinayak.gund@example.com",
    "name": "Vinayak Gund",
    "createdAt": "2026-11-07T03:43:55.225Z",
    "updatedAt": "2026-11-07T03:43:55.225Z"
  },
  "meta": {
    "timestamp": "2026-11-07T03:43:55.600Z",
    "version": "1.0.0"
  }
}
```

### Error Responses

#### 401 Unauthorized (Missing or Expired Token)

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required: missing or invalid bearer token"
  },
  "meta": {
    "timestamp": "2026-11-07T03:43:55.650Z",
    "version": "1.0.0"
  }
}
```

---

## 4. POST /api/v1/auth/logout

Terminates the session and clears the `bhuvi_token` HttpOnly cookie.

### Request

```http
POST /api/v1/auth/logout HTTP/1.1
Host: localhost:3001
Cookie: bhuvi_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Success Response (200 OK)

**Headers:**

```http
Set-Cookie: bhuvi_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly
```

**Body:**

```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  },
  "meta": {
    "timestamp": "2026-11-07T03:43:55.700Z",
    "version": "1.0.0"
  }
}
```
