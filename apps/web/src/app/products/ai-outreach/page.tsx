import Link from "next/link";
import { ArrowRight, Check, X, CheckCircle2, Sparkles, Cpu, ShieldCheck, Mail, Lock, Layers, Zap, AlertTriangle, FileCode } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "CMF Core — AI Outreach with Human Approval | CraftMyFunnel",
    description: "CMF Core drafts personalised outreach with multi-model AI, routes every message through manager approval, and maintains a unified activity timeline across email and LinkedIn.",
    alternates: {
        canonical: "https://craftmyfunnel.live/products/ai-outreach",
    },
    openGraph: {
        title: "CMF Core — AI Outreach with Human Approval | CraftMyFunnel",
        description: "AI writes the draft. Your manager clears it. Then and only then, it goes out. Governed AI outbound sales engine.",
        url: "https://craftmyfunnel.live/products/ai-outreach",
        images: [
            {
                url: "/images/og-branded.png",
                width: 1200,
                height: 630,
                alt: "CraftMyFunnel CMF Core Architecture",
            },
        ],
    },
};

const APPROVAL_LOOP = [
    {
        stage: "01",
        title: "Signal Ingestion",
        description: "Target accounts surface from NetJana buyer signals or CSV imports. Contextual details, industry tags, and verified contact variables load directly into the synthesis pipeline.",
    },
    {
        stage: "02",
        title: "RAG AI Drafting",
        description: "Multi-model engine (GPT-4o, Claude 3.5 Sonnet, Gemini 1.5 Pro) synthesizes relevant past client case studies and company pain points using pgvector semantic retrieval.",
    },
    {
        stage: "03",
        title: "Manager Approval Gate",
        description: "Drafts enter a unified interactive batch queue. Managers review, annotate, refine, or reject drafts in seconds. No email can leave the system without deliberate human clearance.",
    },
    {
        stage: "04",
        title: "Governed Dispatch & Tracking",
        description: "Approved messages send through authenticated Google Workspace or SMTP mailboxes. Deliverability guardrails enforce daily volume pacing and RFC 5322 Message-ID sync.",
    },
];

const ARCHITECTURE_CARDS = [
    {
        title: "Multi-Model AI Router",
        description: "Provider-agnostic routing dynamically balances synthesis between OpenAI GPT-4o, Anthropic Claude 3.5 Sonnet, and Google Gemini. If an upstream provider encounters rate limits or downtime, fallback chains switch seamlessly with zero downtime.",
    },
    {
        title: "Contextual pgvector RAG",
        description: "Generic AI outreach hallucinates or sounds robotic. CMF Core embeds your company's actual customer case studies, technical specifications, and industry proof points, injecting verified factual snippets into every tailored pitch.",
    },
    {
        title: "Input Guardrails & Policy Checks",
        description: "Centralized prompt-policy controllers inspect prompt length, filter dangerous prompt-injection tokens, scrub sensitive internal data, and verify compliance boundaries before generation calls execute.",
    },
];

const CHANNELS = [
    { channel: "Google Workspace / Gmail OAuth", status: "Live & Supported", note: "OIDC-verified PubSub lease-locked synchronization with RFC 5322 header sync" },
    { channel: "Custom SMTP / IMAP Mailboxes", status: "Live & Supported", note: "Direct TLS/SSL relay with custom domain Message-ID and return-path tracking" },
    { channel: "LinkedIn Sales Navigator", status: "Phase 2 — planned", note: "Context read supported today; direct messaging dispatch in active development" },
    { channel: "WhatsApp Business API", status: "Phase 2 — planned", note: "Official template-based conversational outreach in development" },
    { channel: "Human Voice Caller Queue", status: "Live (via Human Layer)", note: "Caller queue and stage updates natively integrated through the Human Layer" },
];

const COMPARISON_ROWS = [
    {
        feature: "Mandatory human review gate before dispatch",
        cmf: "Strict native queue; no message sends without human clearance",
        instantly: "Autonomous blaster; sends automatically on timer",
        lemlist: "Automated sequence dispatch; no mandatory gating",
        outreach: "Configurable alert tasks, but default is auto-send",
        cmfCheck: true,
        instantlyCheck: false,
        lemlistCheck: false,
        outreachCheck: false,
    },
    {
        feature: "Provider-agnostic multi-model AI routing",
        cmf: "OpenAI, Anthropic Claude, and Gemini with automated fallback",
        instantly: "Single default model without failover redundancy",
        lemlist: "Proprietary single-provider integration",
        outreach: "Proprietary internal LLM features",
        cmfCheck: true,
        instantlyCheck: false,
        lemlistCheck: false,
        outreachCheck: true,
    },
    {
        feature: "Contextual RAG semantic retrieval (pgvector)",
        cmf: "Pulls verified client case studies into draft context",
        instantly: "Basic merge tags and generic prompt generation",
        lemlist: "Liquid syntax and variable replacement",
        outreach: "Field interpolation from CRM records",
        cmfCheck: true,
        instantlyCheck: false,
        lemlistCheck: false,
        outreachCheck: false,
    },
    {
        feature: "RFC 5322 wire Message-ID reply threading",
        cmf: "Captures true wire header post-send to ensure exact thread matching",
        instantly: "Basic subject line matching; prone to broken threads",
        lemlist: "Standard provider ID tracking with known Gmail edge-cases",
        outreach: "Native enterprise threading support",
        cmfCheck: true,
        instantlyCheck: false,
        lemlistCheck: false,
        outreachCheck: true,
    },
    {
        feature: "RFC 8058 one-click unsubscribe automation",
        cmf: "Compliant List-Unsubscribe post headers on every outbound email",
        instantly: "Basic body unsubscribe link only",
        lemlist: "Opt-out footer link",
        outreach: "Enterprise compliance header support",
        cmfCheck: true,
        instantlyCheck: false,
        lemlistCheck: true,
        outreachCheck: true,
    },
    {
        feature: "Transactional Outbox zero-loss guarantee",
        cmf: "Atomic state commits ensure messages are never dropped or double-sent",
        instantly: "Standard queue processing without transactional outbox",
        lemlist: "Standard job queue",
        outreach: "Enterprise messaging bus",
        cmfCheck: true,
        instantlyCheck: false,
        lemlistCheck: false,
        outreachCheck: true,
    },
];

const KEY_FACTS = [
    {
        q: "What is CMF Core?",
        a: "CMF Core is the governed AI outreach engine within CraftMyFunnel. It generates contextually grounded email drafts using multi-model AI, routes all messages through a required human manager review queue, and manages resilient mailbox dispatch.",
    },
    {
        q: "Which AI models does CMF Core support?",
        a: "CMF Core integrates OpenAI GPT-4o, Anthropic Claude 3.5 Sonnet, and Google Gemini 1.5 Pro and Flash through a provider-agnostic router with automatic fallback failover.",
    },
    {
        q: "Can CMF Core send emails autonomously without human approval?",
        a: "No. CMF Core is deliberately architected with a mandatory human approval queue. Every message requires explicit operator review, preventing rogue sends, hallucinations, or brand liability.",
    },
    {
        q: "How does CMF Core protect domain sender reputation?",
        a: "It enforces strict daily send caps per mailbox, automatic bounce-rate circuit breakers, RFC 5322 Message-ID wire sync, and RFC 8058 one-click unsubscribe headers.",
    },
];

const FAQS = [
    {
        q: "Can managers approve drafts in bulk batches?",
        a: "Yes. The batch review queue is optimized for rapid decision-making. Operators can review 30–50 personalized drafts in 15 minutes, approving all verified drafts with a single action or flagging individual messages for edits.",
    },
    {
        q: "What occurs if an AI draft is rejected by a reviewer?",
        a: "When a manager rejects or requests revisions, they can adjust the prompt context or write manual overrides. The system logs feedback to prevent similar phrasing in future generations.",
    },
    {
        q: "How does CMF Core handle Google Workspace authentication?",
        a: "CMF Core connects via official Google Workspace OAuth with granular scopes. It complies strictly with the Google API Services User Data Policy, ensuring emails are dispatched securely.",
    },
    {
        q: "Are credits deducted if a draft is rejected before send?",
        a: "AI synthesis consumes minor generation tokens upon draft creation, but outbound send credits are only settled when an email is approved and successfully transmitted via the outbox.",
    },
    {
        q: "How does pgvector RAG improve outreach reply rates?",
        a: "Instead of generic flattery, RAG locates your company's actual customer case studies that match the prospect's industry and company size, referencing authentic metrics that drive professional engagement.",
    },
];

export default function AiOutreachPage() {
    const jsonLd = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": 1,
                        "name": "Home",
                        "item": "https://craftmyfunnel.live",
                    },
                    {
                        "@type": "ListItem",
                        "position": 2,
                        "name": "Products",
                        "item": "https://craftmyfunnel.live/#workflow",
                    },
                    {
                        "@type": "ListItem",
                        "position": 3,
                        "name": "AI Outreach — CMF Core",
                        "item": "https://craftmyfunnel.live/products/ai-outreach",
                    },
                ],
            },
            {
                "@type": "SoftwareApplication",
                "name": "CMF Core — Governed AI Outreach Engine",
                "applicationCategory": "BusinessApplication",
                "operatingSystem": "Web",
                "description": "Multi-model AI outbound messaging engine with mandatory human review gates, pgvector RAG case study retrieval, and RFC 5322 email deliverability guardrails.",
                "url": "https://craftmyfunnel.live/products/ai-outreach",
                "datePublished": "2026-10-04",
                "dateModified": "2026-10-04",
                "author": {
                    "@type": "Organization",
                    "@id": "https://craftmyfunnel.live/#organization",
                    "name": "CraftMyFunnel",
                },
                "isPartOf": {
                    "@type": "SoftwareApplication",
                    "@id": "https://craftmyfunnel.live/#platform",
                    "name": "CraftMyFunnel Platform",
                },
                "offers": {
                    "@type": "AggregateOffer",
                    "priceCurrency": "USD",
                    "lowPrice": "49",
                    "highPrice": "499",
                    "offerCount": "3",
                    "url": "https://craftmyfunnel.live/pricing",
                },
                "featureList": [
                    "Mandatory human review approval queue",
                    "Multi-model AI routing (OpenAI, Claude, Gemini)",
                    "pgvector semantic vector case-study retrieval",
                    "RFC 5322 Message-ID wire sync & RFC 8058 headers",
                    "Deliverability circuit breakers",
                ],
                "screenshot": "https://craftmyfunnel.live/images/platform/governed-workflow.webp",
            },
            {
                "@type": "FAQPage",
                "mainEntity": [...KEY_FACTS, ...FAQS].map((item) => ({
                    "@type": "Question",
                    "name": item.q,
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": item.a,
                    },
                })),
            },
        ],
    };

    return (
        <main className="min-h-screen bg-[#020617] text-slate-100 pt-28 pb-24 px-4 sm:px-6 lg:px-8">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            <article className="mx-auto max-w-5xl space-y-16">
                {/* Header / Hero */}
                <header className="space-y-6">
                    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                        <Link href="/" className="hover:text-blue-400 transition-colors">Home</Link>
                        <span>/</span>
                        <Link href="/#workflow" className="hover:text-blue-400 transition-colors">Products</Link>
                        <span>/</span>
                        <span className="text-slate-200">AI Outreach — CMF Core</span>
                    </nav>

                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider">
                        <Cpu className="w-3.5 h-3.5" />
                        CMF Core Engine
                    </div>

                    <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
                        AI Writes the Draft. Your Manager Clears It. Then and Only Then, It Goes Out.
                    </h1>

                    <p className="text-lg sm:text-xl text-slate-300 max-w-3xl leading-relaxed">
                        CMF Core is the outreach engine. It connects buyer signals, multi-model AI personalization, manager review, and channel dispatch into one governed workflow — with a full audit trail on every send.
                    </p>

                    {/* Dual CTA */}
                    <div className="flex flex-wrap items-center gap-4 pt-2">
                        <Link
                            href="/#request-invite"
                            className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-xl shadow-blue-600/30 transition-all flex items-center gap-2"
                        >
                            Request Invite <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link
                            href="/pricing"
                            className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition-all"
                        >
                            See Pricing
                        </Link>
                    </div>

                    {/* Trust Badges */}
                    <div className="flex flex-wrap gap-3 pt-2 text-xs text-slate-300">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                            Multi-Model AI (OpenAI · Claude · Gemini)
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                            Enforced Human Review
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                            RFC 5322 & RFC 8058 Compliance
                        </span>
                    </div>

                    {/* Author Attribution Card (E-E-A-T) */}
                    <div className="flex items-center gap-3 pt-4 border-t border-slate-800/80 text-xs text-slate-400">
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">
                            CMF
                        </div>
                        <div>
                            <span className="text-white font-semibold">CraftMyFunnel Engineering</span>
                            <span className="mx-2">·</span>
                            <Link href="/about" className="text-blue-400 hover:text-blue-300 underline">About our team</Link>
                            <span className="mx-2">·</span>
                            <time dateTime="2026-10-04">Updated October 2026</time>
                        </div>
                    </div>
                </header>

                {/* Experience Narrative (E-E-A-T) */}
                <section aria-labelledby="experience-heading" className="rounded-2xl bg-slate-900/40 border border-slate-800 p-6 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400">
                        <Sparkles className="w-4 h-4" />
                        From the Engineering Team
                    </div>
                    <h2 id="experience-heading" className="text-xl font-bold text-white">
                        Why the Approval Queue Was the First Feature We Built
                    </h2>
                    <p className="text-sm leading-relaxed text-slate-300">
                        The mandatory approval queue was the first feature we wrote, not an afterthought bolted on later. The broader cold email software market creates autonomous scrapers that spray thousands of unverified messages, burning domain reputation and alienating prospects. We started from the core premise that LLMs will occasionally hallucinate or misjudge tone. By placing an interactive human review gate directly between the synthesis engine and the SMTP socket, your executive brand remains protected while enjoying AI-assisted drafting efficiency.
                    </p>
                </section>

                {/* The 4-Step Approval Loop */}
                <section aria-labelledby="approval-loop-heading" className="space-y-6">
                    <div className="space-y-2">
                        <h2 id="approval-loop-heading" className="text-2xl sm:text-3xl font-bold text-white">
                            The Governed Outbound Loop
                        </h2>
                        <p className="text-sm text-slate-400">
                            How CMF Core moves an account from signal detection to audited dispatch.
                        </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {APPROVAL_LOOP.map((step) => (
                            <div key={step.stage} className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-3 flex flex-col justify-between">
                                <div className="space-y-2">
                                    <span className="text-xs font-black uppercase tracking-widest text-blue-400">
                                        Stage {step.stage}
                                    </span>
                                    <h3 className="text-base font-bold text-white">
                                        {step.title}
                                    </h3>
                                    <p className="text-xs leading-relaxed text-slate-300">
                                        {step.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* AI Architecture Cards */}
                <section aria-labelledby="architecture-heading" className="space-y-6">
                    <div className="space-y-2">
                        <h2 id="architecture-heading" className="text-2xl sm:text-3xl font-bold text-white">
                            AI Personalization Architecture
                        </h2>
                        <p className="text-sm text-slate-400">
                            Enterprise-grade multi-model synthesis with rigorous guardrails.
                        </p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-3">
                        {ARCHITECTURE_CARDS.map((card) => (
                            <div key={card.title} className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-3">
                                <h3 className="text-base font-bold text-white flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-blue-400" />
                                    {card.title}
                                </h3>
                                <p className="text-xs leading-relaxed text-slate-300">
                                    {card.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* What CMF Core Is NOT (Honesty Block per AGENTS.md) */}
                <section aria-labelledby="guardrails-heading" className="space-y-6">
                    <div className="space-y-2">
                        <h2 id="guardrails-heading" className="text-2xl sm:text-3xl font-bold text-white">
                            Product Boundary & Scope Clarification
                        </h2>
                        <p className="text-sm text-slate-400">
                            We believe in clear product boundaries. Here is exactly what CMF Core is and is not.
                        </p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        <div className="rounded-2xl bg-slate-900/60 border border-red-500/20 p-6 space-y-4">
                            <h3 className="text-base font-bold text-red-300 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-red-400" />
                                What CMF Core Is NOT
                            </h3>
                            <ul className="space-y-2.5 text-xs text-slate-300">
                                <li className="flex items-start gap-2">
                                    <X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                    <span>An autonomous scraper that blasts unreviewed emails without human eyes</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                    <span>A tool that promises guaranteed meetings or automated closed deals</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                    <span>A full CRM replacement (it layers governance over your CRM)</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                    <span>A high-volume spam blaster designed to sacrifice sender reputation</span>
                                </li>
                            </ul>
                        </div>

                        <div className="rounded-2xl bg-slate-900/60 border border-emerald-500/20 p-6 space-y-4">
                            <h3 className="text-base font-bold text-emerald-300 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                What CMF Core IS
                            </h3>
                            <ul className="space-y-2.5 text-xs text-slate-300">
                                <li className="flex items-start gap-2">
                                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                    <span>A human-approved outbound pipeline that enforces message review</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                    <span>A high-context drafting assistant grounded in verified client case studies</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                    <span>A deliverability guardian enforcing RFC 5322 Message-ID sync and send limits</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                    <span>A quality-over-quantity conversion moat for high-trust service sales</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Channel Status */}
                <section aria-labelledby="channels-heading" className="space-y-6">
                    <div className="space-y-2">
                        <h2 id="channels-heading" className="text-2xl sm:text-3xl font-bold text-white">
                            Supported Dispatch Channels
                        </h2>
                        <p className="text-sm text-slate-400">
                            Transparent breakdown of current production and planned Phase-2 communication pathways.
                        </p>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="border-b border-slate-800 bg-slate-950/80 text-xs font-semibold uppercase text-slate-400">
                                <tr>
                                    <th scope="col" className="p-4 sm:p-5">Channel</th>
                                    <th scope="col" className="p-4 sm:p-5">Status</th>
                                    <th scope="col" className="p-4 sm:p-5">Implementation Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/80">
                                {CHANNELS.map((ch) => (
                                    <tr key={ch.channel} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="p-4 sm:p-5 font-semibold text-white">
                                            {ch.channel}
                                        </td>
                                        <td className="p-4 sm:p-5">
                                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${
                                                ch.status.includes("Live")
                                                    ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                                                    : "bg-slate-800 border border-slate-700 text-slate-400"
                                            }`}>
                                                {ch.status}
                                            </span>
                                        </td>
                                        <td className="p-4 sm:p-5 text-xs text-slate-300">
                                            {ch.note}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Technical Depth Section (E-E-A-T) */}
                <section aria-labelledby="technical-depth-heading" className="rounded-2xl bg-slate-900/50 border border-slate-800 p-6 sm:p-8 space-y-4">
                    <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider">
                        <FileCode className="w-4 h-4" />
                        Engineering Deep Dive
                    </div>
                    <h2 id="technical-depth-heading" className="text-xl sm:text-2xl font-bold text-white">
                        Why Provider-Agnostic LLM Routing Protects Business Continuity
                    </h2>
                    <p className="text-sm leading-relaxed text-slate-300">
                        Relying on a single proprietary AI model creates unacceptable platform vulnerability during cloud outages, model deprecations, or sudden price changes. CMF Core standardizes input prompts into normalized AST representations, routing them through an abstracted gateway compatible with OpenAI (GPT-4o), Anthropic (Claude 3.5 Sonnet), and Google (Gemini 1.5 Pro). If an upstream endpoint returns a 429 rate-limit or 503 gateway error, the router automatically fails over to the secondary provider within milliseconds, logging estimated vs actual token expenditure for full billing predictability.
                    </p>
                    <div className="pt-2 text-xs">
                        <Link href="/docs/security-architecture" className="text-blue-400 hover:text-blue-300 font-semibold underline flex items-center gap-1">
                            Review our Security Architecture and Blind Indexing protocols <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                </section>

                {/* Comparison Table */}
                <section aria-labelledby="comparison-heading" className="space-y-6">
                    <div className="space-y-2">
                        <h2 id="comparison-heading" className="text-2xl sm:text-3xl font-bold text-white">
                            CMF Core vs. Traditional Outreach Automation
                        </h2>
                        <p className="text-sm text-slate-400">
                            Evaluating governance gates, model diversity, and deliverability protection.
                        </p>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="border-b border-slate-800 bg-slate-950/80 text-xs font-semibold uppercase text-slate-400">
                                <tr>
                                    <th scope="col" className="p-4 sm:p-5">Capability</th>
                                    <th scope="col" className="p-4 sm:p-5 text-blue-400">CMF Core</th>
                                    <th scope="col" className="p-4 sm:p-5">Instantly</th>
                                    <th scope="col" className="p-4 sm:p-5">Lemlist</th>
                                    <th scope="col" className="p-4 sm:p-5">Outreach.io</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/80">
                                {COMPARISON_ROWS.map((row) => (
                                    <tr key={row.feature} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="p-4 sm:p-5 font-semibold text-white">
                                            {row.feature}
                                        </td>
                                        <td className="p-4 sm:p-5 bg-blue-950/10">
                                            <div className="flex items-start gap-2">
                                                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                                <span className="text-xs text-slate-200">{row.cmf}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 sm:p-5">
                                            <div className="flex items-start gap-2">
                                                {row.instantlyCheck ? (
                                                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                                ) : (
                                                    <X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                                )}
                                                <span className="text-xs text-slate-400">{row.instantly}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 sm:p-5">
                                            <div className="flex items-start gap-2">
                                                {row.lemlistCheck ? (
                                                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                                ) : (
                                                    <X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                                )}
                                                <span className="text-xs text-slate-400">{row.lemlist}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 sm:p-5">
                                            <div className="flex items-start gap-2">
                                                {row.outreachCheck ? (
                                                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                                ) : (
                                                    <X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                                )}
                                                <span className="text-xs text-slate-400">{row.outreach}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Prose summary for LLM Extraction (AGO) */}
                    <div className="text-xs sm:text-sm text-slate-400 rounded-xl bg-slate-900/30 border border-slate-800/60 p-4 space-y-1.5">
                        <p className="font-semibold text-slate-300">
                            How does CMF Core differ from mass cold email tools like Instantly and Lemlist?
                        </p>
                        <p className="leading-relaxed">
                            Unlike Instantly or Lemlist which focus on high-volume automated blasting that can burn domain sender reputation, CMF Core enforces a mandatory human manager review gate before dispatch. It combines multi-model AI routing with pgvector case study grounding and exact RFC 5322 wire Message-ID sync for reliable threading and compliance.
                        </p>
                    </div>
                </section>

                {/* Key Facts Section (AGO) */}
                <section id="key-facts" aria-labelledby="key-facts-heading" className="space-y-6">
                    <h2 id="key-facts-heading" className="text-2xl sm:text-3xl font-bold text-white">
                        Key Facts
                    </h2>
                    <dl className="grid gap-4 sm:grid-cols-2">
                        {KEY_FACTS.map((item) => (
                            <div key={item.q} className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 space-y-2">
                                <dt className="text-sm font-bold text-blue-400">
                                    {item.q}
                                </dt>
                                <dd className="text-xs sm:text-sm leading-relaxed text-slate-300">
                                    {item.a}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </section>

                {/* FAQ Section */}
                <section id="faq" aria-labelledby="faq-heading" className="space-y-6">
                    <div className="space-y-2">
                        <h2 id="faq-heading" className="text-2xl sm:text-3xl font-bold text-white">
                            Frequently Asked Questions
                        </h2>
                        <p className="text-sm text-slate-400">
                            Detailed inquiries on review controls, credit allocations, and deliverability.
                        </p>
                    </div>

                    <div className="space-y-3">
                        {FAQS.map((faq) => (
                            <div key={faq.q} className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-2">
                                <h3 className="text-base font-bold text-white">
                                    {faq.q}
                                </h3>
                                <p className="text-sm leading-relaxed text-slate-300">
                                    {faq.a}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Ecosystem Cross-Links */}
                <section aria-labelledby="ecosystem-heading" className="space-y-4 pt-6 border-t border-slate-800">
                    <h2 id="ecosystem-heading" className="text-lg font-bold text-white">
                        The CraftMyFunnel Ecosystem
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <Link href="/products/fluid-funnel-engine" className="rounded-xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 p-3.5 text-xs transition-colors">
                            <span className="font-bold text-white block">Fluid Funnel</span>
                            <span className="text-[11px] text-slate-400">Governed Pipeline Engine →</span>
                        </Link>
                        <Link href="/products/buyer-signals" className="rounded-xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 p-3.5 text-xs transition-colors">
                            <span className="font-bold text-white block">Buyer Signals</span>
                            <span className="text-[11px] text-slate-400">NetJana Intent Monitoring →</span>
                        </Link>
                        <div className="rounded-xl border border-blue-500/40 bg-blue-500/10 p-3.5 text-xs">
                            <span className="font-bold text-white block">AI Outreach</span>
                            <span className="text-[11px] text-blue-300">Current Component</span>
                        </div>
                        <Link href="/products/human-layer" className="rounded-xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 p-3.5 text-xs transition-colors">
                            <span className="font-bold text-white block">Human Layer</span>
                            <span className="text-[11px] text-slate-400">Caller Tasks & Stage Controls →</span>
                        </Link>
                    </div>
                </section>

                {/* Related Reading (E-E-A-T Authority) */}
                <aside aria-label="Related Documentation and Articles" className="rounded-2xl bg-slate-900/30 border border-slate-800/80 p-5 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Related Engineering Guides & Architecture
                    </h3>
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
                        <Link href="/docs/deliverability-guardrails" className="text-blue-400 hover:text-blue-300 underline">
                            RFC 5322 Deliverability & Unsubscribe Guardrails
                        </Link>
                        <Link href="/docs/security-architecture" className="text-blue-400 hover:text-blue-300 underline">
                            Blind Indexing & Multi-Tenant Isolation
                        </Link>
                        <Link href="/blog/contextual-rag-for-sales-hyper-personalizing-b2b-outreach-with-vector-search" className="text-blue-400 hover:text-blue-300 underline">
                            Contextual RAG for Sales Personalization
                        </Link>
                        <Link href="/google-api-disclosure" className="text-blue-400 hover:text-blue-300 underline">
                            Google API Limited Use Disclosure
                        </Link>
                    </div>
                </aside>

                {/* Transparency Disclaimer */}
                <div className="rounded-2xl bg-slate-900/40 border border-slate-800 p-5 text-xs text-slate-400 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Operational Transparency
                    </h4>
                    <p className="leading-relaxed">
                        CMF Core provides AI draft generation and governance workflows. It is not an autonomous outcome engine and does not guarantee meeting bookings or commercial revenue. Dispatched message responses depend on offer market fit, list hygiene, and message relevance. Review our <Link href="/terms" className="text-blue-400 hover:underline">Terms of Service</Link>, <Link href="/privacy" className="text-blue-400 hover:underline">Privacy Policy</Link>, and <Link href="/google-api-disclosure" className="text-blue-400 hover:underline">Google API Disclosure</Link>.
                    </p>
                </div>

                {/* Footer Dual CTA */}
                <footer className="pt-4 pb-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800">
                    <div className="text-center sm:text-left">
                        <p className="text-base font-bold text-white">Scale outreach quality without risking domain reputation</p>
                        <p className="text-xs text-slate-400">Join the guided 30-day pilot or review platform tiers.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link
                            href="/#request-invite"
                            className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-xl shadow-blue-600/30 transition-all flex items-center gap-2"
                        >
                            Request Invite <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link
                            href="/pricing"
                            className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition-all"
                        >
                            See Pricing
                        </Link>
                    </div>
                </footer>
            </article>
        </main>
    );
}
