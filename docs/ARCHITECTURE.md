# CraftMyFunnel Architecture & Framework Documentation

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

**CraftMyFunnel** is an enterprise-grade AI-powered outreach and lead management platform built with a modern full-stack architecture. The application provides intelligent automation for sales, marketing, and customer engagement workflows.

### Key Capabilities
- 🤖 **Autonomous AI Agents** with human-in-the-loop controls
- 📧 **Multi-channel Outreach** (Email, LinkedIn, Social)
- 📊 **Predictive Analytics** with ML-powered lead scoring
- 🔄 **Workflow Automation** with visual builder
- 🛡️ **Enterprise Governance** with compliance guardrails
- 🧱 **Sovereign Firewall** with edge-based PII sanitization
- ⚡ **Micro-LLM (Phi-3)** for offline intelligence & adversarial critique
- 🧠 **Autonomous Knowledge Engine** featuring TOON serialization and MCP ingestion
- 📡 **Model Context Protocol (MCP)** for real-time customer intent discovery
- 📉 **Real-time Analytics** and A/B testing
- 🔗 **CRM Integration** (HubSpot, Salesforce)

---

## Technology Stack

### Frontend (`apps/web`)
| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 16.1.x | Web UI + route handlers |
| **React** | 19.2.0 | UI library |
| **TypeScript** | 5.9.3 | Type safety |
| **Tailwind CSS** | 4.1.17 | Styling framework |
| **Framer Motion** | 12.23.26 | Animations |
| **React Flow** | 11.11.4 | Workflow visual builder |
| **Recharts** | 3.5.1 | Data visualization |
| **Three.js** | 0.182.0 | 3D graphics |

### Backend API (`apps/api`)
| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 20+ | Runtime environment |
| **Fastify** | 5.x | Fast API server layer |
| **Prisma** | 7.5.x | ORM and database toolkit |
| **PostgreSQL** | 14+ | Primary database |
| **Redis** | 5.10.0 | Caching and job queue |
| **NextAuth.js** | 4.24.13 | Authentication |
| **Python** | 3.11 | ML & Orchestrator (uv-managed) |

### AI & ML
| Technology | Purpose |
|------------|---------|
| **Google Gemini** | Primary LLM for content generation |
| **OpenAI** | Alternative LLM provider |
| **Anthropic Claude** | Alternative LLM provider |
| **Microsoft Phi-3** | **Micro-LLM** for edge-based critique & offline fallback |
| **TOON** | **Token-Oriented Object Notation** for context optimization |
| **Custom Vector Store** | RAG and semantic search |
| **Proprietary Algorithms** | Lead scoring, intent detection |

### Integrations
| Service | Purpose |
|---------|---------|
| **Razorpay** | Payment processing |
| **SendPulse** | Email delivery |
| **HubSpot / Salesforce** | CRM integration |
| **Puppeteer** | Web scraping & automation |
| **Model Context Protocol** | External knowledge ingestion (SSE/Stdio) |
| **Google SMTP** | Secure outbound delivery (AES-256 encrypted) |

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
- **Location**: `apps/web/src/app/`, `apps/web/src/components/`
- **Responsibilities**:
  - Static generation (SSG) and client-rendering
  - Client-side routing and navigation
  - UI component composition
  - State management with SWR
  - Form handling and validation

#### 2. API Layer
- **Location**: `apps/api/routes/`, `apps/api/src/`
- **Responsibilities**:
  - Fastify RESTful endpoint definitions
  - Request/response handling
  - Authentication and authorization
  - Input validation with Zod
  - Rate limiting
  - Error handling

#### 3. Business Logic Layer
- **Location**: `apps/api/src/modules/`, `apps/api/src/lib/`
- **Responsibilities**:
  - Domain-specific business rules
  - Service orchestration
  - Workflow execution
  - AI agent coordination
  - Data transformation

#### 4. Data Access Layer
- **Location**: `apps/api/prisma/`, `apps/api/src/lib/db.ts`
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

CraftMyFunnel is organized into **41 feature modules**, each encapsulating specific business capabilities:

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

### 9. Enterprise Governance Modules (NEW)
| Module | Purpose | Key Components |
|--------|---------|----------------|
| **conversation** | Conversation state machine | `ConversationService.ts`, `ConversationState` enum |
| **caller** | Caller queue system | `CallerService.ts`, focus UI |
| **whatsapp** | WhatsApp consent & compliance | `ConsentService.ts`, `TemplateGuard.ts` |
| **monitoring** | Production health checks | `MonitoringService.ts`, alert thresholds |
| **flags** | Feature flag system | `service.ts`, `config.ts` (4-layer capability system) |

---

## Enterprise Governance Framework

**Added**: January 2026 (Phases 0-8)  
**Purpose**: Transform platform from startup MVP to enterprise-ready SaaS with full governance, compliance, and audit capabilities.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   ENTERPRISE CONTROL LAYER                   │
│  Capability Containment │ RBAC │ Audit │ Compliance Guards  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    FEATURE FLAG ROUTING                      │
│   ProductMode Check → Layer Validation → DB Override        │
│   ENTERPRISE_CORE  │  GROWTH  │  ALL_FEATURES              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  CONVERSATION STATE MACHINE                  │
│  INITIATED → ENGAGED → QUALIFIED → HANDOFF → COORDINATING  │
│                    → MEETING_CONFIRMED → CLOSED              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      HYBRID AI ROUTER                        │
│  PII Detection → Cloud (safe) vs On-Prem (sensitive)       │
│  DPDP Act Compliance │ Data Sovereignty Enforcement         │
└─────────────────────────────────────────────────────────────┘
```
### Architecture Intent
Regional intelligence is implemented as a replaceable layer; the core system architecture does not change for global expansion, only the compliance and context modules are swapped.


### 1. Capability Containment (Phase 1)

**Purpose**: Policy-driven feature access control with 4-layer capability system.

**Components**:
- **`CapabilityLayer` enum**: CORE → GOVERNED_AI → ADVANCED_OPS → EXPERIMENTAL
- **`ProductMode` enum**: ENTERPRISE_CORE, GROWTH, ALL_FEATURES
- **`FeatureFlag` model**: Dynamic feature toggles with layer restrictions
- **`OrganizationPolicy` model**: Team-level product mode (default: ENTERPRISE_CORE)

**Service**: `src/lib/flags/service.ts`
```typescript
FeatureFlagService.isEnabled(featureKey, teamId)
// Returns: boolean (based on productMode + layer + DB override)
```

**Key Rules**:
- ENTERPRISE_CORE: Only CORE + GOVERNED_AI layers allowed
- GROWTH: CORE + GOVERNED_AI + ADVANCED_OPS
- ALL_FEATURES: All layers (including EXPERIMENTAL)

**Default**: New organizations start in ENTERPRISE_CORE (maximum governance)

---

### 2. Enterprise RBAC (Phase 2)

**Purpose**: Role-based access control with 6 distinct enterprise roles.

**`UserRole` Enum**:
1. **SYSTEM_ADMIN** - Platform administrators (full access)
2. **ORG_ADMIN** - Organization admins (org-level config)
3. **SALES_MANAGER** - Team leads (approve campaigns, manage team)
4. **SALES_USER** - Sales reps (create campaigns, manage leads)
5. **CALLER** - Call center staff (access caller queue only, read-only history)
6. **COMPLIANCE_OFFICER** - Compliance team (audit logs, consent records)

**Enforcement**:
- **Middleware**: `src/middleware.ts` - Route-level RBAC protection
- **JWT Integration**: `enterpriseRole` in NextAuth token
- **Permission Helpers**: `src/lib/permissions.ts`

**Example Restriction**:
```typescript
// Only CALLER, SALES_MANAGER, or ADMIN can access /caller route
if (path.startsWith("/caller")) {
  const allowed = ["CALLER", "SALES_MANAGER", "ORG_ADMIN", "SYSTEM_ADMIN"];
  if (!allowed.includes(role)) {
    return redirect("/dashboard");
  }
}
```

---

### 3. Conversation State Machine (Phase 3)

**Purpose**: Enforce immutable conversation history with strict state transitions.

**`ConversationState` Enum** (7 states):
1. **INITIATED** - Conversation started
2. **ENGAGED** - Lead responded
3. **QUALIFIED** - Lead shows interest
4. **HANDOFF_REQUIRED** - AI can't proceed, human needed
5. **COORDINATING** - Caller is working on scheduling
6. **MEETING_CONFIRMED** - Meeting booked
7. **CLOSED** - Conversation ended

**Service**: `src/modules/conversation/ConversationService.ts`

**State Transition Rules**:
```
INITIATED → ENGAGED (or CLOSED)
ENGAGED → QUALIFIED (or CLOSED)
QUALIFIED → HANDOFF_REQUIRED (or CLOSED)
HANDOFF_REQUIRED → COORDINATING (or CLOSED)
COORDINATING → MEETING_CONFIRMED (or CLOSED)
MEETING_CONFIRMED → CLOSED

CLOSED is terminal (no further transitions)
```

**Key Methods**:
- `startThread(leadId, channel)` - Create new conversation
- `transitionState(threadId, newState, reason)` - Enforce state machine
- `addEntry(threadId, leadId, role, content)` - Append-only history
- `isValidTransition(current, next)` - Private validation logic

**Immutability**: ConversationEntry is append-only (no updates/deletes)

---

### 4. Caller Queue System (Phase 4)

**Purpose**: Dedicated interface for human callers to handle HANDOFF_REQUIRED leads.

**Components**:
- **Service**: `src/modules/caller/CallerService.ts`
- **API**: `src/app/api/caller/queue/route.ts` (GET/POST)
- **UI**: `src/app/(dashboard)/caller/page.tsx` (Focus Mode)
- **Model**: `MeetingCoordinationQueue` (lead assignment tracking)

**Workflow**:
1. AI conversation reaches `HANDOFF_REQUIRED` state
2. Lead appears in caller queue (unassigned pool)
3. Caller claims lead → state transitions to `COORDINATING`
4. Caller makes call and records outcome
5. State transitions to `MEETING_CONFIRMED` or `CLOSED`

**Key Methods**:
- `getQueue(userId)` - Fetch assigned + unassigned leads
- `claimLead(leadId, userId)` - Assign lead to caller
- `completeTask(leadId, userId, outcome, notes)` - Record call outcome

**Access Control**: Only `CALLER`, `SALES_MANAGER`, or `ADMIN` roles

---

### 5. Hybrid AI Routing (Phase 5)

**Purpose**: Route AI tasks to Cloud (safe) or On-Prem (sensitive) based on data classification.

**Service**: `src/lib/ai/HybridRouter.ts`

**Decision Matrix**:
| Task Type | Cloud | On-Prem | Reason |
|-----------|-------|---------|--------|
| Email Draft | ✓ | | No PII required |
| LinkedIn Message | | ✓ | Automation risk, residential IP |
| Lead Enrichment (with PII) | | ✓ | DPDP Act compliance |
| RAG Query (public docs) | ✓ | | Safe knowledge retrieval |
| Summary Generation | ✓ | | Non-sensitive |
| Web Scraping | | ✓ | IP rotation needed |

**Key Components**:
- **HybridRouter.route()** - Returns `CLOUD` or `ON_PREM`
- **HybridRouter.validateCloudSafety()** - PII detection (regex-based)
- **OnPremAIProxy** - `src/lib/ai/OnPremAIProxy.ts` (edge node communication)

**PII Detection Patterns**:
- Email addresses
- Phone numbers (10-digit)
- SSN format
- Credit card numbers

**Compliance**: No PII crosses cloud boundary (DPDP Act 2023 enforcement)

**Integration**: `aiService.ts` calls `HybridRouter` before ModelGateway

**Hardware Positioning**:
Raspberry Pi 4 (4GB) is the minimum viable hardware for the on-prem node. Enterprise deployments may utilize Pi 5 or higher-memory SKUs, but the architecture does not depend on a specific device.

**Training vs Inference**:
Phi-3 training may utilize GPU resources for speed, but GPU is NOT required for inference. The runtime is optimized for CPU-only execution on the edge node.


---

### 6. WhatsApp Consent & Template Compliance (Phase 6)

**Purpose**: DPDP Act 2023 + WhatsApp Business API compliance.

**Components**:
- **ConsentService**: `src/modules/whatsapp/ConsentService.ts`
- **TemplateGuard**: `src/modules/whatsapp/TemplateGuard.ts`
- **API**: `src/app/api/whatsapp/send/route.ts`

**Consent Management**:
```typescript
// Record explicit consent
ConsentService.recordConsent(leadId, userId, method, notes)

// Validate before messaging
ConsentService.validateConsent(leadId)
// Returns: { hasConsent: boolean, reason?: string }

// Handle opt-out
ConsentService.revokeConsent(leadId, userId, reason)
```

**Consent Methods Enum**:
- IN_PERSON_MEETING
- EMAIL_REPLY
- PHONE_CALL
- WEB_FORM
- VERBAL_CONFIRMATION

**Template Compliance**:
- First message MUST use pre-approved template
- Free-form messaging only within 24h of user reply
- Promotional content requires pre-approval

**Audit Trail**: All consent actions logged with `whatsappConsentBy`, `whatsappConsentAt`

---

### Execution Verification Status

- **Dataset Validation**: Scripts were EXECUTED (PASS).
- **Evaluation Suite**: Deterministic suite was EXECUTED (PASS).
- **Environment**: Execution environment was Linux / WSL2 context.
- **Outcome**: The system passed all verification gates.

### 7. Monitoring & Observability (Phase 8+)

**Purpose**: Production health monitoring, alerting, and end-to-end tracing.

**Distributed Tracing (Correlation ID)**:
The platform implements a unified **Correlation ID** system for distributed observability across the stack:
- **Generation**: `Next.js Middleware` generates/captures `X-Correlation-ID` for every inbound request.
- **Propagation**: ID is passed via request headers to API routes and background workers using `AsyncLocalStorage` (Node.js) and `contextvars` (Python).
- **Storage**: The `correlationId` is automatically stored in `AuditLog` rows and injected into `Winston` and `Sentry` logs.
- **Cross-Service**: The Python Edge Node captures and responds with the same ID, ensuring logs can be joined across the network.

**Health Checks**:
- Database connectivity (query execution time)
- Audit log activity (last 24h)
- Feature flag configuration
- Edge node reachability via `HARDWARE_SIGNATURE` handshake.

**Metrics**:
- `micro_llm_latency_seconds`: Latency of edge-node AI operations.
- `micro_llm_requests_total`: Throughput of the Sovereign Critic.
- `rag_retrieval_latency_seconds`: Performance of the vector storage.
- Active users (sessions in last 24h).
- Daily audit logs and Guardrail violations.

**API Endpoints**:
- `GET /api/health` - Public health check (200/503). Includes system status and version.
- `GET /api/metrics` - Prometheus metrics endpoint.

---

### 8. Immutable Audit Trail

**Purpose**: Complete activity logging for compliance and forensics.

**Models**:
- **`AuditLog`** - All user/system actions
- **`ImmutableAudit`** - Hash-chained audit log (tamper-proof)

**Service**: `src/modules/audit/auditService.ts`

**Key Features**:
- Nullable `actorId` for system events
- Automatic timestamp tracking
- JSON metadata for context
- Hash chaining for immutability (optional)

**Common Events**:
- CONSENT_GRANTED, CONSENT_REVOKED
- CONVERSATION_STATE_CHANGE
- CAMPAIGN_APPROVED, CAMPAIGN_REJECTED
- CAMPAIGN_APPROVED, CAMPAIGN_REJECTED
- FEATURE_FLAG_TOGGLED

### Codebase Safety
- **Isolating Backend/Frontend**: Now that `apps/api` and `apps/web` are physically separated, frontend cannot accidentally bundle backend code. Service modules are restricted to `apps/api`.


---

### Compliance Summary

**DPDP Act 2023 (India)**:
- ✅ Explicit consent tracking
- ✅ Opt-out support
- ✅ Audit trail (7-year retention ready)
- ✅ WhatsApp Business API compliance
- ✅ PII protection (hybrid routing)

**SOC 2 Type II**:
- ✅ All 8 Trust Services Criteria mapped
- ✅ Access controls (RBAC)
- ✅ Audit logging
- ✅ Change management (approval workflows)
- ✅ Monitoring

**Documentation**:
- `docs/compliance/SOC2_CONTROLS.md`
- `docs/compliance/DPDP_COMPLIANCE.md`
- `docs/SCALE_READINESS.md`

---

### Production Readiness

**Pilot Setup**:
```bash
npx tsx src/scripts/setup-enterprise-pilot.ts \
  "Organization Name" \
  "admin@org.com" \
  "Admin Name" \
  false \
  200
```

**Validation**:
```bash
npx tsx src/scripts/validate-production-readiness.ts
# Expected: 70-90/100 (production environment)
```

**Verification Scripts**:
- `test-conversation-flow.ts` - State machine validation
- `test-caller-flow.ts` - Queue claim/complete flow
- `test-hybrid-ai.ts` - Routing logic (11 scenarios)
- `test-whatsapp-consent.ts` - Consent + template compliance

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
- **Purpose**: Autonomous Cyber-Physical Agent State Machine (DFA)
- **States**:
  1. **HARDWARE_HANDSHAKE**: Verifies physical node identity
  2. **DATA_INGESTION**: Fetches live data (Hunter.io, LinkedIn)
  3. **SANITIZATION**: Edge-based PII masking before LLM
  4. **LLM_GENERATION**: Secure content generation via ModelGateway
  5. **ADVERSARIAL_CHECK**: Sovereign Critic Policy verification
  6. **EXECUTION**: Physical browser actuation or API call
  7. **REVIEWING/COMPLETED**: HITL review or finalization
- **Features**:
  - Sovereign Hardware Gating
  - Reversible PII Tokenization
  - Dead Letter Queue (DLQ) for retries
  - Dead Letter Queue (DLQ) for retries
  - Confidence-based HITL

#### 2. Agent State Machine (Cyber-Physical DFA)
The `AgentExecutor` implements a Deterministic Finite Automaton (DFA) that strictly enforces hardware interaction protocols:

1.  **HARDWARE_HANDSHAKE**:
    - Verifies physical connection to the Edge Node.
    - Validates cryptographic hardware signature.
2.  **DATA_INGESTION**:
    - Fetches external data (Hunter.io, LinkedIn) to populate context.
3.  **SANITIZATION**:
    - **Input**: Raw Prompt + Data.
    - **Process**: Sends text to Edge Node for PII masking.
    - **Output**: Tokenized/Masked Prompt (Safe for Cloud).
4.  **LLM_GENERATION**:
    - **Input**: Masked Prompt.
    - **Process**: Cloud LLM (Gemini/GPT) generates content.
    - **Output**: Draft Content (Generic/Masked).
5.  **ADVERSARIAL_CHECK (Sovereign Critic)**:
    - **Input**: Draft Content.
    - **Process**: **Micro-LLM (Phi-3)** on Edge Node critiques the draft against safety policies.
    - **Output**: `APPROVED` or `REJECTED`.
6.  **EXECUTION**:
    - **Action**: Physical actuation (Browser navigation) or API call.
    - **Constraint**: Only reachable if Critic returns `APPROVED`.

#### 3. ModelGateway
- **File**: `src/ai/ModelGateway.ts`
- **Purpose**: Multi-provider LLM abstraction
- **Features**:
  - Provider selection based on task complexity
  - Automatic fallback on failure
  - Token counting and cost tracking
  - Response caching

#### 4. SovereignFirewall
- **File**: `src/ai/SovereignFirewall.ts`
- **Purpose**: Data protection layer ensuring no PII leaves the physical boundary.
- **Micro-LLM Integration**:
    - Uses **Phi-3 Mini (3.8B)** running locally on the Edge Node.
    - Performs **Offline Adversarial Critique** of generated content.
    - Acts as a "Sovereign Critic" that cannot be overridden by cloud instructions.
- **Features**:
    - **Regex-based PII Detection**:
        - Email, Phone (Global), Credit Card (Luhn), SSN.
    - **Circuit Breaker**:
        - Blocks outbound traffic if Hardware Node is unreachable.
        - Fails closed (Secure default).
    - **Reversible Tokenization**:
        - PII is replaced with tokens (e.g., `{{EMAIL_1}}`) locally.
        - Token map stored ONLY on the Edge Node.
        - Cloud LLM sees only tokens; re-hydration happens on Edge before execution.

#### 5. RAG System
- **Files**: `src/modules/rag/`, `src/modules/scoring/service/CaseStudyService.ts`
- **Purpose**: Retrieval-Augmented Generation
- **Features**:
  - Vector embeddings with pgvector
  - Semantic search
  - Case study grounding
  - Case study grounding
  - Local-first data processing

#### 6. Micro-LLM (Microsoft Phi-3)
- **Deployment**: Local inference on Raspberry Pi (Edge Node).
- **Role**:
    - **Adversarial Critic**: Reviews every outbound message for policy violations.
    - **Offline Fallback**: Provides basic chat capabilities when internet is severed.
    - **Safety Guard**: Enforces "Don't be creepy" rules locally.
- **Why Phi-3?**:
    - High reasoning capability in small parameter count (3.8B).
    - Optimized for CPU-only execution (ONNX Runtime).
    - Zero data egress (privacy guarantee).

---

## Autonomous Knowledge Engine

The **Autonomous Knowledge Engine** is the orchestration layer responsible for discovering, ingesting, and optimizing external knowledge before it reaches the AI Agents.

### 1. Model Context Protocol (MCP) Ingestion
- **Protocol**: Model Context Protocol (v1.0)
- **Service**: `src/modules/knowledge/services/mcpClient.ts`
- **Capabilities**:
    - **Resource Discovery**: Automatically probes external platforms (e.g., Netjana) for customer-specific intents.
    - **Real-time Signals**: Fetches behavioral data (page visits, downloads, pricing queries) via Server-Sent Events (SSE).
    - **Contextual Enrichment**: Hydrates lead profiles with "Deep Intent" signals that aren't present in static CRM data.

### 2. TOON Serialization (Token-Oriented Object Notation)
- **Purpose**: Dramatic reduction in LLM operating costs and context window usage.
- **Service**: `src/lib/ai/TOON.ts`
- **Format**: Optimized row-based serialization with shared headers for tabular data.
- **Metric**: Achieves **30-50% token reduction** compared to standard JSON payloads for lead lists and intent streams.

### 3. Knowledge Orchestrator (Agentic RAG)
- **Role**: The central "Brain" of the pre-generation pipeline.
- **Workflow**:
    1. **Discovers**: Queries local DB for campaign context.
    2. **Ingests**: Triggers MCP client to fetch external intents.
    3. **Sterilizes**: Passes raw data through the Sovereign Firewall (Local PII masking).
    4. **Optimizes**: Converts the result into **TOON** format.
    5. **Injects**: Provides the final optimized string to the `emailComposer`.

---

## 3-Node Outreach Engine

CraftMyFunnel utilizes a multi-stage outreach strategy governed by the `emailComposer` service.

| Node | Scenario | AI Strategy |
|------|----------|-------------|
| **Node A** | Initial Cold Outreach | **Signal-Driven**: Uses "Mirror / Hypothesis / Proof / CTA" structure based on bio and intent. |
| **Node B** | 3-Day Follow-Up | **Behavioral-Driven**: Targeted at prospects who opened but didn't reply. Focuses on business consequences. |
| **Node C** | 5-Day Follow-Up | **Pattern-Interrupt**: Targeted at non-openers. Short, concise "Brevity-first" approach. |

- **Security**: All drafts use encrypted Team SMTP credentials.
- **Diversity**: Dynamic prompt builders enforce strict tone variety and peer-to-peer relevance.

---

## Data Architecture

### Database Schema Overview

CraftMyFunnel uses **PostgreSQL** with **Prisma ORM** and **pgvector** extension for vector operations.

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

CraftMyFunnel provides **200+ API endpoints** organized by domain:

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
├── /caller              # Caller queue (NEW - Phase 4)
├── /campaigns           # Campaign CRUD
├── /crm                 # CRM sync
├── /csv-ingestion       # CSV import
├── /dashboard           # Dashboard data
├── /data-export         # Export operations
├── /extension           # Browser extension API
├── /governance          # Governance controls
├── /health              # Health checks (NEW - Phase 8)
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
├── /metrics             # System metrics (NEW - Phase 8)
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
├── /whatsapp            # WhatsApp messaging (NEW - Phase 6)
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
NEXTAUTH_URL=https://app.craftmyfunnel.com

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

# Integrations
HUNTER_API_KEY=... # Enable real email discovery
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

**Last Updated**: January 23, 2026  
**Version**: 2.0.0 (Enterprise-Ready)  
**Maintainer**: CraftMyFunnel Engineering Team

**Recent Updates**:
- ✅ Enterprise Governance Framework (Phases 0-8)
- ✅ Capability Containment (4-layer system)
- ✅ RBAC (6 enterprise roles)
- ✅ Conversation State Machine
- ✅ Caller Queue System
- ✅ Hybrid AI Routing (Cloud/On-Prem)
- ✅ WhatsApp Consent & Template Compliance
- ✅ SOC 2 & DPDP Act 2023 Compliance
