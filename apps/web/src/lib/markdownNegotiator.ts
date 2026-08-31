import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Checks if the request is asking for a markdown representation via Accept header.
 * Only applies to document/page requests, excluding APIs, static files, and assets.
 */
export function isMarkdownRequested(req: { headers: { get(name: string): string | null }; nextUrl: { pathname: string } }): boolean {
    const accept = req.headers.get('accept') || '';
    if (!accept.includes('text/markdown')) {
        return false;
    }

    const pathname = req.nextUrl.pathname;

    // Do not negotiate for APIs, Next.js internal routes, or static files
    if (
        pathname.startsWith('/api') ||
        pathname.startsWith('/_next') ||
        pathname.startsWith('/admin') ||
        pathname.startsWith('/dashboard') ||
        /\.(ico|png|jpg|jpeg|svg|webp|gif|css|js|map|json|xml|txt|pdf|woff|woff2|ttf|eot)$/i.test(pathname)
    ) {
        return false;
    }

    return true;
}

/**
 * Estimates LLM token count from markdown text (approx 4 chars per token).
 */
export function estimateMarkdownTokens(markdown: string): number {
    return Math.max(1, Math.ceil(markdown.length / 4));
}

/**
 * Generates a clean, formatting-stripped markdown representation for any requested site page.
 */
export function getMarkdownForPath(pathname: string, baseUrl: string = 'https://craftmyfunnel.live'): string {
    const cleanPath = pathname.replace(/\/$/, '') || '/';

    // Route-specific markdown representations
    switch (cleanPath) {
        case '/':
            return `# CraftMyFunnel — Governed B2B Outbound Sales Engine

CraftMyFunnel is an enterprise outbound sales and AI outreach governance platform. It combines intent signal ingestion, AI draft generation with human-in-the-loop review, and deliverability guardrails to build predictable B2B sales pipelines.

## Core Philosophy
1. **Human-in-the-Loop Governance**: AI drafts emails, but sales leaders retain approval before any message is dispatched.
2. **Deliverability & Reputation Guardrails**: RFC 5322 compliant threading, RFC 8058 one-click unsubscribe, bounce circuit breakers, and warm-up schedules.
3. **Deterministic Multi-Tenancy**: Complete team isolation with HMAC-SHA256 blind indexing and transactional outbox pattern.

## Key Capabilities
- **Signal Ingestion**: Monitor commercial triggers, hiring surges, funding events, and RFP notices.
- **AI Personalization**: Contextual RAG with pgvector embedding of company collateral and value propositions.
- **Unified Approvals Queue**: One-click review, edit, reject, or schedule actions across sales teams.
- **Outcome Tracking**: Inbound reply classification, meeting attribution, and deliverability health monitoring.

## System Specifications
- **Full Architecture & Technical Specs**: [${baseUrl}/llms-full.txt](${baseUrl}/llms-full.txt)
- **Integrations Directory**: [${baseUrl}/integrations](${baseUrl}/integrations)
- **Technical Glossary**: [${baseUrl}/glossary](${baseUrl}/glossary)
- **Case Studies**: [${baseUrl}/case-studies](${baseUrl}/case-studies)
- **Pricing & Pilot Guarantee**: [${baseUrl}/pricing](${baseUrl}/pricing)
`;

        case '/pricing':
            return `# CraftMyFunnel — Pricing & Commercial Models

Transparent credit-based pricing designed for B2B service teams, consulting firms, and enterprise outreach teams.

## Pricing Plans

### 1. Pilot ($49 / 30-Day Guarantee)
- **Target**: Ideal for testing a single vertical offer or geographic corridor.
- **Credits**: 1,000 verified credits.
- **Mailboxes**: Up to 2 connected Google Workspace / SMTP inboxes.
- **Features**: Human approval queue, AI draft generator, RFC 8058 unsubscribe, basic analytics.

### 2. Growth Autopilot ($99 / month)
- **Target**: Growing outbound teams requiring continuous lead pipeline.
- **Credits**: 5,000 monthly credits.
- **Mailboxes**: Up to 5 connected inboxes with warm-up scheduling.
- **Features**: Everything in Pilot plus CRM sync (HubSpot, Salesforce, Pipedrive), custom persona prompt templates, and deliverability circuit breakers.

### 3. Enterprise ($499 / month)
- **Target**: High-volume sales operations, multi-region teams, and sovereign data deployments.
- **Credits**: 25,000 monthly credits with rollover.
- **Mailboxes**: Unlimited connected inboxes.
- **Features**: Private edge runtime support, bespoke fine-tuned RAG vectors, dedicated IP pooling, and SLA support desk.

## Deliverability Guarantee
Every plan includes automated domain health checks, DNS verification (SPF, DKIM, DMARC), and RFC 5322 wire message threading.
`;

        case '/faq':
            return `# CraftMyFunnel — Frequently Asked Questions (FAQ)

## 1. What makes CraftMyFunnel different from legacy cold email tools?
CraftMyFunnel is built around *governance*. Unlike autonomous scrapers that spam inboxes, CraftMyFunnel generates tailored drafts that require human approval before sending. It also enforces RFC 5322 wire threading and RFC 8058 unsubscribe headers to safeguard domain reputation.

## 2. Does CraftMyFunnel support Google Workspace and Gmail API?
Yes. Mailboxes connect via secure OAuth 2.0 or SMTP/IMAP credentials stored with AES-256-GCM encryption. The platform adheres to Google's Limited Use requirements.

## 3. How does human-in-the-loop review work?
AI drafts are routed to a centralized approvals dashboard. Operators can review proposed copy, tweak variables, reject poor fits, or batch-approve communications.

## 4. How are buyer intent signals gathered?
CraftMyFunnel tracks executive hiring changes, funding alerts, technology stack migrations, and commercial RFP postings across targeted verticals.

## 5. Can I integrate with my existing CRM?
Yes. Native bidirectional integrations exist for HubSpot, Salesforce, Pipedrive, and webhooks for custom pipelines.
`;

        case '/integrations':
            return `# CraftMyFunnel — Integrations & Protocol Directory

CraftMyFunnel connects seamlessly with your existing email, CRM, communication, and automation stack.

## Supported Protocols & Ecosystem Partners
- **Google Workspace**: Native OAuth 2.0 integration with PubSub push notifications for real-time reply tracking.
- **SMTP & IMAP**: Universal enterprise mail server compatibility with TLS 1.3 encryption.
- **HubSpot CRM**: Bidirectional sync for contacts, campaign engagements, and meeting booking stages.
- **Salesforce**: Enterprise lead object mapping, task attribution, and activity tracking.
- **Pipedrive**: Deal pipeline stage automation and activity synchronization.
- **Slack**: Instant approval notifications and reply alerts in dedicated deal channels.
- **Zapier & Make**: Webhook-driven event automation for custom workflows.
- **REST & OpenAPI**: Secure developer API with rate-limiting and team-scoped authorization.
`;

        case '/glossary':
            return `# CraftMyFunnel — Technical & Outbound Glossary

Authoritative definitions of key concepts across deliverability, generative optimization, and outreach architecture.

- **Generative Engine Optimization (GEO)**: The process of structuring web content, data schemas, and specifications so AI answer engines (Perplexity, ChatGPT, Claude) accurately index and cite platform authority.
- **Human-in-the-Loop (HITL)**: A workflow architecture where generative AI drafts outreach communications, but human approval is mandatory prior to wire dispatch.
- **RFC 5322**: The Internet Message Format standard governing email headers, including Message-ID generation and in-reply-to threading.
- **RFC 8058**: The standard for one-click unsubscribe headers in bulk email, preventing spam flag penalties.
- **Deterministic Blind Indexing**: An encryption pattern (using HMAC-SHA256) that allows exact-match database queries without storing or exposing plaintext PII.
- **Contextual RAG**: Retrieval-Augmented Generation that injects verified company case studies and ICP knowledge vectors into LLM prompt contexts.
- **Transactional Outbox**: An asynchronous reliability pattern ensuring database state updates and external messaging actions stay atomic and resilient to failure.
`;

        case '/case-studies':
            return `# CraftMyFunnel — Enterprise Outbound Case Studies

Verified scenario implementations across B2B verticals.

## Case Study 1: Commercial Facility Management
- **Challenge**: Low response rates to generic cold email and high RFP missed deadlines.
- **Solution**: Automated intent monitoring for commercial lease expansions combined with human-reviewed tailored proposals.
- **Outcome**: 4.8x increase in qualified RFP discovery meetings and 0% deliverability penalties.

## Case Study 2: Enterprise Managed IT Services (MSP)
- **Challenge**: Domain burning from previous unmanaged email volume.
- **Solution**: Domain reputation warmup schedule, RFC 8058 one-click headers, and partner-reviewed technical briefings.
- **Outcome**: 99.4% inbox placement across Microsoft 365 and Google Workspace recipients.

## Case Study 3: Executive Search & Staffing
- **Challenge**: High manual effort required to personalize talent presentations for C-suite buyers.
- **Solution**: Multi-tenant vector RAG referencing candidate capability profiles with 1-click recruiter approval queue.
- **Outcome**: 62% reduction in draft preparation time and 31% qualified client briefing rate.
`;

        case '/about':
            return `# About CraftMyFunnel

CraftMyFunnel engineers high-performance, governed B2B outbound infrastructure.

## Institutional Background
- **Entity**: Convospan AI Private Limited
- **Registration**: Ministry of Corporate Affairs (MCA), Government of India
- **Offices**: Bengaluru Tech Corridor (Karnataka) and Connaught Place (New Delhi)
- **Leadership**: Founded by Siddharth Kumar, Lead Systems Architect

## Core Engineering Principles
1. **Zero Unapproved Autonomy**: Critical communications always require human sign-off.
2. **Strict Multi-Tenancy**: Data isolation is enforced at the database query layer with mandatory team scoping.
3. **Standards-First Deliverability**: Adherence to IETF RFC standards for all email wire operations.
`;

        case '/contact':
            return `# Contact CraftMyFunnel

- **Sales Inquiries**: sales@craftmyfunnel.live
- **Engineering & Support**: support@craftmyfunnel.live
- **Security & Vulnerability Reporting**: security@craftmyfunnel.live
- **Headquarters**: Bengaluru, Karnataka, India
- **Regional Desk**: New Delhi, India
`;

        default:
            // Dynamic path handlers
            if (cleanPath.startsWith('/blog/')) {
                const slug = cleanPath.replace('/blog/', '');
                return `# Blog Article: ${slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}

Published by CraftMyFunnel Engineering & Research Team.
Full article available online at [${baseUrl}${cleanPath}](${baseUrl}${cleanPath}).

## Overview
This technical publication covers autonomous outbound sales architecture, deliverability engineering, and LLM-assisted B2B workflows.

For the full specification and system details, refer to:
- [CraftMyFunnel Specification](${baseUrl}/llms-full.txt)
- [Outbound Deliverability Guide](${baseUrl}/docs/deliverability-guardrails)
- [Governed Outreach Lifecycle](${baseUrl}/docs/governed-outreach)
`;
            }

            if (cleanPath.startsWith('/locations/')) {
                const city = cleanPath.replace('/locations/', '');
                const formattedCity = city.charAt(0).toUpperCase() + city.slice(1);
                return `# ${formattedCity} B2B Outbound Corridors — CraftMyFunnel

Regional sales intelligence, commercial corridor signal monitoring, and governed B2B outreach infrastructure for companies operating in and targeting ${formattedCity}.

## Capabilities for ${formattedCity} Enterprises
- Localized commercial trigger and expansion monitoring.
- Multi-mailbox delivery balancing across domestic and international accounts.
- Governed human approval queue ensuring copy compliance with enterprise standards.
- Full platform specification: [${baseUrl}/llms-full.txt](${baseUrl}/llms-full.txt).
`;
            }

            if (cleanPath.startsWith('/use-cases/')) {
                const vertical = cleanPath.replace('/use-cases/', '');
                const formattedVertical = vertical.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                return `# ${formattedVertical} — Outbound Playbook & Architecture

Dedicated B2B sales automation playbook for ${formattedVertical} organizations.

## Industry Workflow
1. **Signal Radar**: Ingest trigger events specific to ${formattedVertical} procurement cycles.
2. **AI Personalization**: Ground outbound copy in verified sector credentials, compliance certifications, and case studies.
3. **Approval Queue**: Practice leads review and approve messaging before dispatch.
4. **Meeting Tracking**: Real-time attribution of inbound responses to booked meetings.

Explore all vertical playbooks: [${baseUrl}/use-cases](${baseUrl}/use-cases)
Full architecture documentation: [${baseUrl}/llms-full.txt](${baseUrl}/llms-full.txt)
`;
            }

            // Generic fallback representation for any valid site path
            return `# CraftMyFunnel — ${cleanPath}

Governed B2B Funnel Workflows & AI Outbound Sales Platform.

- Canonical URL: [${baseUrl}${cleanPath}](${baseUrl}${cleanPath})
- Full System Architecture: [${baseUrl}/llms-full.txt](${baseUrl}/llms-full.txt)
- Integrations Ecosystem: [${baseUrl}/integrations](${baseUrl}/integrations)
- Technical Glossary: [${baseUrl}/glossary](${baseUrl}/glossary)
- Documentation: [${baseUrl}/docs](${baseUrl}/docs)
`;
    }
}

/**
 * Creates a negotiated text/markdown response with appropriate headers.
 */
export function createMarkdownResponse(markdown: string): NextResponse {
    const tokens = estimateMarkdownTokens(markdown);

    return new NextResponse(markdown, {
        status: 200,
        headers: {
            'Content-Type': 'text/markdown; charset=utf-8',
            'Vary': 'Accept',
            'x-markdown-tokens': tokens.toString(),
            'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        },
    });
}
