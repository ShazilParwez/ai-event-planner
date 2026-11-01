# ==============================================================================
# AI Event Planner - Database Restore Script (PowerShell)
# Restores database from a verified backup file.
# Usage: .\scripts\restore_db.ps1 -BackupFile <path> [-Force]
# ==============================================================================
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true, Position=0)]
    [string]$BackupFile,
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

if (-not (Test-Path $BackupFile)) {
    Write-Error "Backup file not found: $BackupFile"
}

Write-Host "==> Verifying backup file: $BackupFile..." -ForegroundColor Cyan

# Checksum verification if .sha256 exists
$ChecksumFile = "$BackupFile.sha256"
if (Test-Path $ChecksumFile) {
    Write-Host "--> Verifying SHA-256 checksum..." -ForegroundColor Gray
    $ExpectedLine = Get-Content -Path $ChecksumFile -Raw
    $ExpectedHash = ($ExpectedLine -split "\s+")[0].Trim().ToUpper()
    $ActualHash = (Get-FileHash -Path $BackupFile -Algorithm SHA256).Hash.ToUpper()

    if ($ExpectedHash -ne $ActualHash) {
        Write-Error "SHA-256 checksum MISMATCH! Expected $ExpectedHash, got $ActualHash. Restore aborted."
    }
    Write-Host "--> Checksum verification PASSED." -ForegroundColor Green
}

# Prompt confirmation unless -Force
if (-not $Force) {
    Write-Host "WARNING: Restoring will overwrite existing data in the target database!" -ForegroundColor Yellow
    $Confirmation = Read-Host "Are you sure you want to proceed? Type 'yes' to confirm"
    if ($Confirmation -ne "yes") {
        Write-Host "Restore cancelled by user." -ForegroundColor Yellow
        exit 0
    }
}

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

if ($IsDockerDbRunning) {
    Write-Host "--> Restoring into Docker Compose PostgreSQL service..." -ForegroundColor Gray
    Get-Content -Path $BackupFile -Raw | docker compose exec -T db psql -U $PostgresUser -d $PostgresDb
} elseif ($env:DATABASE_URL -match "postgresql" -and (Get-Command psql -ErrorAction SilentlyContinue)) {
    Write-Host "--> Restoring via native psql..." -ForegroundColor Gray
    Get-Content -Path $BackupFile -Raw | & psql $env:DATABASE_URL
} elseif ($BackupFile -match "\.db$") {
    $TargetDb = Join-Path $ProjectRoot "backend\event_planner.db"
    Write-Host "--> Restoring SQLite database to $TargetDb..." -ForegroundColor Gray
    Copy-Item -Path $BackupFile -Destination $TargetDb -Force
} else {
    Write-Error "Could not determine restore target for $BackupFile."
}

Write-Host "==> Database restore completed successfully." -ForegroundColor Green

