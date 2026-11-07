# ============================================================
# BHUVI Infrastructure Startup Script (Windows PowerShell)
# ============================================================

$ErrorActionPreference = "Stop"

Write-Host "Checking Docker availability..." -ForegroundColor Cyan

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: 'docker' command is not recognized in your PATH." -ForegroundColor Red
    Write-Host "Please ensure Docker Desktop is installed and running." -ForegroundColor Yellow
    Write-Host "Download Docker Desktop: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

$composeDir = Split-Path -Parent $PSScriptRoot | Join-Path -ChildPath "docker"
Set-Location $composeDir

Write-Host "Starting PostgreSQL and Redis containers..." -ForegroundColor Green
docker compose up -d

Write-Host "Waiting for containers to be healthy..." -ForegroundColor Cyan
docker compose ps
