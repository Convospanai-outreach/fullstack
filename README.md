# ConvoSpan - AI-Powered Outreach Platform

**ConvoSpan** is an enterprise-grade AI-powered platform for intelligent sales outreach, lead management, and customer engagement automation.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env

# Set up database
npx prisma migrate dev
npx prisma generate

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
- **Multi-Provider LLM Support** (Gemini, OpenAI, Anthropic)
- **RAG System** for context-aware responses
- **Predictive Lead Scoring** with ML algorithms

### 📧 Multi-Channel Outreach
- **Email Campaigns** with A/B testing
- **LinkedIn Automation** with smart sequences
- **Event-Driven Workflows** with visual builder
- **Scheduled Campaigns** with optimal timing

### 📊 Analytics & Intelligence
- **Real-time Dashboards** with custom metrics
- **Intent Detection** using behavioral signals
- **Conversion Funnels** and cohort analysis
- **A/B Testing** with statistical significance

### 🔗 Integrations
- **CRM Sync** (HubSpot, Salesforce)
- **Payment Processing** (Razorpay)
- **Email Delivery** (SendPulse)
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
**Backend**: Next.js API Routes, Prisma ORM, PostgreSQL  
**AI**: Google Gemini, OpenAI, Custom ML Models  
**Infrastructure**: Redis, Puppeteer, Background Workers

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
NEXTAUTH_URL=https://your-domain.com
GEMINI_API_KEY=<your-key>
RAZORPAY_KEY_ID=<your-key>
RAZORPAY_KEY_SECRET=<your-secret>

# Optional
REDIS_URL=<redis-url>
SENTRY_DSN=<sentry-dsn>
```

See [SETUP.md](./docs/SETUP.md) for detailed configuration.

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

*Last Updated: January 12, 2026*
