# BHUVI – Authentication API Specification

Base URL: `http://localhost:3001/api/v1`

---

## 1. POST /api/v1/auth/register

Registers a new user and returns a signed access token.

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

---

## 2. POST /api/v1/auth/login

Authenticates credentials and returns a signed access token.

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

---

## 3. GET /api/v1/auth/me

Returns the authenticated user's safe profile. Requires a valid JWT Bearer token in the `Authorization` header.

### Request

```http
GET /api/v1/auth/me HTTP/1.1
Host: localhost:3001
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
