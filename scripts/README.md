# BHUVI Scripts

Utility scripts for the BHUVI development workflow.

## Available Scripts

> Scripts will be added as modules are implemented.

## Planned Scripts (Future Modules)

| Script | Purpose | Module |
|--------|---------|--------|
| `setup-db.ps1` | Initialize PostgreSQL database | 03 |
| `seed-db.ps1` | Seed development data | 03 |
| `backup-db.ps1` | Backup database | 18 |
| `install-ollama.ps1` | Download and configure Ollama | 05 |
| `setup-windows-service.ps1` | Install BHUVI as a Windows service | 18 |

## Windows Setup

```powershell
# Allow script execution (run once as Administrator)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

