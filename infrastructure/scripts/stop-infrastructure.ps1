# ============================================================
# BHUVI Infrastructure Shutdown Script (Windows PowerShell)
# ============================================================

$ErrorActionPreference = "Stop"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: 'docker' command is not recognized in your PATH." -ForegroundColor Red
    exit 1
}

$composeDir = Split-Path -Parent $PSScriptRoot | Join-Path -ChildPath "docker"
Set-Location $composeDir

Write-Host "Stopping PostgreSQL and Redis containers..." -ForegroundColor Yellow
docker compose down
Write-Host "Infrastructure stopped cleanly." -ForegroundColor Green

