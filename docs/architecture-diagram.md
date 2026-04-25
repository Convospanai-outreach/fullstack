# ConvoSpan Architecture Diagram

This file is GitHub-renderable Mermaid. Copy any fenced `mermaid` block into the Mermaid Live Editor if you need an exported SVG or PNG. It shows the current runtime architecture, including Landing Agent, Netjana buyer-intent ingest, signal-aware email drafting, LinkedIn sequence actions, and public landing-page conversion tracking.

## Layered System Design

```mermaid
flowchart TB
    subgraph L0["Layer 0 - Actors and Channels"]
        browser[Authenticated Browser User]
        visitor[Anonymous Landing Visitor]
        prospect[Email or LinkedIn Prospect]
        operator[Internal Operator]
        extension[Chrome Extension Operator]
        webhook[External Webhook Sender]
    end

    subgraph L1["Layer 1 - Delivery and Routing"]
        webIngress[Web Ingress]
        apiIngress[API Ingress]
        nextMiddleware[Next Proxy Middleware]
        publicRoutes[Public Route Allowlist]
        apiProxy["Web /api/proxy/*"]
        corsRateLimit[CORS and Rate Limit Controls]
    end

    subgraph L2["Layer 2 - Web Experience"]
        marketing[Marketing Pages]
        authPages[Auth and Account Pages]
        dashboard[Dashboard Shell]
        setupWizard[Setup Wizard]
        campaignUi[Campaign UI]
        landingAgentUi[Landing Agent UI]
        intelDashboard[Netjana Intel Dashboard]
        publishedPages["Published Pages /p/:slug"]
    end

    subgraph L3["Layer 3 - API Runtime Boundary"]
        fastify[Fastify Server]
        routeLoader[Filesystem Route Loader]
        routeAdapter[Next-style Route Adapter]
        requestAuth[Request-aware Auth Context]
        responseBridge[Response and Cookie Bridge]
    end

    subgraph L4["Layer 4 - Application Services"]
        campaignApis[Campaign APIs]
        landingApis[Landing Agent APIs]
        intelApis[Intel and Webhook APIs]
        sequenceApis[Sequence and Channel APIs]
        setupApis[Setup APIs]
        billingApis[Billing APIs]
        analyticsApis[Analytics APIs]
        extensionApis[Extension APIs]
        adminApis[Admin APIs]
    end

    subgraph L5["Layer 5 - Domain Modules"]
        campaigns[Campaign Domain]
        leads[Lead Domain]
        landingAgent[Landing Agent Domain]
        intel[Intel and Signal Domain]
        sequences[Sequence and Channel Domain]
        rag[RAG and Knowledge Domain]
        workflows[Workflow Domain]
        inbox[Inbox Domain]
        governance[Governance Domain]
        settings[Settings Domain]
    end

    subgraph L6["Layer 6 - AI and Automation"]
        promptBuilders[Prompt Builders]
        modelGateway[Model Gateway]
        guardrails[Guardrails and Policy Checks]
        eventStore[Learning Event Store]
        workers[Workers and Schedulers]
        netjanaPipeline[Netjana Normalize, Score, Match]
        emailComposer[Signal-Aware Email Composer]
        channelWorkers[Email and LinkedIn Workers]
        adapters[Buyer Intel, Enrichment, Outreach Adapters]
    end

    subgraph L7["Layer 7 - Data Access and Persistence"]
        prisma[Prisma Client]
        postgres[(Postgres)]
        redis[(Redis Optional)]
        signalStore[(ShadowSignal, ScrapingJob, Job Rows)]
        knowledge[(Knowledge Items and Assets)]
        audit[(Audit and System Events)]
    end

    subgraph L8["Layer 8 - External Integrations"]
        llm[LLM Providers]
        netjanaProvider[Netjana / ConvoSpan Intel]
        smtp[SMTP and Email Providers]
        linkedin[LinkedIn and Browser Actions]
        payments[Razorpay]
        crm[CRM and Enrichment Providers]
        browserNode[Browser Automation Node]
    end

    subgraph L9["Layer 9 - Optional Private Edge"]
        edgeApi[FastAPI Edge Runtime]
        hardware[Hardware or Private Execution Context]
    end

    browser --> webIngress
    visitor --> webIngress
    smtp --> prospect
    linkedin --> prospect
    operator --> webIngress
    extension --> webIngress
    webhook --> apiIngress
    netjanaProvider --> apiIngress

    webIngress --> nextMiddleware
    apiIngress --> fastify
    nextMiddleware --> publicRoutes
    nextMiddleware --> corsRateLimit
    corsRateLimit --> marketing
    corsRateLimit --> authPages
    corsRateLimit --> dashboard
    corsRateLimit --> setupWizard
    corsRateLimit --> campaignUi
    corsRateLimit --> landingAgentUi
    corsRateLimit --> intelDashboard
    corsRateLimit --> publishedPages

    dashboard --> apiProxy
    setupWizard --> apiProxy
    campaignUi --> apiProxy
    landingAgentUi --> apiProxy
    intelDashboard --> apiProxy
    publishedPages --> apiProxy
    extension --> apiProxy

    apiProxy --> fastify
    fastify --> routeLoader
    routeLoader --> routeAdapter
    routeAdapter --> requestAuth
    routeAdapter --> responseBridge

    requestAuth --> campaignApis
    requestAuth --> landingApis
    requestAuth --> intelApis
    requestAuth --> sequenceApis
    requestAuth --> setupApis
    requestAuth --> billingApis
    requestAuth --> analyticsApis
    requestAuth --> extensionApis
    requestAuth --> adminApis

    campaignApis --> campaigns
    landingApis --> landingAgent
    intelApis --> intel
    sequenceApis --> sequences
    setupApis --> settings
    billingApis --> settings
    analyticsApis --> campaigns
    extensionApis --> workflows
    adminApis --> governance

    campaigns --> promptBuilders
    landingAgent --> promptBuilders
    intel --> netjanaPipeline
    intel --> rag
    sequences --> channelWorkers
    rag --> modelGateway
    workflows --> workers
    inbox --> eventStore
    governance --> guardrails
    landingAgent --> adapters

    promptBuilders --> modelGateway
    netjanaPipeline --> eventStore
    netjanaPipeline --> emailComposer
    emailComposer --> modelGateway
    modelGateway --> guardrails
    workers --> eventStore
    channelWorkers --> eventStore
    adapters --> eventStore

    campaigns --> prisma
    leads --> prisma
    landingAgent --> prisma
    intel --> prisma
    sequences --> prisma
    rag --> prisma
    workflows --> prisma
    governance --> prisma
    settings --> prisma

    prisma --> postgres
    netjanaPipeline --> signalStore
    workers --> signalStore
    signalStore --> postgres
    workers -. cache and queues .-> redis
    modelGateway --> llm
    channelWorkers --> smtp
    channelWorkers --> linkedin
    billingApis --> payments
    adapters --> crm
    landingAgent --> knowledge
    intel --> knowledge
    governance --> audit

    extensionApis -. optional private execution .-> edgeApi
    edgeApi --> hardware
    edgeApi --> browserNode
```

## Layer Responsibilities

| Layer | Name | Responsibilities |
| --- | --- | --- |
| 0 | Actors and Channels | Browser users, anonymous visitors, email/LinkedIn prospects, operators, extension users, webhook senders |
| 1 | Delivery and Routing | Public path allowlist, API proxying, direct API ingress, middleware, CORS, rate limits, route protection |
| 2 | Web Experience | Next.js pages, dashboard shells, setup wizard, Intel dashboard, landing-agent UI, public landing rendering |
| 3 | API Runtime Boundary | Fastify server, route loading, dynamic route params, response header/cookie bridge |
| 4 | Application Services | Route handlers for campaigns, landing-agent, intel/webhooks, setup, billing, analytics, extension, admin |
| 5 | Domain Modules | Campaigns, leads, landing-agent, intel/signals, knowledge, workflows, inbox, governance, settings |
| 6 | AI and Automation | Prompt construction, Netjana normalization/scoring/matching, model gateway, signal-aware email composer, guardrails, workers, event store |
| 7 | Data Access and Persistence | Prisma, Postgres, ShadowSignal/ScrapingJob/Job rows, optional Redis, knowledge assets, audit/system events |
| 8 | External Integrations | Netjana/ConvoSpan Intel, LLMs, email, LinkedIn/browser actions, payments, CRM/enrichment |
| 9 | Optional Private Edge | Edge FastAPI, private execution context, browser or hardware-backed tasks |

## Request Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Client as Browser or Extension
    participant MW as Next Middleware
    participant Web as apps/web
    participant Proxy as /api/proxy
    participant API as Fastify Route Adapter
    participant Auth as Request Auth Context
    participant Service as Domain Service
    participant Prisma as Prisma
    participant DB as Postgres
    participant Ext as External Provider

    Client->>MW: Request page or API path
    MW->>MW: Apply public allowlist, feature gates, rate limits
    MW->>Web: Render page or route handler
    Web->>Proxy: Forward API request with cookies and headers
    Proxy->>API: Forward to apps/api route
    API->>Auth: Resolve user, team, role, workspace cookie
    Auth-->>API: Authorized request context
    API->>Service: Validate payload and call domain service
    Service->>Prisma: Read or write system state
    Prisma->>DB: Query transaction
    Service->>Ext: Optional AI, email, CRM, payment, or edge call
    Service-->>API: Typed result or API error
    API-->>Proxy: NextResponse-compatible response
    Proxy-->>Web: Response body, status, headers
    Web-->>Client: Rendered UI or JSON response
```

## Control Plane And Data Plane

```mermaid
flowchart LR
    subgraph control["Control Plane"]
        auth[Auth and Session Policy]
        rbac[Team RBAC]
        featureFlags[Feature Flags]
        governance[Governance Policies]
        audit[Audit Logs]
        observability[Health, Metrics, Client Errors]
    end

    subgraph data["Data Plane"]
        leadData[Leads and Accounts]
        signalData[Netjana Signals and Intel Knowledge]
        campaignData[Campaigns and Variants]
        landingData[Landing Campaigns, Pages, Leads, Events]
        knowledgeData[Knowledge Bases and Assets]
        billingData[Plans, Credits, Payments]
        workflowData[Jobs, Workflows, Schedules]
    end

    subgraph execution["Execution Plane"]
        routeHandlers[Route Handlers]
        domainServices[Domain Services]
        workers[Workers]
        aiCalls[AI Calls]
        emailSends[Email Sends]
        linkedinActions[LinkedIn Actions]
        edgeTasks[Optional Edge Tasks]
    end

    auth --> routeHandlers
    rbac --> routeHandlers
    featureFlags --> routeHandlers
    governance --> domainServices
    domainServices --> audit
    routeHandlers --> observability
    workers --> observability

    routeHandlers --> domainServices
    domainServices --> leadData
    domainServices --> signalData
    domainServices --> campaignData
    domainServices --> landingData
    domainServices --> knowledgeData
    domainServices --> billingData
    workers --> workflowData

    domainServices --> aiCalls
    domainServices --> emailSends
    workers --> linkedinActions
    domainServices -. private optional .-> edgeTasks
```

## Platform Runtime

```mermaid
flowchart TB
    %% External actors
    browser[User Browser]
    publicVisitor[Anonymous Landing Page Visitor]
    admin[Operator or Admin]

    %% Web app
    subgraph web["apps/web - Next.js"]
        marketing[Marketing and Auth Pages]
        dashboard[Authenticated Dashboard]
        setup[Setup Wizard]
        intelPage["/intel Netjana Dashboard"]
        landingUi[Landing Agent UI]
        publicLanding["/p/[slug] Public Pages"]
        proxy["/api/proxy/* Route Handler"]
        middleware[Proxy Middleware and Rate Limits]
    end

    %% API app
    subgraph api["apps/api - Fastify + Next-style route adapter"]
        routeLoader[Filesystem Route Loader]
        authContext[Request-aware Auth Context]
        coreApi[Core Campaign, Lead, Billing, Analytics APIs]
        landingApi[Landing Agent APIs]
        intelApi[Netjana Webhook and Intel APIs]
        sequenceApi[Sequence and Channel APIs]
        governance[Governance, Approval, Audit]
        workers[Workers and Queue Consumers]
    end

    %% Optional edge
    subgraph edge["apps/edge-fastapi - Optional Private Edge Runtime"]
        edgeApi[Edge Execution APIs]
        browserNode[Browser or Hardware-backed Actions]
    end

    %% Shared code
    subgraph shared["packages/* and shared contracts"]
        schemas[Shared Types and Schemas]
        ui[Shared UI Patterns]
        config[Shared Config and Scripts]
    end

    %% Persistence and infrastructure
    subgraph infra["Infrastructure"]
        postgres[(Postgres)]
        redis[(Redis - optional cache and queues)]
        signalRows[(ShadowSignal, ScrapingJob, Job rows)]
        objectStore[(Uploaded Assets and Knowledge Items)]
    end

    %% External services
    subgraph external["External Providers"]
        llm[LLM Providers]
        netjana[Netjana / ConvoSpan Intel]
        email[SMTP and Email Providers]
        linkedIn[LinkedIn and Browser-backed Actions]
        payments[Razorpay]
        crm[CRM and Enrichment Providers]
    end

    browser --> middleware
    publicVisitor --> middleware
    admin --> middleware
    middleware --> marketing
    middleware --> dashboard
    middleware --> setup
    middleware --> intelPage
    middleware --> landingUi
    middleware --> publicLanding

    dashboard --> proxy
    setup --> proxy
    intelPage --> proxy
    landingUi --> proxy
    publicLanding --> proxy
    proxy --> routeLoader
    netjana --> routeLoader

    routeLoader --> authContext
    routeLoader --> coreApi
    routeLoader --> landingApi
    routeLoader --> intelApi
    routeLoader --> sequenceApi
    routeLoader --> governance

    coreApi --> postgres
    landingApi --> postgres
    intelApi --> postgres
    intelApi --> signalRows
    sequenceApi --> workers
    governance --> postgres
    workers --> postgres
    signalRows --> postgres
    coreApi -. graceful degradation .-> redis
    workers -. optional queue/cache .-> redis
    landingApi --> objectStore
    intelApi --> objectStore

    coreApi --> llm
    landingApi --> llm
    intelApi --> llm
    coreApi --> email
    workers --> email
    workers --> linkedIn
    coreApi --> payments
    coreApi --> crm

    coreApi -. private optional .-> edgeApi
    edgeApi --> browserNode

    web -. imports .-> shared
    api -. imports .-> shared
```

## Netjana Buyer Signal To Outreach Flow

This is the current buyer-signal path. Netjana is connected through the Intel webhook/service layer, then the signal fans out to dashboarding, lead/campaign enrichment, knowledge/RAG, and channel execution. Direct Landing Agent buyer-intel injection is represented separately as an adapter and is not configured by default.

```mermaid
flowchart TB
    subgraph source["External Signal Source"]
        netjana["Netjana / ConvoSpan Intel<br/>LEAD_CARD_READY, SIGNAL_INGESTED, INTENT_UPDATED"]
    end

    subgraph ingest["API Ingest And Trust Boundary"]
        webhookRoute["POST /webhooks/netjana-intel"]
        authHeaders["x-api-key, x-source, optional x-netjana-signature"]
        validator["validateNetjanaPayload"]
        normalizer["netjanaIntelService<br/>normalize, score, match, trust"]
    end

    subgraph persisted["Persisted Intelligence"]
        scrapingJob[(ScrapingJob audit/replay row)]
        shadowSignal[(ShadowSignal buyer graph row)]
        leadContext[(Lead intentScore, marketContext, enrichedData.netjana)]
        intelKb[(Knowledge Base: Netjana Intelligence)]
        jobQueue[(Job: INTEL_FOLLOWUP_REFRESH)]
    end

    subgraph surfaces["User-Facing Surfaces"]
        intelApi["GET /intel/summary"]
        intelDashboard["apps/web /intel dashboard"]
        campaignPages[Campaign and Lead views]
        approvals[Approval queue]
    end

    subgraph channels["Channel Execution"]
        followupWorker[intel-followup-worker]
        composer[composeNodeA email composer]
        sequenceWorker[SEQUENCE_ACTION worker]
        linkedinRunner[LinkedIn runner]
        emailService[EmailService]
        smtp[SMTP provider]
        linkedin[LinkedIn actions]
    end

    netjana --> webhookRoute
    webhookRoute --> authHeaders
    authHeaders --> validator
    validator --> normalizer

    normalizer --> scrapingJob
    normalizer --> shadowSignal
    normalizer --> leadContext
    normalizer --> intelKb
    normalizer --> jobQueue

    shadowSignal --> intelApi
    intelApi --> intelDashboard
    leadContext --> campaignPages
    intelKb --> composer
    jobQueue --> followupWorker
    followupWorker --> composer
    followupWorker --> approvals
    followupWorker --> campaignPages

    campaignPages --> sequenceWorker
    sequenceWorker --> linkedinRunner
    sequenceWorker --> composer
    composer --> emailService
    emailService --> smtp
    linkedinRunner --> linkedin
```

## Landing, Email, And LinkedIn Conversion Loop

```mermaid
flowchart LR
    subgraph landing["Landing Agent Funnel"]
        user[Authenticated User]
        intake["/landing-agent/new"]
        brief[Generate brief]
        wireframes[Generate/select wireframe]
        editor[Constrained editor]
        publish[Publish]
        publicPage["/p/:slug"]
        landingLead[(LandingLead)]
        landingEvent[(LandingEvent)]
    end

    subgraph campaign["Campaign And Lead System"]
        campaignRecord[(Campaign / LandingCampaign)]
        lead[(Lead)]
        context["Knowledge + market context"]
        activity[(Activity and EventStore)]
    end

    subgraph intel["Buyer Signals"]
        netjanaSignals[(Netjana ShadowSignal)]
        netjanaKnowledge[(Netjana Intelligence KB)]
        buyerAdapter["Landing BuyerIntelAdapter<br/>currently stub unless configured"]
    end

    subgraph outreach["Outbound Channels"]
        linkedinVisit[LinkedIn visit/connect/message]
        emailDraft[Signal-aware email draft]
        approval[Human approval]
        emailSend[SMTP send]
    end

    user --> intake --> brief --> wireframes --> editor --> publish --> publicPage
    publicPage --> landingLead
    publicPage --> landingEvent
    landingLead --> campaignRecord
    landingEvent --> activity

    netjanaSignals --> lead
    netjanaSignals --> context
    netjanaKnowledge --> context
    buyerAdapter -. optional direct landing context .-> brief
    context --> emailDraft
    lead --> emailDraft
    campaignRecord --> emailDraft
    campaignRecord --> linkedinVisit
    linkedinVisit --> emailDraft
    emailDraft --> approval --> emailSend
    emailSend --> activity
```

## Landing Agent Funnel

```mermaid
sequenceDiagram
    autonumber
    actor User as Authenticated User
    participant Web as apps/web Landing Agent UI
    participant Proxy as /api/proxy
    participant API as apps/api landing-agent routes
    participant AI as LLM Provider
    participant DB as Postgres
    actor Visitor as Anonymous Visitor

    User->>Web: Create landing campaign prompt
    Web->>Proxy: POST /landing-agent/campaigns
    Proxy->>API: Forward authenticated request
    API->>DB: Create LandingCampaign

    User->>Web: Add text or PDF context
    Web->>Proxy: POST /landing-agent/campaigns/:id/assets
    Proxy->>API: Forward asset payload
    API->>DB: Store LandingAsset

    User->>Web: Generate brief
    Web->>Proxy: POST /landing-agent/campaigns/:id/brief
    API->>AI: Ask for structured challenge, solution, benefit
    API->>DB: Persist brief fields

    User->>Web: Generate wireframes
    Web->>Proxy: POST /landing-agent/campaigns/:id/wireframes
    API->>AI: Ask for 3 constrained wireframe options
    API->>DB: Store LandingWireframeOption rows

    User->>Web: Select and edit wireframe
    Web->>Proxy: PUT /landing-agent/campaigns/:id/editor-state
    API->>DB: Sanitize and save rendered JSON

    User->>Web: Publish page
    Web->>Proxy: POST /landing-agent/campaigns/:id/publish
    API->>DB: Mark LandingPage published
    API->>DB: Write audit event

    Visitor->>Web: Open /p/:slug
    Web->>Proxy: GET /landing-agent/public/:slug/page
    API->>DB: Read published LandingPage
    Web-->>Visitor: Render public page

    Visitor->>Web: Submit lead form or page event
    Web->>Proxy: POST /landing-agent/public/:slug/lead or event
    API->>DB: Store LandingLead and LandingEvent
```

## AI Guardrails, Token, And Credit Enforcement

```mermaid
flowchart TB
    client[Web or API Client]
    route[AI or Email Generation Route]
    auth[Auth and Team Context Check]
    inputLimits[Route Input Length Limits]
    aiGuard[aiInputGuardrails enforceAIPromptPolicy]
    creditReserve[Atomic credit reservation]
    model[LLM Provider]
    usageLog[LLMUsageLog tokensIn tokensOut cost]
    creditSettle[Usage settlement or refund]
    outputBound[Surface Output Bounds]
    response[Response 200 or 400 401 402]

    client --> route
    route --> auth
    auth --> inputLimits
    inputLimits --> aiGuard
    aiGuard --> creditReserve
    creditReserve --> model
    model --> usageLog
    usageLog --> creditSettle
    creditSettle --> outputBound
    outputBound --> response
```

### Current Hardening Notes (2026-04)

- Legacy queue endpoints are authenticated, team-scoped, and claim-aware (`/queue/pending`, `/queue/result`).
- Agentic RAG campaign scoping now resolves campaign id correctly before search.
- Helper/chat/email/landing generation paths enforce size budgets and prompt-policy checks.
- AI generation with chargeable team contexts uses atomic reservation and usage settlement.
- Embedding requests now go through the guarded billing and usage-log path.
- Landing HTML is sanitized before public render to reduce stored-XSS exposure.
- Sensitive config and governance routes now require elevated team roles and redact secrets on setup/status responses.
