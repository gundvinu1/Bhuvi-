# BHUVI – Docker Compose Stack Guide

## 1. Stack Definition

The local infrastructure stack is located at `infrastructure/docker/docker-compose.yml`.

Services included:
1. **`postgres`:** PostgreSQL 16 Alpine container with persistent volume and healthcheck.
2. **`redis`:** Redis 7 Alpine container with persistent volume and healthcheck.

---

## 2. Starting the Stack

From monorepo root:

```powershell
# Using PowerShell helper script:
.\infrastructure\scripts\start-infrastructure.ps1

# Or directly with Docker Compose:
cd infrastructure/docker
docker compose up -d
```

---

## 3. Stopping the Stack

```powershell
# Using PowerShell helper script:
.\infrastructure\scripts\stop-infrastructure.ps1

# Or directly:
cd infrastructure/docker
docker compose down
```

To stop and remove persistent database volumes (reset data):
```powershell
docker compose down -v
```

---

## 4. Health Inspection

Inspect container statuses and health probes:

```powershell
cd infrastructure/docker
docker compose ps
```

Expected healthy output:
```
NAME             IMAGE               STATUS                    PORTS
bhuvi-postgres   postgres:16-alpine  Up (healthy) 5432->5432   0.0.0.0:5432->5432/tcp
bhuvi-redis      redis:7-alpine      Up (healthy) 6379->6379   0.0.0.0:6379->6379/tcp
```
