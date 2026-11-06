# BHUVI API Documentation

> Base URL: `http://localhost:3001/api/v1`

## Available Endpoints (Module 01)

### GET /api/v1/health

Returns the current API health status.

**Request**
```http
GET /api/v1/health HTTP/1.1
Host: localhost:3001
```

**Response (200 OK)**
```json
{
  "application": "BHUVI",
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2026-11-06T05:12:00.000Z",
  "uptime": 42
}
```

| Field | Type | Description |
|-------|------|-------------|
| `application` | string | Always `"BHUVI"` |
| `status` | `"healthy"` \| `"degraded"` \| `"unhealthy"` | Current status |
| `version` | string | Application version |
| `timestamp` | ISO 8601 string | Server timestamp at time of request |
| `uptime` | number | Seconds since server started |

> **Note:** This endpoint does **not** report database, Redis, or Ollama status as these are not yet integrated.

## Error Response Format

All errors follow the standard error envelope:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found",
    "details": {}
  },
  "meta": {
    "timestamp": "2026-11-06T05:12:00.000Z",
    "version": "1.0.0"
  }
}
```

## Future Endpoints (Planned)

| Method | Path | Module | Description |
|--------|------|--------|-------------|
| POST | `/api/v1/auth/login` | 02 | User authentication |
| GET | `/api/v1/messages` | 07 | List monitored messages |
| POST | `/api/v1/commands` | 14 | Submit natural language command |
| GET | `/api/v1/intelligence/morning` | 13 | Morning briefing |

