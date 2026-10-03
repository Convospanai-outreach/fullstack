import Link from "next/link";
import { ArrowRight, Check, X, CheckCircle2, Sparkles, Workflow, ShieldCheck, Layers, FileCheck, Clock, AlertCircle } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Fluid Funnel Engine — Governed B2B Outreach Pipeline | CraftMyFunnel",
    description: "The Fluid Funnel Engine governs every step from signal to meeting — drafting, approval, sending, tracking, and follow-up — without letting anything fall through the cracks.",
    alternates: {
        canonical: "https://craftmyfunnel.live/products/fluid-funnel-engine",
    },
    openGraph: {
        title: "Fluid Funnel Engine — Governed B2B Outreach Pipeline | CraftMyFunnel",
        description: "Six steps. Every lead. One governed loop. Import, draft, approve, send, track, escalate — nothing exits the pipeline without a human decision on it.",
        url: "https://craftmyfunnel.live/products/fluid-funnel-engine",
        images: [
            {
                url: "/images/og-branded.png",
                width: 1200,
                height: 630,
                alt: "CraftMyFunnel Fluid Funnel Engine Architecture",
            },
        ],
    },
};

const FEATURE_ROWS = [
    {
        feature: "Mandatory human approval before send",
        cmf: "Native interactive batch queue before any message is dispatched",
        competitor1: "Not default; direct auto-pilot sends without approval gate",
        competitor2: "Manager alerts or post-send override only; sends automatically",
        cmfCheck: true,
        c1Check: false,
        c2Check: false,
    },
    {
        feature: "Unified lead timeline across channels",
        cmf: "Email, LinkedIn context reader, and caller logs in one activity trail",
        competitor1: "Email sequences only; disparate CRM tasks for other channels",
        competitor2: "Email and phone sequences; siloed LinkedIn activity",
        cmfCheck: true,
        c1Check: false,
        c2Check: true,
    },
    {
        feature: "Stuck lead auto-surfacing",
        cmf: "Auto-flagged at configurable dormancy thresholds (default 15 days)",
        competitor1: "Manual report filtering required to identify cold contacts",
        competitor2: "Cadence pause alerts without guided reactivation drafts",
        cmfCheck: true,
        c1Check: false,
        c2Check: true,
    },
    {
        feature: "AI draft generation with review gate",
        cmf: "Multi-model synthesis with mandatory manager edit/approval queue",
        competitor1: "AI writing assistant with direct send capability",
        competitor2: "Generative snippets without enforced governance gates",
        cmfCheck: true,
        c1Check: false,
        c2Check: false,
    },
    {
        feature: "Vertical service-team playbooks",
        cmf: "Pre-built sequence blueprints for Facility, Security, Staffing, Consulting",
        competitor1: "Generic B2B SaaS cadence templates",
        competitor2: "Generic outbound templates requiring manual customization",
        cmfCheck: true,
        c1Check: false,
        c2Check: false,
    },
    {
        feature: "Per-workspace multi-tenant isolation",
        cmf: "Deterministic HMAC-SHA256 blind indexing & Transactional Outbox relay",
        competitor1: "Shared multi-tenant database tables with standard filters",
        competitor2: "Centralized cloud data store with logical tenant separation",
        cmfCheck: true,
        c1Check: false,
        c2Check: false,
    },
];

const FLOW_STEPS = [
    {
        step: "01",
        title: "Import or capture leads",
        description: "Pull target contacts from LinkedIn, inbound landing pages, or verified CSV lists. Every record enters a single governed workspace with team visibility — eliminating isolated prospect tabs or private inboxes.",
    },
    {
        step: "02",
        title: "Draft approved email",
        description: "AI drafts initial outreach grounded in live buyer signals and target company context. Every draft routes to a central manager review queue. Messages dispatch only after human sign-off — preventing unvetted sends.",
    },
    {
        step: "03",
        title: "Sync LinkedIn context",
        description: "Before follow-ups dispatch, operators view synced professional context including role changes, recent updates, and company movements to ensure ongoing relevance.",
    },
    {
        step: "04",
        title: "Track channel status",
        description: "Dispatched emails, synced profile notes, and logged calls reflect across a unified chronological timeline. Team members verify interaction history instantly without chasing internal status updates.",
    },
    {
        step: "05",
        title: "Review stuck leads",
        description: "Accounts with no forward progression surface automatically based on dormancy thresholds. The engine displays prior messaging, past responses, and recommended next steps before relationships stall.",
    },
    {
        step: "06",
        title: "Advance funnel stage",
        description: "Stage progression occurs through deliberate, auditable operator decisions. When an account demonstrates meeting-readiness, pipeline visibility updates across the entire team in real time.",
    },
];

const KEY_FACTS = [
    {
        q: "What is the Fluid Funnel Engine?",
        a: "The Fluid Funnel Engine is a 6-step governed outreach pipeline that coordinates lead ingestion, AI draft generation, mandatory human approval, authenticated mailbox dispatch, response tracking, and dormant lead surfacing.",
    },
    {
        q: "How many stages are in the Fluid Funnel workflow?",
        a: "Six distinct stages: Import or capture leads, Draft approved email, Sync LinkedIn context, Track channel status, Review stuck leads, and Advance funnel stage.",
    },
    {
        q: "Does the Fluid Funnel Engine replace a CRM?",
        a: "No. The engine governs active outreach workflows, human approvals, and message dispatch. It complements core CRMs such as HubSpot or Salesforce by ensuring data cleanliness and brand governance before records update.",
    },
    {
        q: "What communication channels are currently supported?",
        a: "Live support includes Google Workspace/Gmail OAuth and authenticated custom SMTP/IMAP mailboxes. LinkedIn messaging, WhatsApp Business, and human voice telephony are planned for Phase 2.",
    },
];

const FAQS = [
    {
        q: "How does the approval queue prevent bottlenecking?",
        a: "Drafts populate a unified batch review interface. Managers review up to 40 personalized drafts in 15 minutes with single-click approvals, inline prompt refinements, or batch rejections.",
    },
    {
        q: "What happens when a prospect lead becomes stuck?",
        a: "If an account shows no engagement after a user-configured threshold (default 15 days), the Fluid Funnel Engine flags it for team review with previous touchpoints and suggested follow-up angles.",
    },
    {
        q: "How does it guarantee message deliverability?",
        a: "The engine integrates RFC 5322 Message-ID sync, RFC 8058 one-click unsubscribe headers, strict daily mailbox volume caps, and automatic bounce-rate circuit breakers to protect sender domains.",
    },
    {
        q: "Can multiple team members collaborate on the same funnel?",
        a: "Yes. Workspaces feature role-based permissions (Owner, Admin, Member, Viewer) with shared funnel visibility, audit trails, and isolated workspace data boundaries.",
    },
    {
        q: "Is there a pilot or trial available?",
        a: "Yes. Teams can join the 30-day guided pilot covering initial signal setup, qualification rules, multi-channel template approval, and pipeline verification.",
    },
];

export default function FluidFunnelEnginePage() {
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
                        "name": "Fluid Funnel Engine",
                        "item": "https://craftmyfunnel.live/products/fluid-funnel-engine",
                    },
                ],
            },
            {
                "@type": "SoftwareApplication",
                "name": "Fluid Funnel Engine",
                "applicationCategory": "BusinessApplication",
                "operatingSystem": "Web",
                "description": "Governed 6-step B2B outreach pipeline coordinating lead capture, AI drafting, human review, email dispatch, and dormant lead surfacing.",
                "url": "https://craftmyfunnel.live/products/fluid-funnel-engine",
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
                    "Mandatory human-in-the-loop approval queue",
                    "6-stage governed funnel workflow",
                    "Automated stuck lead surfacing",
                    "Transactional Outbox zero-loss message dispatch",
                    "HMAC-SHA256 blind indexing data isolation",
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
                        <span className="text-slate-200">Fluid Funnel Engine</span>
                    </nav>

                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider">
                        <Workflow className="w-3.5 h-3.5" />
                        Governed Outreach Pipeline
                    </div>

                    <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
                        The Funnel Doesn&apos;t Leak Anymore.
                    </h1>

                    <p className="text-lg sm:text-xl text-slate-300 max-w-3xl leading-relaxed">
                        Six steps. Every lead. One governed loop. Import, draft, approve, send, track, escalate — nothing exits the pipeline without a human decision on it.
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
                            Gmail & SMTP Connected
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                            Every Action Human-Approved
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                            Transactional Outbox Reliability
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
                        Why We Engineered the 6-Step Closed Loop
                    </h2>
                    <p className="text-sm leading-relaxed text-slate-300">
                        We built the 6-step loop after watching 12 B2B service teams lose high-value contracts to silent leads that slipped through fragmented spreadsheet cracks. The stuck-lead surfacing threshold (configurable, default 15 days) exists because field telemetry showed that 15 days of inaction marks the cliff where accounts go permanently cold. Rather than automating uncontrolled spam, the engine enforces accountability at each transition.
                    </p>
                </section>

                {/* 6-Step Funnel Flow */}
                <section aria-labelledby="flow-heading" className="space-y-6">
                    <div className="space-y-2">
                        <h2 id="flow-heading" className="text-2xl sm:text-3xl font-bold text-white">
                            The 6-Step Governed Funnel Flow
                        </h2>
                        <p className="text-sm text-slate-400">
                            A repeatable, deterministic path that guides prospect interactions from signal capture to qualification.
                        </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {FLOW_STEPS.map((step) => (
                            <div key={step.step} className="rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors p-6 flex flex-col justify-between space-y-4">
                                <div className="space-y-3">
                                    <span className="text-xs font-black uppercase tracking-widest text-blue-400">
                                        Step {step.step}
                                    </span>
                                    <h3 className="text-lg font-bold text-white">
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

                {/* Why Not Just a CRM */}
                <section aria-labelledby="crm-comparison-heading" className="space-y-6">
                    <div className="space-y-2">
                        <h2 id="crm-comparison-heading" className="text-2xl sm:text-3xl font-bold text-white">
                            Why Outreach Teams Need More Than a Standard CRM
                        </h2>
                        <p className="text-sm text-slate-400">
                            CRMs were built to record commercial history. The Fluid Funnel Engine was built to govern outbound decisions.
                        </p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-4">
                            <h3 className="text-lg font-bold text-slate-300 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-slate-400" />
                                What Traditional CRMs Do
                            </h3>
                            <ul className="space-y-2.5 text-sm text-slate-400">
                                <li className="flex items-start gap-2">
                                    <span className="text-slate-500">•</span>
                                    <span>Log activity and messages after they have already been sent</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-slate-500">•</span>
                                    <span>Display historical lead stages without surfacing urgency</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-slate-500">•</span>
                                    <span>Store static contact cards across disconnected account lists</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-slate-500">•</span>
                                    <span>Rely on reps remembering to log notes and update pipeline fields</span>
                                </li>
                            </ul>
                        </div>

                        <div className="rounded-2xl bg-slate-900/60 border border-blue-500/30 p-6 space-y-4 bg-gradient-to-b from-blue-950/20 to-slate-900/60">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5 text-blue-400" />
                                What the Fluid Funnel Engine Does
                            </h3>
                            <ul className="space-y-2.5 text-sm text-slate-200">
                                <li className="flex items-start gap-2">
                                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                    <span>Enforces human review before any outreach message leaves the system</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                    <span>Automatically elevates stuck deals before accounts go permanently cold</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                    <span>Correlates buyer signals and contact context directly in draft prompts</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                    <span>Provides callers and managers with verified, stage-specific next steps</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Technical Depth Section (E-E-A-T) */}
                <section aria-labelledby="technical-depth-heading" className="rounded-2xl bg-slate-900/50 border border-slate-800 p-6 sm:p-8 space-y-4">
                    <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider">
                        <Layers className="w-4 h-4" />
                        Architectural Integrity
                    </div>
                    <h2 id="technical-depth-heading" className="text-xl sm:text-2xl font-bold text-white">
                        How the Transactional Outbox Prevents Lost Messages
                    </h2>
                    <p className="text-sm leading-relaxed text-slate-300">
                        Traditional cold email automation relies on direct queue pushes or background cron workers that frequently drop messages during network partitions or cloud restarts. The Fluid Funnel Engine implements an atomic Transactional Outbox pattern. State transitions, draft approvals, and outbound dispatch records commit in the same database transaction. A dedicated background poller claims events with deterministic lease locks and idempotency keys, guaranteeing that every approved email is dispatched exactly once — with zero lost events even across transient API failovers.
                    </p>
                    <div className="pt-2 text-xs">
                        <Link href="/docs/governed-outreach" className="text-blue-400 hover:text-blue-300 font-semibold underline flex items-center gap-1">
                            Read the complete Governed Outreach Architecture documentation <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                </section>

                {/* Comparison Table */}
                <section aria-labelledby="comparison-heading" className="space-y-6">
                    <div className="space-y-2">
                        <h2 id="comparison-heading" className="text-2xl sm:text-3xl font-bold text-white">
                            Fluid Funnel Engine vs. Legacy Sales Sequences
                        </h2>
                        <p className="text-sm text-slate-400">
                            Comparison of outbound pipeline governance, deliverability controls, and workflow gating.
                        </p>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="border-b border-slate-800 bg-slate-950/80 text-xs font-semibold uppercase text-slate-400">
                                <tr>
                                    <th scope="col" className="p-4 sm:p-5">Feature</th>
                                    <th scope="col" className="p-4 sm:p-5 text-blue-400">Fluid Funnel Engine</th>
                                    <th scope="col" className="p-4 sm:p-5">HubSpot Sequences</th>
                                    <th scope="col" className="p-4 sm:p-5">Salesloft</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/80">
                                {FEATURE_ROWS.map((row) => (
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
                                                {row.c1Check ? (
                                                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                                ) : (
                                                    <X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                                )}
                                                <span className="text-xs text-slate-400">{row.competitor1}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 sm:p-5">
                                            <div className="flex items-start gap-2">
                                                {row.c2Check ? (
                                                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                                ) : (
                                                    <X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                                )}
                                                <span className="text-xs text-slate-400">{row.competitor2}</span>
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
                            How does the Fluid Funnel Engine differ from HubSpot Sequences and Salesloft?
                        </p>
                        <p className="leading-relaxed">
                            While HubSpot Sequences and Salesloft prioritize automated sending cadences that release emails directly upon timer expiration, the Fluid Funnel Engine enforces mandatory human manager approvals before any dispatch. It also integrates automated stuck lead surfacing and tenant-isolated HMAC-SHA256 blind indexing specifically built for compliance-minded B2B service teams.
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
                            Answers regarding pipeline mechanics, human oversight, and CRM compatibility.
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
                        <div className="rounded-xl border border-blue-500/40 bg-blue-500/10 p-3.5 text-xs">
                            <span className="font-bold text-white block">Fluid Funnel</span>
                            <span className="text-[11px] text-blue-300">Current Component</span>
                        </div>
                        <Link href="/products/buyer-signals" className="rounded-xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 p-3.5 text-xs transition-colors">
                            <span className="font-bold text-white block">Buyer Signals</span>
                            <span className="text-[11px] text-slate-400">NetJana Intent Monitoring →</span>
                        </Link>
                        <Link href="/products/ai-outreach" className="rounded-xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 p-3.5 text-xs transition-colors">
                            <span className="font-bold text-white block">AI Outreach</span>
                            <span className="text-[11px] text-slate-400">CMF Core Approval Engine →</span>
                        </Link>
                        <Link href="/products/human-layer" className="rounded-xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 p-3.5 text-xs transition-colors">
                            <span className="font-bold text-white block">Human Layer</span>
                            <span className="text-[11px] text-slate-400">Caller Tasks & Stage Controls →</span>
                        </Link>
                    </div>
                </section>

                {/* Related Reading (E-E-A-T Authority) */}
                <aside aria-label="Related Documentation and Articles" className="rounded-2xl bg-slate-900/30 border border-slate-800/80 p-5 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Related Engineering Guides & Research
                    </h3>
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
                        <Link href="/docs/governed-outreach" className="text-blue-400 hover:text-blue-300 underline">
                            Governed Outreach Architecture Specification
                        </Link>
                        <Link href="/docs/deliverability-guardrails" className="text-blue-400 hover:text-blue-300 underline">
                            RFC 5322 Message-ID Deliverability Guardrails
                        </Link>
                        <Link href="/blog/the-complete-guide-to-email-deliverability-for-ai-generated-cold-outreach" className="text-blue-400 hover:text-blue-300 underline">
                            Engineering Guide to Outbound Email Deliverability
                        </Link>
                    </div>
                </aside>

                {/* Transparency Disclaimer (Trustworthiness) */}
                <div className="rounded-2xl bg-slate-900/40 border border-slate-800 p-5 text-xs text-slate-400 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Operational Transparency
                    </h4>
                    <p className="leading-relaxed">
                        CraftMyFunnel is a workflow management and governance application designed to help commercial teams track leads, approve AI drafts, and manage dispatch lifecycles. It does not provide guaranteed meetings, guaranteed pipeline outcomes, or automated commercial results. Outcome metrics vary depending on targeting accuracy, market offer, and message relevance. Review our <Link href="/terms" className="text-blue-400 hover:underline">Terms of Service</Link> and <Link href="/privacy" className="text-blue-400 hover:underline">Privacy Policy</Link>.
                    </p>
                </div>

                {/* Footer Dual CTA */}
                <footer className="pt-4 pb-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800">
                    <div className="text-center sm:text-left">
                        <p className="text-base font-bold text-white">Ready to govern your outbound pipeline?</p>
                        <p className="text-xs text-slate-400">Join the 30-day pilot or review transparent tier pricing.</p>
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
