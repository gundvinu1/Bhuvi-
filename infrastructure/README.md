# BHUVI Infrastructure

This directory contains infrastructure configuration files for local development and future production deployment.

## Directory Structure

```
infrastructure/
├── docker/           ← Docker Compose files (Module 03)
├── postgres/         ← PostgreSQL initialization scripts (Module 03)
├── redis/            ← Redis configuration (Module 03)
└── scripts/          ← Infrastructure automation scripts
```

## Status

📋 **Planned for Module 03** – Database & Infrastructure

None of the services below are required for Module 01 development.

## Planned Services

| Service | Purpose | Module |
|---------|---------|--------|
| PostgreSQL 16 | Primary database | 03 |
| Redis 7 | Cache & job queue | 03 |
| Ollama | Local AI inference | 05 |
| n8n | Workflow automation | 15 |

## Quick Start (Future)

```powershell
# Start all infrastructure services
docker compose -f infrastructure/docker/docker-compose.yml up -d

# Check status
docker compose -f infrastructure/docker/docker-compose.yml ps
```

