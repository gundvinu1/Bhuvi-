# BHUVI – Redis 7 Setup Guide

## 1. Overview

BHUVI uses **Redis 7** as an in-memory data store for the **BullMQ** background job queue engine.

- **Default Port:** `6379`
- **Default Host:** `localhost`
- **Connection URL:** `redis://localhost:6379`
- **Default Password:** None in development; set via `REDIS_PASSWORD` in production.
- **Persistence:** AOF (Append Only File) enabled with snapshots every 60 seconds.

---

## 2. Option A: Docker Compose (Recommended)

1. Start Redis container:
   ```powershell
   cd infrastructure/docker
   docker compose up -d redis
   ```
2. Verify Redis health:
   ```powershell
   docker exec -it bhuvi-redis redis-cli ping
   # Expected output: PONG
   ```

---

## 3. Option B: Native Windows Redis (Memurai / WSL2)

Because official Redis discontinued native Windows ports, Windows users can use:

### Sub-Option B1: WSL2 (Windows Subsystem for Linux)

```bash
wsl --install
sudo apt update && sudo apt install redis-server -y
sudo service redis-server start
redis-cli ping
# Expected output: PONG
```

### Sub-Option B2: Memurai for Windows

Download and install Memurai (Redis-compatible Windows native service) from:  
https://www.memurai.com/

---

## 4. BullMQ Queue Compatibility

BHUVI uses `@bhuvi/queue` which establishes connection using `ioredis`.
When Redis is offline:

- The API health check accurately reports:
  ```json
  {
    "status": "degraded",
    "dependencies": {
      "redis": "disconnected"
    }
  }
  ```
- The worker stays in standby and automatically reconnects once Redis becomes reachable.
