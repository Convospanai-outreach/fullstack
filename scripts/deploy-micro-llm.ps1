# Phi-3-mini Deployment Script (Windows PowerShell)
# Run this script to set up the local Micro-LLM inference server

$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Phi-3-mini (MIT) - Deployment Script (Windows)" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Configuration
$MODEL_NAME = "Phi-3-mini-4k-instruct-q4.gguf"
$MODEL_URL = "https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/$MODEL_NAME"
$LLAMA_DIR = ".\llama.cpp"
$MODEL_DIR = ".\models"
$PORT = 8081

# Step 1: Check prerequisites
Write-Host ""
Write-Host "[1/5] Checking prerequisites..." -ForegroundColor Yellow

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "Error: git is required" -ForegroundColor Red
    exit 1
}

Write-Host "Prerequisites OK" -ForegroundColor Green

# Step 2: Clone llama.cpp
Write-Host ""
Write-Host "[2/5] Setting up llama.cpp..." -ForegroundColor Yellow

if (-not (Test-Path $LLAMA_DIR)) {
    git clone https://github.com/ggerganov/llama.cpp $LLAMA_DIR
    Push-Location $LLAMA_DIR
    cmake -B build
    cmake --build build --config Release
    Pop-Location
    Write-Host "llama.cpp built successfully" -ForegroundColor Green
}
else {
    Write-Host "llama.cpp already exists" -ForegroundColor Green
}

# Step 3: Download model
Write-Host ""
Write-Host "[3/5] Downloading Mistral 7B model..." -ForegroundColor Yellow

New-Item -ItemType Directory -Force -Path $MODEL_DIR | Out-Null

if (-not (Test-Path "$MODEL_DIR\$MODEL_NAME")) {
    Write-Host "Downloading model (this may take a while)..."
    Invoke-WebRequest -Uri $MODEL_URL -OutFile "$MODEL_DIR\$MODEL_NAME"
    Write-Host "Model downloaded successfully" -ForegroundColor Green
}
else {
    Write-Host "Model already downloaded" -ForegroundColor Green
}

# Step 4: Create startup script
Write-Host ""
Write-Host "[4/5] Creating startup script..." -ForegroundColor Yellow

$startScript = @"
# Start Micro-LLM Server (Phi-3-mini)
`$env:LLAMA_CPP_SERVER = ".\llama.cpp\build\bin\Release\server.exe"

if (Test-Path `$env:LLAMA_CPP_SERVER) {
    & `$env:LLAMA_CPP_SERVER ``
      -m .\models\$MODEL_NAME ``
      --port $PORT ``
      --n-gpu-layers 0 ``
      --ctx-size 512 ``
      --n-predict 128 ``
      --threads 4
} else {
    Write-Host "Error: server.exe not found. Please build llama.cpp first." -ForegroundColor Red
}
"@

$startScript | Out-File -FilePath "start-micro-llm.ps1" -Encoding UTF8
Write-Host "Startup script created: start-micro-llm.ps1" -ForegroundColor Green

# Step 5: Summary
Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Run: .\start-micro-llm.ps1"
Write-Host "2. Test endpoint in another terminal"
Write-Host "3. Configure .env: MICRO_LLM_URL=http://localhost:$PORT"
