# ConvoSpan - AI-Powered Outreach Platform

**ConvoSpan** is an enterprise-grade AI-powered platform for intelligent sales outreach, lead management, and customer engagement automation.

## 🚀 Quick Start

### Option A: Professional Docker Orchestration (Self-Hosted/Prod)
```bash
# Set up environment
cp .env.example .env

# Run the production setup script
./setup-dev.sh  # Unix
# OR
.\setup-dev.ps1 # Windows

# Start the entire system
docker compose up -d
```

### Option B: Local Node.js Development
```bash
# Install dependencies
npm install

# Set up Python environment (Required for AI Orchestrator)
# We recommend using 'uv' for fast, reliable dependency management
uv venv venv --python 3.11
# On Windows:
.\venv\Scripts\activate.ps1
uv pip install -r requirements.txt

# Set up database & env
cp .env.example .env
npx prisma generate
npx prisma migrate dev

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## 📚 Documentation

- **[Architecture & Framework](./docs/ARCHITECTURE.md)** - Complete system architecture
- **[Setup Guide](./docs/SETUP.md)** - Detailed installation instructions
- **[API Reference](./docs/API_REFERENCE.md)** - API documentation
- **[Monitoring](./docs/MONITORING.md)** - System monitoring guide

## ✨ Key Features

### 🤖 AI-Powered Automation
- **Autonomous AI Agents** with human-in-the-loop controls
- **Multi-Provider LLM Support** (Gemini, OpenAI, Anthropic, Ollama Local)
- **RAG System** for context-aware responses
- **Predictive Lead Scoring** with ML algorithms

### 📧 Multi-Channel Outreach
- **Autonomous Knowledge Engine** for context-rich, real-time lead intelligence
- **3-Node AI Composer** with specialized Node A/B/C outreach strategies
- **Email Campaigns** with A/B testing and secure team-level SMTP
- **LinkedIn Automation** with smart, bio-enriched sequences
- **Event-Driven Workflows** with visual builder

### 📊 Analytics & Intelligence
- **Real-time Dashboards** with custom metrics
- **Intent Detection** using behavioral signals
- **Conversion Funnels** and cohort analysis
- **A/B Testing** with statistical significance

### 🔗 Integrations
- **Model Context Protocol (MCP)** for cross-platform data ingestion (Netjana)
- **CRM Sync** (HubSpot, Salesforce)
- **Payment Processing** (Razorpay)
- **Secure SMTP** (Google Business integration with AES-256 encryption)
- **Web Scraping** (Puppeteer)
- **Webhooks** for custom integrations

### 🛡️ Enterprise Governance
- **Approval Workflows** for sensitive actions
- **Content Guardrails** with PII detection
- **Audit Logging** for compliance
- **RBAC** with team-level isolation
- **SSO Support** (SAML/OIDC)

## 🏗️ Architecture

### Technology Stack

**Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS  
**Backend**: Next.js API Routes, Prisma ORM, PostgreSQL, **Model Context Protocol (MCP)**  
**AI**: Google Gemini, OpenAI, Claude, Ollama (Local), **TOON Serialization**  
**Infrastructure**: Redis, Puppeteer, Background Workers, AES-256 Encryption

### System Overview

```
┌─────────────────────────────────────────────────┐
│          Next.js App (SSR/SSG)                  │
│    202 Pages │ 200+ API Routes │ 41 Modules    │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│         AI Framework & Business Logic           │
│  AgentExecutor │ ModelGateway │ Workflows      │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│            Data Layer (Prisma ORM)              │
│  PostgreSQL │ 50+ Models │ Vector Search       │
└─────────────────────────────────────────────────┘
```

See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for complete details.

## 📦 Core Modules (41 Total)

**AI & Agents**: agent, ai, ai-content, scoring, learning, rag  
**Outreach**: email-campaigner, linkedin-runner, automations, scheduler, workflow  
**Analytics**: analytics, ab-testing, dashboard, graph, monitoring  
**Leads**: csv-ingestion, enrichment, hunter-email-finder, icp-builder, scraper-bridge  
**Integrations**: crm-integration, webhooks, knowledge, playbooks  
**Governance**: governance, audit, rate-limit, settings  
**Business**: billing, usage, team, onboarding, notifications  
**Utilities**: admin, branding, bulk, data-export, help, profile, search

## 🔐 Security & Compliance

- **Data Sovereignty**: Local-first AI processing
- **PII Protection**: Automatic detection and masking
- **DPDP Act 2023**: Full compliance (India)
- **GDPR**: Data portability and erasure
- **Audit Trail**: Complete activity logging
- **Rate Limiting**: Abuse prevention
- **Multi-tenancy**: Team-level data isolation

## 🚀 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel Dashboard
```

### Environment Variables

```bash
# Required
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=<generate-with-openssl>
NEXTAUTH_URL=http://localhost:3000
GEMINI_API_KEY=<your-key>
ENCRYPTION_KEY=<32-char-hex-key>

# Optional
NETJANA_MCP_URL=http://localhost:4000/mcp
STRICT_SOVEREIGNTY=false
REDIS_URL=<redis-url>
SENTRY_DSN=<sentry-dsn>
```

See [SETUP.md](./docs/SETUP.md) for detailed configuration.

### AI Engine Intelligence
The outreach engine implements a **Triple-Loop Intelligence** system:

1.  **Self-Learning (Outcome Flywheel)**: The system automatically synthesizes "Lessons Learned" from both human feedback (ratings) and outcome analysis (successful replies). These are stored in `AgentMemory` and injected into future prompts as contextual memories.
2.  **Self-Checking (Critique Loop)**: Every draft is audited by a separate "Senior Copy Editor" AI persona before being approved. It checks for:
    *   Generic "vendor" tone vs Peer-to-peer style.
    *   Specificity of the signal-driven opening.
    *   Adhesion to length and friction constraints.
    *   PII leakage and Hallucination detection.
3.  **Self-Correcting (Remediation Loop)**: If a draft fails the critique, the engine automatically rewrites it based on the feedback, logging the "pivot" as part of its internal reasoning chain.

This ensures that the outreach becomes more effective over time, adapting to specific team successes and prospect preferences.

## 🧪 Testing

```bash
# Type checking
npm run typecheck

# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage report
npm run test:coverage

# Note: On Windows, Playwright cache is redirected to ./.playwright-cache
# to avoid EPERM errors in C:\WINDOWS\TEMP
```

## 📊 Project Stats

- **Total Routes**: 202 pages
- **API Endpoints**: 200+
- **Feature Modules**: 41
- **Database Models**: 50+
- **Lines of Code**: 100,000+
- **Build Time**: ~6 minutes
- **TypeScript**: Strict mode, 0 errors

## 🛠️ Development

### Prerequisites
- Node.js 18+
- Python 3.11 (Managed via 'uv' recommended)
- PostgreSQL 14+
- Redis (optional, for caching)

### Project Structure
```
fullstack/
├── src/
│   ├── app/              # Next.js App Router (202 pages)
│   ├── components/       # React components
│   ├── modules/          # 41 feature modules
│   ├── lib/              # Utilities & configs
│   ├── ai/               # AI framework
│   └── workers/          # Background workers
├── prisma/
│   └── schema.prisma     # Database schema (50+ models)
├── tests/                # Unit tests
├── e2e/                  # E2E tests
└── docs/                 # Documentation
```

### Key Commands
```bash
npm run dev              # Start dev server
npm run build            # Production build
npm run typecheck        # TypeScript validation
npx prisma studio        # Database GUI
npx prisma migrate dev   # Create migration
```

## 📈 Performance

- **Build**: Optimized with code splitting
- **SSR/SSG**: Hybrid rendering strategy
- **Caching**: Multi-layer (CDN, Redis, SWR)
- **Database**: Indexed queries, connection pooling
- **API**: Rate-limited, cached responses

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm run test`
5. Submit a pull request

## 📄 License

Proprietary - ConvoSpan Inc.

## 🆘 Support

- **Documentation**: `/docs` folder
- **Issues**: GitHub Issues
- **Email**: support@convospan.com

---

**Built with ❤️ by the ConvoSpan Team**

*Last Updated: March 2026*
