# SaaS Platform Architecture Audit: SAAS_SYSTEM_AUDIT.md

## Platform Overview
The **ConvoSpan SaaS Platform** is a centralized control plane for high-fidelity Autonomous Sales Outreach. It orchestrates complex campaigns, manages lead intelligence, and dispatches sensitive automation tasks to a fleet of decentralized Edge Nodes.

### Core Responsibilities:
*   **Campaign Orchestration**: Manages multi-node sequences (Email, LinkedIn, WhatsApp).
*   **AI Messaging**: Generates hyper-personalized content using Gemini/GPT-4o, augmented by RAG and "Sovereign Learning".
*   **Lead Management**: Centralized store for prospect data, pipeline states, and CRM-like activity history.
*   **Task Dispatching**: Distributes automation commands to physical Edge Nodes via a Redis-backed job queue.
*   **Analytics**: Tracks conversion rates, reply sentiment, and agent performance.
*   **Billing & Metering**: Manages subscriptions and credit-based usage via Razorpay.

## Repository Structure
```text
/src
├── app/                      # Next.js App Router (UI & API Routes)
├── components/               # UI Design System (Tailwind + Framer Motion)
├── lib/                      # Core Utilities (DB client, Queue, AI wrappers)
├── modules/                  # Business Logic Domains
│   ├── agent/                # Agent Executor and State Machine
│   ├── ai-content/           # Message generation logic
│   ├── audit/                # Compliance and Sentinel services
│   ├── billing/              # Subscriptions and Payment processing
│   ├── campaign-orchestrator/# Multi-channel sequence engine
│   ├── graph/                # Knowledge Graph and identity resolution
│   ├── linkedin-runner/      # Interface to Edge Node LinkedIn actions
│   └── workflow/             # DAG-based workflow traversal
├── prisma/                   # Database schema and migrations
└── scripts/                  # Seeders, validators, and maintenance tools
```

## API Architecture
The platform is built on **Next.js 14** (App Router).
*   **Main Entrypoint**: `src/app/api` for REST and `src/app/layout.tsx` for UI.
*   **Major API Routes**:
    *   `/api/campaigns`: CRUD and activation of outreach campaigns.
    *   `/api/leads`: Ingestion (CSV/API) and enrichment.
    *   `/api/edge/attest`: Hardware signature verification for incoming node connections.
    *   `/api/system/status`: Real-time health monitoring of the SaaS and connected nodes.

## Campaign Engine
Campaigns are defined as hierarchical sequences using a custom DAG builder.
*   **Sequence Logic**: Nodes represent actions (AI Email, LinkedIn Invite) or logic (Delay, Condition).
*   **Scheduling**: Time-zone-aware scheduling with adaptive sending frequencies.
*   **Lead Stages**: Prospects move through `LEAD`, `WARM`, `REPLIED`, `CONVERTED`.

## Task Dispatch System
Automation tasks are sent to physical hardware using an asynchronous job system.
*   **Queue**: **Redis (via BullMQ/ioredis)**.
*   **Schema**: Tasks include `action` (e.g., `send_connection`), `target_url`, and `payload` (masked data).
*   **Dispatch Logic**: SaaS identifies the `hardware_id` associated with a team and pushes the task to the designated channel.
*   **Example Task**:
    ```json
    {
      "action": "linkedin_connect",
      "payload": { "url": "linkedin.com/in/prospect", "message": "Hi <PERSON_1>..." },
      "context": { "teamId": "team_abc" }
    }
    ```

## AI Messaging Engine
Personalization is achieved through a "Three-Layer" prompt system:
1.  **Lead Context**: Raw data from prospect profiles.
2.  **RAG Context**: Retrieval from the `KnowledgeBase` (case studies, product docs).
3.  **Sovereign Learning**: Team-specific style memories and previous successful responses.
*   **Similarity Detection**: Messages are compared against local "Golden Records" on the Edge Node to ensure brand alignment.

## Reply Intelligence
Replies are classified using a combination of LLM intent analysis and local "Karmic Friction" scoring.
*   **Categories**: `POSITIVE`, `NEUTRAL`, `REQUEST_INFO`, `NOT_INTERESTED`, `UNSUBSCRIBE`.
*   **Adaptive Flow**: Positive replies can trigger automated meeting link generation or human notification.

## Meeting Scheduling
*   **Calendar Integration**: Hooks into Google Calendar/Outlook APIs.
*   **Link Generation**: Dynamic insertion of scheduling links in follow-up sequences.
*   **Triggers**: AI detects intents like "Let's talk" and automatically replies with available slots.

## Database Architecture
Built on **PostgreSQL** with **Prisma ORM**.
*   **Leads**: Storage for PII (encrypted/masked) and metadata.
*   **Workflows**: JSON storage for DAG node/edge structures.
*   **Tasks & Runs**: Tracking execution status and historical context for every agent action.
*   **Campaigns**: Operational settings, budgets, and team ownership.

## Billing System
*   **Razorpay**: Integrated for Indian and international seat management.
*   **Metering**: Usage tracked per command (e.g., $X per message, $Y per enrichment).
*   **Credits**: Team-level credit balance enforced by the `BillingService`.

## Real-Time Communication
*   **WebSocket (via Socket.io)**: Used for live-streaming agent logs from Edge Nodes to the SaaS Dashboard.
*   **State Updates**: Real-time pipeline updates on the UI using React Query and Pusher/WebSocket.

## Vercel Deployment
*   **Build Steps**: `npx prisma generate`, `ts-node src/scripts/validate`, and `next build`.
*   **Edge Functions**: API routes utilize Next.js Edge Runtime where appropriate for low latency.

## Security Model
*   **Tenant Isolation**: Strict `teamId` filters on all database queries.
*   **Identity Vaulting**: PII is tokenized by the Edge Node; the SaaS only handles non-sensitive identifiers unless re-identification is explicitly audited.
*   **HMAC Signing**: All webhooks from Edge Nodes are validated via `X-Compliance-Hash`.

## System Scalability
*   **Horizontal Scaling**: Stateless Next.js frontend allows for infinite scaling behind a load balancer.
*   **Queue Scaling**: Multiple BullMQ workers can process tasks in parallel across high-compute clusters.
*   **Database**: Read replicas and connection pooling for high-volume lead operations.
