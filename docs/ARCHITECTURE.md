# ConvoSpan Architecture & Framework Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture Layers](#architecture-layers)
4. [Core Modules](#core-modules)
5. [AI Framework](#ai-framework)
6. [Data Architecture](#data-architecture)
7. [API Structure](#api-structure)
8. [Security & Compliance](#security--compliance)
9. [Deployment Architecture](#deployment-architecture)

---

## System Overview

**ConvoSpan** is an enterprise-grade AI-powered outreach and lead management platform built with a modern full-stack architecture. The application provides intelligent automation for sales, marketing, and customer engagement workflows.

### Key Capabilities
- 🤖 **Autonomous AI Agents** with human-in-the-loop controls
- 📧 **Multi-channel Outreach** (Email, LinkedIn, Social)
- 📊 **Predictive Analytics** with ML-powered lead scoring
- 🔄 **Workflow Automation** with visual builder
- 🛡️ **Enterprise Governance** with compliance guardrails
- 📈 **Real-time Analytics** and A/B testing
- 🔗 **CRM Integration** (HubSpot, Salesforce)

---

## Technology Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 16.0.10 | React framework with App Router |
| **React** | 19.2.0 | UI library |
| **TypeScript** | 5.9.3 | Type safety |
| **Tailwind CSS** | 4.1.17 | Styling framework |
| **Framer Motion** | 12.23.26 | Animations |
| **React Flow** | 11.11.4 | Workflow visual builder |
| **Recharts** | 3.5.1 | Data visualization |
| **Three.js** | 0.182.0 | 3D graphics |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 18+ | Runtime environment |
| **Next.js API Routes** | 16.0.10 | API layer |
| **Prisma** | 5.22.0 | ORM and database toolkit |
| **PostgreSQL** | 14+ | Primary database |
| **Redis** | 5.10.0 | Caching and job queue |
| **NextAuth.js** | 4.24.13 | Authentication |

### AI & ML
| Technology | Purpose |
|------------|---------|
| **Google Gemini** | Primary LLM for content generation |
| **OpenAI** | Alternative LLM provider |
| **Anthropic Claude** | Alternative LLM provider |
| **Custom Vector Store** | RAG and semantic search |
| **Proprietary Algorithms** | Lead scoring, intent detection |

### Integrations
| Service | Purpose |
|---------|---------|
| **Razorpay** | Payment processing |
| **SendPulse** | Email delivery |
| **HubSpot** | CRM integration |
| **Salesforce** | CRM integration |
| **Puppeteer** | Web scraping & automation |

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                       │
│  Next.js App Router │ React Components │ Client State (SWR) │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      API LAYER (REST)                        │
│     /api/* Routes │ Middleware │ Auth Guards │ Validation   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     BUSINESS LOGIC LAYER                     │
│   41 Feature Modules │ Services │ Domain Logic │ Workflows  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      DATA ACCESS LAYER                       │
│         Prisma ORM │ Query Optimization │ Transactions      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE LAYER                      │
│  PostgreSQL │ Redis │ File Storage │ External APIs │ Queue  │
└─────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

#### 1. Presentation Layer
- **Location**: `src/app/`, `src/components/`
- **Responsibilities**:
  - Server-side rendering (SSR) and static generation (SSG)
  - Client-side routing and navigation
  - UI component composition
  - State management with SWR
  - Form handling and validation

#### 2. API Layer
- **Location**: `src/app/api/`
- **Responsibilities**:
  - RESTful endpoint definitions
  - Request/response handling
  - Authentication and authorization
  - Input validation with Zod
  - Rate limiting
  - Error handling

#### 3. Business Logic Layer
- **Location**: `src/modules/`, `src/lib/`
- **Responsibilities**:
  - Domain-specific business rules
  - Service orchestration
  - Workflow execution
  - AI agent coordination
  - Data transformation

#### 4. Data Access Layer
- **Location**: `prisma/`, `src/lib/db.ts`
- **Responsibilities**:
  - Database schema management
  - Query optimization
  - Transaction management
  - Data validation
  - Migration handling

#### 5. Infrastructure Layer
- **Responsibilities**:
  - Database connections
  - Cache management
  - External API integrations
  - Job queue processing
  - File storage

---

## Core Modules

ConvoSpan is organized into **41 feature modules**, each encapsulating specific business capabilities:

### 1. Agent & AI Modules
| Module | Purpose | Key Files |
|--------|---------|-----------|
| **agent** | Autonomous AI agent core | `AgentExecutor.ts`, `ToolRegistry.ts` |
| **ai** | AI service abstraction | `ModelGateway.ts`, `SovereignFirewall.ts` |
| **ai-content** | AI-powered content generation | Content generation services |
| **scoring** | Lead scoring & intent detection | `VerificationAgent.ts`, `compare.ts` |
| **learning** | Feedback loop & model improvement | Learning algorithms |
| **rag** | Retrieval-Augmented Generation | `CaseStudyService.ts`, vector store |

### 2. Outreach & Campaign Modules
| Module | Purpose |
|--------|---------|
| **email-campaigner** | Email campaign orchestration |
| **linkedin-runner** | LinkedIn automation |
| **automations** | Event-driven automation rules |
| **scheduler** | Cron-based task scheduling |
| **workflow** | Visual workflow builder & engine |

### 3. Data & Analytics Modules
| Module | Purpose |
|--------|---------|
| **analytics** | Campaign analytics & metrics |
| **ab-testing** | A/B test management |
| **dashboard** | Dashboard data aggregation |
| **graph** | Relationship graph analysis |
| **monitoring** | System health monitoring |

### 4. Lead Management Modules
| Module | Purpose |
|--------|---------|
| **csv-ingestion** | CSV import with AI mapping |
| **enrichment** | Lead data enrichment |
| **hunter-email-finder** | Email discovery service |
| **icp-builder** | Ideal Customer Profile builder |
| **scraper-bridge** | Web scraping service |

### 5. Integration Modules
| Module | Purpose |
|--------|---------|
| **crm-integration** | HubSpot/Salesforce sync |
| **webhooks** | Webhook management |
| **knowledge** | Knowledge base management |
| **playbooks** | Reusable playbook templates |

### 6. Governance & Compliance Modules
| Module | Purpose |
|--------|---------|
| **governance** | Approval workflows & policies |
| **audit** | Audit logging service |
| **rate-limit** | API rate limiting |
| **settings** | User/team settings |

### 7. Business Operations Modules
| Module | Purpose |
|--------|---------|
| **billing** | Subscription & payment management |
| **usage** | Credit tracking & metering |
| **team** | Multi-tenant team management |
| **onboarding** | User onboarding flows |
| **notifications** | In-app & email notifications |

### 8. Utility Modules
| Module | Purpose |
|--------|---------|
| **admin** | Admin dashboard & controls |
| **branding** | White-label customization |
| **bulk** | Bulk operations |
| **data-export** | Data export service |
| **help** | Help & documentation search |
| **profile** | User profile management |
| **search** | Global search |

---

## AI Framework

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    AI ORCHESTRATION                      │
│                   AgentExecutor.ts                       │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│                    MODEL GATEWAY                         │
│     ModelGateway.ts (Provider Abstraction)              │
│   Gemini │ OpenAI │ Anthropic │ Fallback Logic         │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│                  SOVEREIGN FIREWALL                      │
│    PII Detection │ Content Filtering │ Compliance       │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│                    TOOL REGISTRY                         │
│   Email Send │ CRM Update │ Web Search │ Data Query    │
└─────────────────────────────────────────────────────────┘
```

### Key Components

#### 1. AgentExecutor
- **File**: `src/modules/agent/core/AgentExecutor.ts`
- **Purpose**: Autonomous agent state machine
- **States**: PLANNING → EXECUTING → REVIEWING → COMPLETED
- **Features**:
  - Confidence-based HITL (Human-in-the-Loop)
  - Tool execution
  - Context management
  - Error recovery

#### 2. ModelGateway
- **File**: `src/ai/ModelGateway.ts`
- **Purpose**: Multi-provider LLM abstraction
- **Features**:
  - Provider selection based on task complexity
  - Automatic fallback on failure
  - Token counting and cost tracking
  - Response caching

#### 3. SovereignFirewall
- **File**: `src/ai/SovereignFirewall.ts`
- **Purpose**: Data protection layer
- **Features**:
  - PII detection and masking
  - Content filtering
  - DPDP Act 2023 compliance
  - Reversible tokenization

#### 4. RAG System
- **Files**: `src/modules/rag/`, `src/modules/scoring/service/CaseStudyService.ts`
- **Purpose**: Retrieval-Augmented Generation
- **Features**:
  - Vector embeddings with pgvector
  - Semantic search
  - Case study grounding
  - Local-first data processing

---

## Data Architecture

### Database Schema Overview

ConvoSpan uses **PostgreSQL** with **Prisma ORM** and **pgvector** extension for vector operations.

#### Core Entities (50+ models)

**User & Team Management**
- `User` - User accounts
- `Team` - Multi-tenant organizations
- `TeamMember` - Team membership
- `Subscription` - Billing subscriptions
- `Plan` - Subscription plans

**Lead & Campaign Management**
- `Lead` - Contact records with ML scoring
- `Campaign` - Outreach campaigns
- `CampaignVariant` - A/B test variants
- `Email` - Email tracking
- `Message` - Multi-channel messages
- `Task` - Follow-up tasks

**AI & Automation**
- `Agent` - AI agent definitions
- `AgentTask` - Agent execution tasks
- `AgentLog` - Agent activity logs
- `AgentMemory` - Learning memory
- `AgentFeedback` - Human feedback
- `AgentFeedbackLoop` - Feedback loops
- `Automation` - Event-driven rules
- `AutomationLog` - Automation execution logs
- `Workflow` - Visual workflows
- `WorkflowRun` - Workflow executions
- `AiTrace` - AI call tracing

**Analytics & Scoring**
- `Activity` - User activity tracking
- `CaseStudy` - RAG case studies
- `ICP` - Ideal Customer Profiles

**Governance & Compliance**
- `AuditLog` - Audit trail
- `ApprovalRequest` - HITL approvals
- `GuardrailPolicy` - Content policies
- `GuardrailLog` - Policy violations
- `OrganizationPolicy` - Org-level policies

**Integrations**
- `CrmIntegration` - CRM connections
- `Webhook` - Webhook endpoints
- `WebhookLog` - Webhook delivery logs
- `ApiKey` - API key management
- `SsoConfiguration` - SSO setup

**Infrastructure**
- `Job` - Background job queue
- `Schedule` - Cron schedules
- `ScheduleLog` - Schedule execution logs
- `Notification` - User notifications
- `Settings` - User preferences

### Key Indexes

Performance-critical indexes:
```sql
-- Multi-tenant queries
@@index([teamId, status])
@@index([teamId, email])
@@index([orgId, createdAt])

-- Lead scoring
@@index([intentScore])
@@index([clusterLabel])

-- Campaign analytics
@@index([campaignId, createdAt])
@@index([status, priority])
```

---

## API Structure

### API Organization

ConvoSpan provides **200+ API endpoints** organized by domain:

```
/api
├── /ab-testing          # A/B test management
├── /admin               # Admin operations
├── /agents              # AI agent control
├── /ai                  # AI content generation
├── /analytics           # Analytics & reporting
├── /approvals           # HITL approvals
├── /audit               # Audit logs
├── /auth                # Authentication
├── /billing             # Payments & subscriptions
├── /bulk                # Bulk operations
├── /campaigns           # Campaign CRUD
├── /crm                 # CRM sync
├── /csv-ingestion       # CSV import
├── /dashboard           # Dashboard data
├── /data-export         # Export operations
├── /extension           # Browser extension API
├── /governance          # Governance controls
├── /help                # Help search
├── /hunter-email-finder # Email discovery
├── /icp-builder         # ICP management
├── /import              # Data import
├── /inbox               # Inbox management
├── /jobs                # Job queue
├── /knowledge           # Knowledge base
├── /leads               # Lead CRUD
├── /linkedin-runner     # LinkedIn automation
├── /marketplace         # Template marketplace
├── /meetings            # Meeting scheduling
├── /monitoring          # System health
├── /notifications       # Notifications
├── /onboarding          # Onboarding flows
├── /orchestrator        # Agent orchestration
├── /pipeline            # Sales pipeline
├── /playbooks           # Playbook management
├── /rag                 # RAG queries
├── /register            # User registration
├── /scheduler           # Cron scheduler
├── /schedules           # Schedule management
├── /scoring             # Lead scoring
├── /scraper-bridge      # Web scraping
├── /search              # Global search
├── /settings            # Settings management
├── /studio              # Workflow studio
├── /support             # Support tickets
├── /team                # Team management
├── /templates           # Email templates
├── /traces              # AI trace logs
├── /upload              # File uploads
├── /usage               # Usage tracking
├── /user                # User profile
├── /v1                  # Public API v1
├── /webhooks            # Webhook management
└── /workflows           # Workflow CRUD
```

### Authentication & Authorization

**Middleware Stack**:
1. **Session Validation** - NextAuth.js session check
2. **Plan Enforcement** - Subscription tier validation
3. **Rate Limiting** - Token bucket algorithm
4. **Team Context** - Multi-tenant isolation

**Example Middleware**:
```typescript
// src/middleware.ts
export async function middleware(req: NextRequest) {
  const session = await getSession(req);
  const plan = await getUserPlan(session.userId);
  
  // Block premium routes for FREE users
  if (isPremiumRoute(req.url) && plan === 'FREE') {
    return redirect('/pricing');
  }
  
  return NextResponse.next();
}
```

---

## Security & Compliance

### Security Features

#### 1. Data Protection
- **PII Detection**: Automatic masking of sensitive data
- **Encryption**: At-rest and in-transit encryption
- **Data Sovereignty**: Local-first AI processing
- **DPDP Act 2023**: Consent management

#### 2. Access Control
- **RBAC**: Role-based access control
- **Multi-tenancy**: Team-level data isolation
- **API Keys**: Scoped API access
- **SSO**: SAML/OIDC support

#### 3. Audit & Compliance
- **Audit Logs**: Complete activity trail
- **Approval Workflows**: HITL controls
- **Guardrails**: Content filtering
- **Rate Limiting**: Abuse prevention

#### 4. Application Security
- **Input Validation**: Zod schema validation
- **SQL Injection**: Prisma parameterized queries
- **XSS Protection**: React auto-escaping
- **CSRF Protection**: NextAuth.js tokens

### Compliance Features

**DPDP Act 2023 (India)**:
- Consent tracking (`consentObtained` field)
- Right to erasure (data deletion APIs)
- Data minimization (scoped queries)
- Audit trail (complete logging)

**GDPR (EU)**:
- Data portability (export APIs)
- Right to be forgotten
- Consent management
- Data processing records

---

## Deployment Architecture

### Production Stack

```
┌─────────────────────────────────────────────────────────┐
│                    CDN (Vercel Edge)                     │
│              Static Assets │ Edge Functions              │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│                  Application Layer                       │
│     Next.js (Vercel) │ API Routes │ SSR/SSG            │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│                   Data Layer                             │
│  PostgreSQL (Vercel/Neon) │ Redis (Upstash/Railway)    │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│                 External Services                        │
│  Gemini │ Razorpay │ SendPulse │ HubSpot │ Salesforce │
└─────────────────────────────────────────────────────────┘
```

### Environment Configuration

**Required Environment Variables**:
```bash
# Database
DATABASE_URL=postgresql://...

# Authentication
NEXTAUTH_SECRET=<secret>
NEXTAUTH_URL=https://app.convospan.com

# AI Providers (choose one)
GEMINI_API_KEY=...
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...

# Payments
NEXT_PUBLIC_RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...

# Email
SMTP_FROM_EMAIL=...

# Optional
REDIS_URL=...
SENTRY_DSN=...
```

### Scaling Strategy

**Horizontal Scaling**:
- Stateless API design
- Session stored in database
- Redis for distributed caching
- Job queue for async processing

**Database Optimization**:
- Connection pooling (Prisma)
- Query optimization (indexes)
- Read replicas (future)
- Partitioning by `teamId`

**Caching Strategy**:
- SWR for client-side caching
- Redis for server-side caching
- CDN for static assets
- API response caching

---

## Development Workflow

### Project Structure
```
fullstack/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── (dashboard)/  # Dashboard routes
│   │   ├── api/          # API routes (200+)
│   │   └── ...
│   ├── components/       # React components
│   │   ├── ui/           # Base UI components
│   │   ├── dashboard/    # Dashboard components
│   │   └── import/       # Import wizard
│   ├── modules/          # 41 feature modules
│   ├── lib/              # Utilities & configs
│   ├── ai/               # AI framework
│   ├── workers/          # Background workers
│   ├── hooks/            # Custom React hooks
│   └── types/            # TypeScript types
├── prisma/
│   └── schema.prisma     # Database schema (1025 lines)
├── tests/                # Unit tests
├── e2e/                  # E2E tests
└── docs/                 # Documentation
```

### Key Commands
```bash
# Development
npm run dev              # Start dev server
npm run typecheck        # TypeScript validation
npm run build            # Production build

# Database
npx prisma studio        # Database GUI
npx prisma migrate dev   # Create migration
npx prisma generate      # Generate client

# Testing
npm run test             # Unit tests
npm run test:e2e         # E2E tests
npm run test:coverage    # Coverage report
```

---

## Performance Metrics

### Build Statistics
- **Total Routes**: 202 pages
- **API Endpoints**: 200+
- **Build Time**: ~6 minutes
- **Bundle Size**: Optimized with code splitting
- **TypeScript**: Strict mode, 0 errors

### Database Metrics
- **Models**: 50+ Prisma models
- **Indexes**: 100+ optimized indexes
- **Schema Size**: 1025 lines
- **Extensions**: pgvector for embeddings

---

## Future Roadmap

### Planned Enhancements
- [ ] GraphQL API layer
- [ ] Real-time collaboration (WebSockets)
- [ ] Mobile app (React Native)
- [ ] Advanced ML models (custom training)
- [ ] Multi-region deployment
- [ ] Kubernetes orchestration

---

## Support & Resources

- **Documentation**: `/docs` folder
- **API Reference**: `docs/API_REFERENCE.md`
- **Setup Guide**: `docs/SETUP.md`
- **Monitoring**: `docs/MONITORING.md`

---

**Last Updated**: January 12, 2026  
**Version**: 1.0.0  
**Maintainer**: ConvoSpan Engineering Team
