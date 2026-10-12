# ============================================================================
# TrafficLab — one-command launcher (Windows PowerShell)
#
# Starts BOTH services in separate PowerShell windows:
#   Window 1: engine-service  (socket.io on :3003, REST on :3004)
#   Window 2: dashboard       (Next.js standalone on :3000)
#
# Prerequisite: run .\setup.ps1 and  bun run build:prod  at least once.
#
# If script execution is blocked:
#   powershell -ExecutionPolicy Bypass -File .\start-trafficlab.ps1
# ============================================================================

$ErrorActionPreference = "Stop"
$Repo = $PSScriptRoot
$dbUrl = "file:$($Repo -replace '\\','/')/db/custom.db"

if (-not (Test-Path "$Repo\.next\standalone\server.js")) {
    Write-Host "Production build not found - running bun run build:prod first..." -ForegroundColor Yellow
    Set-Location $Repo
    bun run build:prod
    if ($LASTEXITCODE -ne 0) { Write-Host "build failed" -ForegroundColor Red; exit 1 }
}

# --- Window 1: engine-service (SOCK_PATH matches the tunnel config) -----------
$engineCmd = @"
`$env:SOCK_PATH  = '/engine-socket/socket.io'
`$env:ENGINE_DIR = '$Repo\engine'
Set-Location '$Repo\mini-services\engine-service'
Write-Host 'TrafficLab engine-service - socket.io :3003 / REST :3004' -ForegroundColor Cyan
bun index.ts
Write-Host '' ; Write-Host 'engine-service exited.' -ForegroundColor Yellow
Read-Host 'Press Enter to close'
"@
Start-Process pwsh -ArgumentList '-NoExit', '-Command', $engineCmd
Write-Host "started: engine-service window" -ForegroundColor Green

Start-Sleep -Seconds 2

# --- Window 2: dashboard (Next.js standalone) ----------------------------------
$dashCmd = @"
`$env:DATABASE_URL = '$dbUrl'
`$env:PORT         = '3000'
`$env:HOSTNAME     = '127.0.0.1'
Set-Location '$Repo'
Write-Host 'TrafficLab dashboard - http://localhost:3000' -ForegroundColor Cyan
bun .next\standalone\server.js
Write-Host '' ; Write-Host 'dashboard exited.' -ForegroundColor Yellow
Read-Host 'Press Enter to close'
"@
Start-Process pwsh -ArgumentList '-NoExit', '-Command', $dashCmd
Write-Host "started: dashboard window" -ForegroundColor Green

Write-Host ""
Write-Host "  Dashboard:   http://localhost:3000" -ForegroundColor White
Write-Host "  Local check: you should see 'Engine online' within a few seconds." -ForegroundColor White
Write-Host "  Stop: close both windows (active runs will be stopped)." -ForegroundColor White
Write-Host ""
Write-Host "  Next (tunnel): cloudflared tunnel run trafficlab" -ForegroundColor White
Write-Host "  -> https://trafficlab.creedbixby.lat" -ForegroundColor White
