# BHUVI – PostgreSQL Setup Guide

## 1. Overview

BHUVI uses **PostgreSQL 16** as its persistent relational database.

- **Default Port:** `5432`
- **Default Database:** `bhuvi`
- **Default User:** `bhuvi`
- **Default Password:** `bhuvi_dev_password` (configurable via `POSTGRES_PASSWORD` in `.env`)
- **Connection URL:** `postgresql://bhuvi:bhuvi_dev_password@localhost:5432/bhuvi`

---

## 2. Option A: Docker Compose (Recommended)

If you have Docker Desktop installed on Windows 11:

1. Start the container:
   ```powershell
   cd infrastructure/docker
   docker compose up -d postgres
   ```
2. Verify status:
   ```powershell
   docker compose ps
   ```
3. Run migrations:
   ```powershell
   cd ../..
   pnpm db:deploy
   ```

---

## 3. Option B: Native Windows PostgreSQL Installation

If Docker Desktop is not installed or preferred:

1. Download the official PostgreSQL 16 Windows installer from:  
   https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
2. Run installer and choose:
   - Port: `5432`
   - Superuser password: (set your chosen password)
3. Open `psql` or `pgAdmin` and create the `bhuvi` database:
   ```sql
   CREATE DATABASE bhuvi;
   CREATE USER bhuvi WITH PASSWORD 'bhuvi_dev_password';
   GRANT ALL PRIVILEGES ON DATABASE bhuvi TO bhuvi;
   ```
4. Update `DATABASE_URL` in `.env` to match your credentials:
   ```env
   DATABASE_URL=postgresql://bhuvi:bhuvi_dev_password@localhost:5432/bhuvi
   ```
5. Apply migrations:
   ```powershell
   pnpm db:deploy
   ```

---

## 4. Troubleshooting on Windows 11

- **Port Conflict (Port 5432 already in use):**
  Check which service is using port 5432:
  ```powershell
  Get-NetTCPConnection -LocalPort 5432
  ```
  If another Postgres instance is running, you can change `POSTGRES_PORT=5433` in `.env` and `DATABASE_URL=postgresql://bhuvi:bhuvi_dev_password@localhost:5433/bhuvi`.
