# ==============================================================================
# AI Event Planner - Database Backup Script (PowerShell)
# Creates a timestamped backup with SHA-256 integrity checksum.
# ==============================================================================
[CmdletBinding()]
param(
    [string]$OutputDir = ""
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
if ([string]::IsNullOrWhiteSpace($OutputDir)) {
    $OutputDir = Join-Path $ProjectRoot "backups"
}

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
Write-Host "==> Starting database backup at $Timestamp..." -ForegroundColor Cyan

$PostgresUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "event_user" }
$PostgresDb = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "event_planner_db" }

# Check for Docker Compose DB
$IsDockerDbRunning = $false
try {
    $composeServices = docker compose ps --services 2>$null
    if ($composeServices -match "^db$") {
        $IsDockerDbRunning = $true
    }
} catch {
    $IsDockerDbRunning = $false
}

$BackupFile = ""
if ($IsDockerDbRunning) {
    $BackupFile = Join-Path $OutputDir "db_backup_$Timestamp.sql"
    Write-Host "--> Running pg_dump inside Docker container 'db' to $BackupFile..." -ForegroundColor Gray
    docker compose exec -T db pg_dump -U $PostgresUser -d $PostgresDb --clean --if-exists | Out-File -FilePath $BackupFile -Encoding utf8
} elseif ($env:DATABASE_URL -match "postgresql" -and (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
    $BackupFile = Join-Path $OutputDir "db_backup_$Timestamp.sql"
    Write-Host "--> Running native pg_dump to $BackupFile..." -ForegroundColor Gray
    & pg_dump $env:DATABASE_URL --clean --if-exists | Out-File -FilePath $BackupFile -Encoding utf8
} else {
    $SqlitePath = Join-Path $ProjectRoot "backend\event_planner.db"
    if (Test-Path $SqlitePath) {
        $BackupFile = Join-Path $OutputDir "sqlite_backup_$Timestamp.db"
        Write-Host "--> Copying SQLite database to $BackupFile..." -ForegroundColor Gray
        Copy-Item -Path $SqlitePath -Destination $BackupFile -Force
    } else {
        Write-Error "No active database found for backup (Docker db not running, no pg_dump, no SQLite file at $SqlitePath)."
    }
}

if (-not (Test-Path $BackupFile) -or (Get-Item $BackupFile).Length -eq 0) {
    if (Test-Path $BackupFile) { Remove-Item $BackupFile -Force }
    Write-Error "Backup creation failed: generated file is empty or missing."
}

# Generate SHA-256 Checksum
$Hash = (Get-FileHash -Path $BackupFile -Algorithm SHA256).Hash
$ChecksumFile = "$BackupFile.sha256"
"$Hash *$((Get-Item $BackupFile).Name)" | Out-File -FilePath $ChecksumFile -Encoding utf8

$FileSize = [math]::Round(((Get-Item $BackupFile).Length / 1KB), 2)
Write-Host "==> Backup completed successfully!" -ForegroundColor Green
Write-Host "    File:     $BackupFile ($FileSize KB)" -ForegroundColor Gray
Write-Host "    Checksum: $ChecksumFile ($Hash)" -ForegroundColor Gray

