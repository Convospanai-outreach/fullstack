# ConvoSpan Architecture Diagram

This file is GitHub-renderable Mermaid. Copy any fenced `mermaid` block into the Mermaid Live Editor if you need an exported SVG or PNG.

## Layered System Design

```mermaid
flowchart TB
    subgraph L0["Layer 0 - Actors and Channels"]
        browser[Authenticated Browser User]
        visitor[Anonymous Landing Visitor]
        operator[Internal Operator]
        extension[Chrome Extension Operator]
        webhook[External Webhook Sender]
    end

    subgraph L1["Layer 1 - Delivery and Routing"]
        webIngress[Web Ingress]
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
        adapters[Buyer Intel, Enrichment, Outreach Adapters]
    end

    subgraph L7["Layer 7 - Data Access and Persistence"]
        prisma[Prisma Client]
        postgres[(Postgres)]
        redis[(Redis Optional)]
        knowledge[(Knowledge Items and Assets)]
        audit[(Audit and System Events)]
    end

    subgraph L8["Layer 8 - External Integrations"]
        llm[LLM Providers]
        smtp[SMTP and Email Providers]
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
    operator --> webIngress
    extension --> webIngress
    webhook --> webIngress

    webIngress --> nextMiddleware
    nextMiddleware --> publicRoutes
    nextMiddleware --> corsRateLimit
    corsRateLimit --> marketing
    corsRateLimit --> authPages
    corsRateLimit --> dashboard
    corsRateLimit --> setupWizard
    corsRateLimit --> campaignUi
    corsRateLimit --> landingAgentUi
    corsRateLimit --> publishedPages

    dashboard --> apiProxy
    setupWizard --> apiProxy
    campaignUi --> apiProxy
    landingAgentUi --> apiProxy
    publishedPages --> apiProxy
    extension --> apiProxy

    apiProxy --> fastify
    fastify --> routeLoader
    routeLoader --> routeAdapter
    routeAdapter --> requestAuth
    routeAdapter --> responseBridge

    requestAuth --> campaignApis
    requestAuth --> landingApis
    requestAuth --> setupApis
    requestAuth --> billingApis
    requestAuth --> analyticsApis
    requestAuth --> extensionApis
    requestAuth --> adminApis

    campaignApis --> campaigns
    landingApis --> landingAgent
    setupApis --> settings
    billingApis --> settings
    analyticsApis --> campaigns
    extensionApis --> workflows
    adminApis --> governance

    campaigns --> promptBuilders
    landingAgent --> promptBuilders
    rag --> modelGateway
    workflows --> workers
    inbox --> eventStore
    governance --> guardrails
    landingAgent --> adapters

    promptBuilders --> modelGateway
    modelGateway --> guardrails
    workers --> eventStore
    adapters --> eventStore

    campaigns --> prisma
    leads --> prisma
    landingAgent --> prisma
    rag --> prisma
    workflows --> prisma
    governance --> prisma
    settings --> prisma

    prisma --> postgres
    workers -. cache and queues .-> redis
    modelGateway --> llm
    campaignApis --> smtp
    billingApis --> payments
    adapters --> crm
    landingAgent --> knowledge
    governance --> audit

    extensionApis -. optional private execution .-> edgeApi
    edgeApi --> hardware
    edgeApi --> browserNode
```

## Layer Responsibilities

| Layer | Name | Responsibilities |
| --- | --- | --- |
| 0 | Actors and Channels | Browser users, anonymous visitors, operators, extension users, webhook senders |
| 1 | Delivery and Routing | Public path allowlist, API proxying, middleware, CORS, rate limits, route protection |
| 2 | Web Experience | Next.js pages, dashboard shells, setup wizard, landing-agent UI, public landing rendering |
| 3 | API Runtime Boundary | Fastify server, route loading, dynamic route params, response header/cookie bridge |
| 4 | Application Services | Route handlers and app-level service surfaces grouped by product area |
| 5 | Domain Modules | Campaigns, leads, landing-agent, knowledge, workflows, inbox, governance, settings |
| 6 | AI and Automation | Prompt construction, model gateway, guardrails, adapters, workers, event store |
| 7 | Data Access and Persistence | Prisma, Postgres, optional Redis, knowledge assets, audit/system events |
| 8 | External Integrations | LLMs, email, payments, CRM/enrichment, browser automation providers |
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
    domainServices --> campaignData
    domainServices --> landingData
    domainServices --> knowledgeData
    domainServices --> billingData
    workers --> workflowData

    domainServices --> aiCalls
    domainServices --> emailSends
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
        objectStore[(Uploaded Assets and Knowledge Items)]
    end

    %% External services
    subgraph external["External Providers"]
        llm[LLM Providers]
        email[SMTP and Email Providers]
        payments[Razorpay]
        crm[CRM and Enrichment Providers]
    end

    browser --> middleware
    publicVisitor --> middleware
    admin --> middleware
    middleware --> marketing
    middleware --> dashboard
    middleware --> setup
    middleware --> landingUi
    middleware --> publicLanding

    dashboard --> proxy
    setup --> proxy
    landingUi --> proxy
    publicLanding --> proxy
    proxy --> routeLoader

    routeLoader --> authContext
    routeLoader --> coreApi
    routeLoader --> landingApi
    routeLoader --> governance

    coreApi --> postgres
    landingApi --> postgres
    governance --> postgres
    workers --> postgres
    coreApi -. graceful degradation .-> redis
    workers -. optional queue/cache .-> redis
    landingApi --> objectStore

    coreApi --> llm
    landingApi --> llm
    coreApi --> email
    coreApi --> payments
    coreApi --> crm

    coreApi -. private optional .-> edgeApi
    edgeApi --> browserNode

    web -. imports .-> shared
    api -. imports .-> shared
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
