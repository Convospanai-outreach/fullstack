#!/bin/bash
# ConvoSpan Local Setup Script (Unix)

echo "🚀 Setting up ConvoSpan for local development..."

if [ ! -f .env ]; then
  echo "📄 Creating .env from .env.example..."
  cp .env.example .env
  echo "⚠️  Please update .env with your secrets!"
fi

echo "📦 Installing root dependencies..."
npm install

echo "🗄️ Initializing Prisma..."
npx prisma generate

echo "🐳 Building Docker images for local orchestration..."
docker compose build

echo "✅ Setup complete. Run 'docker compose up' to start the system."
echo "🔗 UI: http://localhost:3000"
echo "🔗 Edge Node: http://localhost:8000"
