# Complete Setup Script for kbm-logics-v0.0
# This script copies remaining files and installs dependencies

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  KBM Logics v0.0 - Complete Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$parentDir = Split-Path -Parent $scriptDir
$sourceDir = Join-Path $parentDir "kbm-logic-v0"

Write-Host "Script directory: $scriptDir" -ForegroundColor Gray
Write-Host "Source directory: $sourceDir" -ForegroundColor Gray
Write-Host ""

# Check if source exists
if (-not (Test-Path $sourceDir)) {
    Write-Host "ERROR: Source directory not found: $sourceDir" -ForegroundColor Red
    Write-Host "Please ensure kbm-logic-v0 exists in the same parent directory." -ForegroundColor Yellow
    exit 1
}

# Step 1: Copy client source files
Write-Host "Step 1: Copying client source files..." -ForegroundColor Yellow
$clientSrc = Join-Path $sourceDir "client\src"
$clientDst = Join-Path $scriptDir "client\src"

if (Test-Path $clientSrc) {
    # Use robocopy for reliable copying
    $result = robocopy $clientSrc $clientDst /E /XD node_modules /NFL /NDL /NJH /NJS /nc /ns /np
    if ($LASTEXITCODE -le 7) {
        Write-Host "   Client source files copied successfully" -ForegroundColor Green
    } else {
        Write-Host "   Warning: Some files may not have copied" -ForegroundColor Yellow
    }
} else {
    Write-Host "   Warning: Client source not found at $clientSrc" -ForegroundColor Yellow
}

# Step 2: Copy server files
Write-Host "Step 2: Copying server files..." -ForegroundColor Yellow
$serverSrc = Join-Path $sourceDir "server"
$serverDst = Join-Path $scriptDir "server"

if (Test-Path $serverSrc) {
    $result = robocopy $serverSrc $serverDst /E /XD node_modules /XF package-lock.json /NFL /NDL /NJH /NJS /nc /ns /np
    if ($LASTEXITCODE -le 7) {
        Write-Host "   Server files copied successfully" -ForegroundColor Green
    } else {
        Write-Host "   Warning: Some files may not have copied" -ForegroundColor Yellow
    }
} else {
    Write-Host "   Warning: Server source not found at $serverSrc" -ForegroundColor Yellow
}

# Step 3: Copy docs
Write-Host "Step 3: Copying documentation..." -ForegroundColor Yellow
$docsSrc = Join-Path $sourceDir "docs"
$docsDst = Join-Path $scriptDir "docs"

if (Test-Path $docsSrc) {
    $result = robocopy $docsSrc $docsDst /E /NFL /NDL /NJH /NJS /nc /ns /np
    if ($LASTEXITCODE -le 7) {
        Write-Host "   Documentation copied successfully" -ForegroundColor Green
    }
} else {
    Write-Host "   Warning: Docs not found at $docsSrc" -ForegroundColor Yellow
}

# Step 4: Copy root files
Write-Host "Step 4: Copying root files..." -ForegroundColor Yellow
$rootFiles = @(".gitignore", "start.ps1")
foreach ($file in $rootFiles) {
    $srcFile = Join-Path $sourceDir $file
    $dstFile = Join-Path $scriptDir $file
    if (Test-Path $srcFile) {
        Copy-Item $srcFile $dstFile -Force
        Write-Host "   Copied $file" -ForegroundColor Green
    }
}

# Step 5: Install dependencies
Write-Host ""
Write-Host "Step 5: Installing dependencies..." -ForegroundColor Yellow

Set-Location $scriptDir

Write-Host "   Installing root dependencies..." -ForegroundColor Gray
npm install 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "   Root dependencies installed" -ForegroundColor Green
}

Write-Host "   Installing client dependencies..." -ForegroundColor Gray
Set-Location (Join-Path $scriptDir "client")
npm install 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "   Client dependencies installed" -ForegroundColor Green
}

Write-Host "   Installing server dependencies..." -ForegroundColor Gray
Set-Location (Join-Path $scriptDir "server")
npm install 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "   Server dependencies installed" -ForegroundColor Green
}

Set-Location $scriptDir

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "To start the project, run:" -ForegroundColor Cyan
Write-Host "  npm run dev" -ForegroundColor White
Write-Host ""

