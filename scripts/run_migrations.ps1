# ==============================================================================
# AI Event Planner - Database Migration Runner (PowerShell)
# ==============================================================================
[CmdletBinding()]
param(
    [string]$Revision = "head"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$BackendDir = Join-Path $ProjectRoot "backend"

Write-Host "==> Running database migrations ($Revision)..." -ForegroundColor Cyan

Set-Location $BackendDir

$VenvPython = Join-Path $BackendDir ".venv\Scripts\python.exe"
if (Test-Path $VenvPython) {
    & $VenvPython -m alembic upgrade $Revision
    & $VenvPython -m alembic current
} else {
    python -m alembic upgrade $Revision
    python -m alembic current
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "==> Migrations applied successfully." -ForegroundColor Green
} else {
    Write-Error "Migration execution failed with exit code $LASTEXITCODE"
}

