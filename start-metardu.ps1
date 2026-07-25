$ErrorActionPreference = 'Continue'
$ProjectDir = $PSScriptRoot
$ComposeFile = Join-Path $ProjectDir 'docker-compose.yml'
$TunnelUrlFile = Join-Path $ProjectDir 'tunnel-url.txt'

# Discover cloudflared executable
$CloudflaredCandidates = @(
    'C:\Program Files (x86)\cloudflared\cloudflared.exe',
    'C:\Program Files\cloudflared\cloudflared.exe',
    (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
)
$Cloudflared = $null
foreach ($candidate in $CloudflaredCandidates) {
    if ($candidate -and (Test-Path $candidate)) {
        $Cloudflared = $candidate
        break
    }
}
if (-not $Cloudflared) {
    Write-Host '[ERROR] cloudflared executable not found. Please ensure cloudflared is installed.' -ForegroundColor Red
    exit 1
}

Write-Host '=========================================='
Write-Host '  METARDU - Full Startup'
Write-Host '=========================================='
Write-Host ''

# ── Step 1: Start Docker containers ─────────────────────────────────
Write-Host '[1/5] Starting Docker containers...'
Push-Location $ProjectDir
docker compose -f $ComposeFile up -d 2>&1 | ForEach-Object { Write-Host "       $_" }
Pop-Location

Write-Host '[1/5] Waiting for containers to become healthy...'
$maxWait = 120
$waited = 0
$requiredContainers = @('metardu-app', 'metardu-worker', 'metardu-postgres')
$containerStates = @{}

while ($waited -lt $maxWait) {
    $statuses = docker ps --format '{{.Names}} {{.Status}}' 2>$null
    
    # Reset states each check
    foreach ($container in $requiredContainers) {
        $containerStates[$container] = $null
    }
    
    # Parse status for each container
    foreach ($s in $statuses) {
        foreach ($container in $requiredContainers) {
            if ($s -match "^$container\s+(.+)$") {
                $containerStates[$container] = $matches[1]
            }
        }
    }
    
    # Check all containers exist and are healthy
    $allHealthy = $true
    foreach ($container in $requiredContainers) {
        if (-not $containerStates[$container]) {
            $allHealthy = $false
            break
        }
        if ($containerStates[$container] -notmatch 'healthy') {
            $allHealthy = $false
            break
        }
    }
    
    if ($allHealthy) { break }
    Start-Sleep -Seconds 5
    $waited += 5
    Write-Host "       Waiting... ($waited`s)"
}
if ($allHealthy) {
    Write-Host '[1/5] All containers healthy!' -ForegroundColor Green
} else {
    Write-Host '[1/5] WARNING: Containers may not be fully healthy yet.' -ForegroundColor Yellow
}

# ── Step 2: Stop any existing cloudflared (quick-tunnel) instances ───────
# Note: This stops quick-tunnel processes created by this script.
# If you use a named tunnel running as a Windows service, comment out this section
# and update step 5 to not modify the tunnel URL in docker-compose.yml
Write-Host ''
Write-Host '[2/6] Stopping any existing cloudflared processes (quick-tunnel mode)...'
Get-Process -Name cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# Clean old log
$tunnelLogFile = Join-Path $ProjectDir 'tunnel-log.txt'
if (Test-Path $tunnelLogFile) { Remove-Item $tunnelLogFile -Force }

# ── Step 3: Start quick tunnel as a detached background process ───────
Write-Host '[3/6] Starting Cloudflare Quick Tunnel...'

Start-Process -FilePath $Cloudflared -ArgumentList @('tunnel','--url','http://127.0.0.1:3000','--loglevel','info','--protocol','http2','--logfile',$tunnelLogFile) -WindowStyle Hidden

# ── Step 4: Wait for tunnel URL from log ───────────────────────────────
Write-Host '[4/6] Waiting for tunnel URL...'

$tunnelUrl = $null
$maxWait = 90
$waited = 0
while ($waited -lt $maxWait) {
    Start-Sleep -Seconds 3
    $waited += 3
    if (Test-Path $tunnelLogFile) {
        $content = Get-Content $tunnelLogFile -Raw -ErrorAction SilentlyContinue
        if ($content -match 'https://[a-z0-9-]+\.trycloudflare\.com') {
            $tunnelUrl = $Matches[0]
            break
        }
    }
    Write-Host "       Waiting... ($waited`s)"
}

if (-not $tunnelUrl) {
    Write-Host '[4/6] ERROR: Failed to capture tunnel URL!' -ForegroundColor Red
    Write-Host '       Check tunnel-log.txt for details.'
    exit 1
}

Write-Host "[4/6] Tunnel URL: $tunnelUrl" -ForegroundColor Cyan
Set-Content -Path $TunnelUrlFile -Value $tunnelUrl -NoNewline

# ── Step 5: Update docker-compose.yml with new URL ────────────────────
Write-Host '[5/6] Updating docker-compose.yml with tunnel URL...'

$compose = Get-Content $ComposeFile -Raw
$oldUrlPattern = 'https://[a-z0-9-]+\.trycloudflare\.com'
$newCompose = $compose -replace $oldUrlPattern, $tunnelUrl
Set-Content -Path $ComposeFile -Value $newCompose -NoNewline

# ── Step 6: Rebuild app container with new URL ────────────────────────
Write-Host '[6/6] Rebuilding app container with new URL...'
Push-Location $ProjectDir
docker compose -f $ComposeFile up -d --build metardu-app 2>&1 | Out-Null
Pop-Location

Write-Host ''
Write-Host '=========================================='
Write-Host '  METARDU is LIVE!' -ForegroundColor Green
Write-Host "  URL: $tunnelUrl" -ForegroundColor Cyan
Write-Host '=========================================='
