# KBM Logic v4 - Startup Script
# This script installs dependencies and starts the development servers

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  KBM Logic v4 - Startup Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "Error: package.json not found. Please run this script from the project root." -ForegroundColor Red
    exit 1
}

# Step 1: Install dependencies
Write-Host "Step 1: Installing dependencies..." -ForegroundColor Yellow
Write-Host ""

# Install root dependencies
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing root dependencies..." -ForegroundColor Green
    npm install
}

# Install server dependencies
if (-not (Test-Path "server\node_modules")) {
    Write-Host "Installing server dependencies..." -ForegroundColor Green
    Set-Location server
    npm install
    Set-Location ..
}

# Install client dependencies
if (-not (Test-Path "client\node_modules")) {
    Write-Host "Installing client dependencies..." -ForegroundColor Green
    Set-Location client
    npm install
    Set-Location ..
}

Write-Host ""
Write-Host "Step 2: Checking environment files..." -ForegroundColor Yellow

# Check for server .env
if (-not (Test-Path "server\.env")) {
    Write-Host "Creating server/.env file..." -ForegroundColor Green
    @"
MONGODB_URI=mongodb://localhost:27017/kbm-logic-v4
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
"@ | Out-File -FilePath "server\.env" -Encoding utf8
    Write-Host "Created server/.env with default values" -ForegroundColor Yellow
    Write-Host "Please update MONGODB_URI if using MongoDB Atlas" -ForegroundColor Yellow
}

# Check for client .env (optional - has fallbacks)
if (-not (Test-Path "client\.env")) {
    Write-Host "Client .env is optional (using fallback values)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Step 3: Starting development servers..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Backend will run on: http://localhost:5000" -ForegroundColor Cyan
Write-Host "Frontend will run on: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop both servers" -ForegroundColor Yellow
Write-Host ""

# Start both servers
npm run dev

