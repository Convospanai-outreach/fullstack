# ConvoSpan Architecture Diagram

This file is GitHub-renderable Mermaid. Copy any fenced `mermaid` block into the Mermaid Live Editor if you need an exported SVG or PNG.

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

