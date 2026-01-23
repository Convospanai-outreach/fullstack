# ConvoSpan Beta Testing & Architecture Documentation

> **Status**: Draft for Beta Review  
> **Target Audience**: QA, Engineering, Product  
> **Version**: 1.0.0

---

## 1. High-Level System Architecture

### Blueprint

```mermaid
graph TD
    User[User (Browser)] -->|HTTPS/WSS| FE[Frontend (Next.js 16)]
    FE -->|Server Actions/API| API[Backend API Layer]
    
    subgraph "Core Cloud Infrastructure"
        API -->|Read/Write| DB[(PostgreSQL + pgvector)]
        API -->|Queue| Redis[(Redis / Job Queue)]
        API -->|Auth| NextAuth[NextAuth.js]
    end
    
    subgraph "AI Governance Layer"
        API -->|Request| GW[Model Gateway]
        GW -->|Check| Cache[Semantic Cache]
        GW -->|Check| Guard[Token Usage Guard]
        GW -->|Route| LLM[LLM Router (Gemini/OpenAI/Groq)]
    end
    
    subgraph "Edge / Browser Layer"
        Redis -->|Pop Job| Worker[Worker Service]
        Worker -->|Command| Ext[Client Extension (Local Mode)]
        Worker -->|Command| PBN[Physical Browser Node (Deep Tech Mode)]
        worker -->|Command| Pup[Puppeteer (Cloud/Legacy Mode)]
        
        Ext -->|Interact| LI[LinkedIn]
        PBN -->|Interact| LI
        Pup -->|Interact| LI
    end

    subgraph "Integrations"
        API -->|Sync| CRM[HubSpot/Salesforce]
        API -->|Email| Gmail[Google Workspace]
    end
```

### Component Breakdown

*   **Frontend**: Next.js 16 App Router. Handles UI state, dashboards, and triggers server actions.
    *   *Failure Point*: Client-side hydration errors, network latency causing optimistic UI desync.
*   **Backend API**: Next.js API Routes. Orchestrates business logic, database interactions, and job dispatching.
    *   *Failure Point*: Timeouts on long-running AI requests (Edge Runtime limitations).
*   **Database**: PostgreSQL with `vector` extension. Stores relational data (Users, Campaigns) and high-dimensional vectors (Lead embeddings).
    *   *Failure Point*: Slow queries on large vector searches without proper indexing.
*   **AI Layer**: Centralized `ModelGateway`. Routes tasks based on complexity (Strategic vs Routine).
    *   *Failure Point*: Provider outages (e.g., OpenAI down), Rate limits, Token exhaustion.
*   **Browser Automation**: Hybrid execution model (`LOCAL`, `CLOUD`, or `PHYSICAL`).
    *   *Failure Point*: **Critical Risk**. DOM Selector changes on LinkedIn, Captchas, IP bans.

---

## 2. Feature Flow Definitions

### Feature A: LinkedIn Connection Request

**Entry Point**: `CampaignRunner` (Background Job) or User Click (UI).

1.  **Trigger**: Job scheduler picks up a `CONNECT` task for a Lead.
2.  **Orchestrator**: Checks `EXECUTION_MODE`.
    *   *If `LOCAL`*: Pushes command to Redis queue for Chrome Extension.
    *   *If `CLOUD`*: Launches Puppeteer session.
3.  **Action**:
    *   Navigates to Profile URL.
    *   Waits for `CONNECT_BTN` selector.
    *   Clicks Connect.
    *   (Optional) Clicks "Add Note".
    *   Types personalized message.
    *   Clicks Send.
4.  **Verification**: Checks for "Pending" status or success toast.
5.  **Success**: Updates Lead status to `INVITED`.
6.  **Failure**:
    *   *Captcha Detected*: Pauses campaign, alerts user.
    *   *Button Missing*: Retries once, then logs failure (possible "Already Connected" or "Locked").

### Feature B: AI Message Personalization

**Entry Point**: `LeadScoringService` or `CampaignRunner`.

1.  **Preparation**: Fetches Lead profile, Company data, and Campaign Context.
2.  **Guardrail**: `TokenUsageGuard` checks team credit balance.
3.  **Routing**: `ModelGateway` analyzes prompt complexity (e.g., "Strategic" vs "Routine").
    *   *Strategy*: Uses **Gemini Pro** or **GPT-4o**.
4.  **Generation**: LLM generates 3 variants of the message.
5.  **Validation**: `SovereignFirewall` (conceptually) or Regex checks for forbidden words/PII leaks.
6.  **Success**: Returns clean message draft.
7.  **Failure**:
    *   *LLM Error*: Gateway retries with fallback provider (e.g., Anthropic -> OpenAI).
    *   *Validation Fail*: Regenerates or flags for human review.

---

## 3. Frontend Route & Access Map

| Route Name | Path | Purpose | Access | Risk Level |
| :--- | :--- | :--- | :--- | :--- |
| **Landing** | `/` | Marketing home | Public | Low |
| **Login** | `/login` | Auth entry | Public | Medium |
| **Dashboard** | `/dashboard` | Main user hub | Auth (User) | Low |
| **Campaigns** | `/campaigns` | Manage outreach | Auth (User) | Medium |
| **Leads** | `/leads` | Lead CRM view | Auth (User) | Low |
| **Workflows** | `/workflows` | No-code builder | Auth (Pro) | **High** (Complex UI) |
| **Inbox** | `/inbox` | Unified messenger | Auth (User) | **High** (Real-time sync) |
| **Settings** | `/settings` | Config & Billing | Auth (Admin) | Medium |
| **Admin** | `/admin` | System oversight | **SuperAdmin** | **Critical** |

---

## 4. Backend API Surface Overview

| Endpoint | Method | Purpose | Frontend Owner |
| :--- | :--- | :--- | :--- |
| `/api/campaigns/[id]/start` | POST | Triggers a campaign run | Campaign Dashboard |
| `/api/leads/import` | POST | Bulk CSV upload & parsing | Lead Table |
| `/api/workflows/[id]/run` | POST | Manually executes a workflow | Workflow Builder |
| `/api/linkedin/connect` | POST | Queues a connection request | Extension / Job |
| `/api/scoring/predict` | POST | Calculates lead intent score | Lead Detail View |
| `/api/webhooks/stripe` | POST | Handles billing events | Stripe (External) |

*   **Auth**: All `/api/*` routes (except webhooks) must enforce `NextAuth` session validation.
*   **Rate Limits**: Strict limits on `/api/scoring/*` and `/api/linkedin/*` to prevent abuse.

---

## 5. Browser Automation & LinkedIn Simulation Layer

**Trigger**: Usually async background jobs.

**Modes**:
1.  **LOCAL (Recommended)**:
    *   Relies on Chrome Extension installed in user's browser.
    *   *Risk*: User must have browser open.
2.  **CLOUD (Puppeteer)**:
    *   Headless server-side browser.
    *   *Risk*: **High detection probability**. IP rotation is mandatory.
3.  **PHYSICAL (Deep Tech)**:
    *   Connects to a physical hardware node (checking `BROWSER_NODE_URL`).

**Fragile Points**:
*   **Selectors**: `LinkedInConstants.ts` contains CSS selectors (e.g., `.pv-s-profile-actions--connect`). If LinkedIn updates UI, these **break immediately**.
*   **Throttling**: `Humanizer.randomDelay(min, max)` must be tuned. Too fast = Ban.

**Beta Test Strategy**:
*   Start Beta users on **LOCAL** mode only.
*   Verify Extension <-> API communication channel (WebSockets/Polling).

---

## 6. AI Layer Contracts (Gemini/Gateway)

**Input (`ModelRequest`)**:
```typescript
interface ModelRequest {
  prompt: string;
  complexity?: 'ROUTINE' | 'STRATEGIC'; // Gateway decides logic
  teamId: string; // For billing
  context?: Json; // RAG data
}
```

**Output (`ModelResponse`)**:
```typescript
interface ModelResponse {
  content: string; // The text
  tokensIn: number;
  tokensOut: number;
  cost: number;
  provider: 'OPENAI' | 'GEMINI' | 'ANTHROPIC';
  latency: number;
}
```

**Failure Handling**:
*   **Timeout**: 30s default.
*   **Fallback**: If Gemini fails, Gateway automatically tries OpenAI, then Anthropic. This is transparent to the user.
*   **Validation**: If output is empty or pure hallucination, retries up to 3 times before throwing `LLMGenerationError`.

---

## 7. Database Schema Snapshot (Testing View)

| Table | Key Fields | State Transitions | Testing Focus |
| :--- | :--- | :--- | :--- |
| **Lead** | `status`, `intentScore`, `crmId` | `NEW` -> `CONTACTED` -> `REPLIED` -> `WON` | Check CRM sync consistency. |
| **Campaign** | `status`, `targetCount`, `aiConfig` | `draft` -> `running` -> `paused` -> `completed` | Pause/Resume logic. |
| **Job** | `status`, `type`, `payload` | `pending` -> `processing` -> `completed` / `failed` | Retry counts & idempotency. |
| **Message** | `direction`, `status`, `platform` | `draft` -> `queued` -> `sent` -> `read` | Deduplication of inbound msgs. |
| **Team** | `credits`, `plan` | N/A | Credit deduction logic. |

---

## 8. Known & Likely Risk Areas

### 🔴 High Risk
1.  **LinkedIn Account Bans**: Cloud execution mode is extremely risky. *Mitigation*: Force `LOCAL` mode for Beta.
2.  **Selector Fragility**: Any LinkedIn UI update breaks automation. *Mitigation*: Centralized selector config + rapid patch system.
3.  **AI Hallucinations**: Message personalization acting weirdly (e.g., "Hello <UNDEFINED>"). *Mitigation*: Strict regex pre-send checks.

### 🟡 Medium Risk
1.  **Credit System Sync**: Concurrency issues when multiple jobs deduct credits simultaneously.
2.  **Extension Permissions**: Users may fear installing a "spyware-like" extension. Permissions must be minimal.

### 🟢 Low Risk
1.  **Static Pages**: Marketing site and simple dashboards.
2.  **Auth**: Standard NextAuth implementation is robust.

---

## 9. Beta-Testing Readiness Summary

*   **Core Platform**: ✅ **Ready**. Auth, DB, Dashboard, and basic CRUD are stable.
*   **AI Engine**: ✅ **Ready**. Gateway and fallback logic are implemented.
*   **Automation**: ⚠️ **Caution**. Only *Local Extension* mode should be enabled for public beta users. Disable Cloud mode to prevent liability.
*   **Workflows**: ⚠️ **Internal Only**. The `Workflow` node editor is complex and likely has edge cases.

**Beta Success Definition**:
1.  50+ Active Users connecting their extension.
2.  < 1% Job Failure Rate (excluding LinkedIn blocks).
3.  99.9% AI Availability (proven Fallback system).
