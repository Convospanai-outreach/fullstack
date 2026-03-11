# ConvoSpan Local Setup Script (Powershell)

Write-Host "🚀 Setting up ConvoSpan for local development..." -ForegroundColor Cyan

if (-Not (Test-Path .env)) {
    Write-Host "📄 Creating .env from .env.example..." -ForegroundColor Yellow
    Copy-Item .env.example .env
    Write-Host "⚠️  Please update .env with your secrets!" -ForegroundColor Red
}

Write-Host "📦 Installing root dependencies..." -ForegroundColor Gray
npm install

Write-Host "🗄️ Initializing Prisma..." -ForegroundColor Gray
npx prisma generate

Write-Host "🐳 Building Docker images for local orchestration..." -ForegroundColor Gray
docker-compose build

Write-Host "✅ Setup complete. Run 'docker-compose up' to start the system." -ForegroundColor Green
Write-Host "🔗 UI: http://localhost:3000" -ForegroundColor Green
Write-Host "🔗 Edge Node: http://localhost:8000" -ForegroundColor Green
