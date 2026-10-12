# ============================================================================
# TrafficLab — one-shot Windows setup (PowerShell 5.1+ / PowerShell 7)
#
# If script execution is blocked, run from an elevated PowerShell:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#   .\setup.ps1
#
# Installs:
#   1. dashboard dependencies (bun install)
#   2. .env with an absolute SQLite path + prisma schema push
#   3. Python engine venv + requirements (uses your installed Chrome —
#      Selenium Manager auto-downloads the matching driver)
#   4. engine-service dependencies
# ============================================================================

$ErrorActionPreference = "Stop"
$Repo = $PSScriptRoot
Set-Location $Repo

function Say($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Ok($m)  { Write-Host "  [OK] $m" -ForegroundColor Green }
function Die($m) { Write-Host "  [FAIL] $m" -ForegroundColor Red; exit 1 }

# --- 0. prerequisites ---------------------------------------------------------
Say "Checking prerequisites"
foreach ($tool in @("bun", "python", "git")) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        Die "$tool not found. Install first: winget install Git.Git ; winget install Python.Python.3.12 ; winget install Oven-sh.Bun  (then open a NEW PowerShell)"
    }
}
$pyv = python --version 2>&1
Ok "bun $(bun --version) | $pyv | git $(git --version)"

# --- 1. dashboard deps ---------------------------------------------------------
Say "Installing dashboard dependencies (bun install)"
bun install
if ($LASTEXITCODE -ne 0) { Die "bun install failed" }
Ok "dashboard dependencies installed"

# --- 2. .env + database ---------------------------------------------------------
Say "Preparing .env and SQLite database"
$dbUrl = "file:$($Repo -replace '\\','/')/db/custom.db"
if (-not (Test-Path ".env")) {
    "DATABASE_URL=$dbUrl" | Out-File -Encoding ascii ".env"
    Ok "created .env (DATABASE_URL=$dbUrl)"
} else {
    Ok ".env already exists - leaving it untouched"
}
New-Item -ItemType Directory -Force -Path "db" | Out-Null
bunx prisma generate
if ($LASTEXITCODE -ne 0) { Die "prisma generate failed" }
bunx prisma db push
if ($LASTEXITCODE -ne 0) { Die "prisma db push failed" }
Ok "database ready (db\custom.db)"

# --- 3. python engine ------------------------------------------------------------
Say "Creating Python engine virtualenv (engine\venv)"
if (-not (Test-Path "engine\venv\Scripts\python.exe")) {
    python -m venv engine\venv
    if ($LASTEXITCODE -ne 0) { Die "python -m venv failed" }
}
engine\venv\Scripts\python.exe -m pip install --upgrade pip --quiet
engine\venv\Scripts\python.exe -m pip install -r engine\requirements.txt --quiet
if ($LASTEXITCODE -ne 0) { Die "pip install failed" }
Ok "engine venv ready (selenium installed)"

# --- 4. chrome ---------------------------------------------------------------------
Say "Checking for Google Chrome"
$chromePaths = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
$chrome = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($chrome) {
    Ok "found: $chrome"
} else {
    Write-Host "  Chrome not found in the usual locations." -ForegroundColor Yellow
    Write-Host "  Install it from https://www.google.com/chrome/ before launching runs" -ForegroundColor Yellow
    Write-Host "  (or set CHROME_BINARY in .env to another Chromium browser)." -ForegroundColor Yellow
}

# --- 5. engine-service --------------------------------------------------------------
Say "Installing engine-service dependencies"
Push-Location "mini-services\engine-service"
bun install
if ($LASTEXITCODE -ne 0) { Pop-Location; Die "engine-service bun install failed" }
Pop-Location
Ok "engine-service ready"

# --- done ----------------------------------------------------------------------------
Write-Host ""
Write-Host "  Setup complete. Next:" -ForegroundColor White
Write-Host "    bun run build:prod          # production build (tunnel-ready)" -ForegroundColor White
Write-Host "    .\start-trafficlab.ps1      # starts dashboard + engine in two windows" -ForegroundColor White
Write-Host "    # then check http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "  Cloudflare Tunnel guide: README.md -> 'Option D'" -ForegroundColor White
