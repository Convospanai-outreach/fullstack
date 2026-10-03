import Link from "next/link";
import { ArrowRight, Check, X, CheckCircle2, Sparkles, PhoneCall, Users, ShieldCheck, ClipboardCheck, History, ArrowUpRight, Headphones } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Human Layer — Caller Task Tracking & Conversion Support | CraftMyFunnel",
    description: "The Human Layer gives your caller team structured next steps, stage-update controls, and follow-up suggestions — so nothing falls through between an email and a signed contract.",
    alternates: {
        canonical: "https://craftmyfunnel.live/products/human-layer",
    },
    openGraph: {
        title: "Human Layer — Caller Task Tracking & Conversion Support | CraftMyFunnel",
        description: "Not every B2B deal closes over email. Structured caller queues, outreach context, and stage governance.",
        url: "https://craftmyfunnel.live/products/human-layer",
        images: [
            {
                url: "/images/og-branded.png",
                width: 1200,
                height: 630,
                alt: "CraftMyFunnel Human Layer Architecture",
            },
        ],
    },
};

const CALLER_FEATURES = [
    {
        title: "Context-Rich Caller Queue",
        description: "Reps do not make cold calls. When an account requires telephone follow-up, the caller views the full outreach timeline: exact emails delivered, buyer signals detected by NetJana, and verified company background.",
    },
    {
        title: "One-Click Stage Governance",
        description: "Advance or flag pipeline stages directly from the calling screen. Every state change logs the operator ID, timestamp, and transition rationale, eliminating ambiguous pipeline updates.",
    },
    {
        title: "Intelligent Follow-Up Suggestions",
        description: "Based on account dormancy and historical outreach engagement, the system suggests specific follow-up timings and opening discussion angles before the conversation begins.",
    },
];

const VERTICAL_USE_CASES = [
    {
        title: "Commercial Security Services",
        pain: "Compliance and site access discussions cannot be completed over brief email exchanges. Callers need immediate visibility into guard licensing notes and site facility specifications.",
    },
    {
        title: "Integrated Facility Management",
        pain: "Multi-facility contracts involve multiple operational stakeholders over months. Structured notes ensure shift handoffs between account managers remain seamless.",
    },
    {
        title: "Executive Staffing & Recruiting",
        pain: "Hiring managers prefer conversational discussions regarding niche candidate profiles. Handing off from email outreach to candidate discovery calls requires exact context preservation.",
    },
    {
        title: "Management & IT Consulting",
        pain: "Consulting retainers require consultative discovery conversations. Callers utilize pre-compiled pain points to discuss project scope intelligently.",
    },
];

const COMPARISON_ROWS = [
    {
        feature: "Full outreach & email context at call start",
        humanLayer: "Native chronological view of all previous emails & buyer signals",
        salesloft: "CRM sync required; partial thread previews",
        aircall: "Call-log popups without native email thread context",
        crm: "Static contact record requiring manual timeline digging",
        hlCheck: true,
        slCheck: true,
        acCheck: false,
        crmCheck: false,
    },
    {
        feature: "Direct funnel stage progression from call screen",
        humanLayer: "Instant audited stage advance with reason logging",
        salesloft: "Available via cadence step progression",
        aircall: "Call tags only; separate CRM update required",
        crm: "Manual field editing across multiple pages",
        hlCheck: true,
        slCheck: true,
        acCheck: false,
        crmCheck: true,
    },
    {
        feature: "Signal-aware follow-up suggestion engine",
        humanLayer: "Surfaces recommended next actions based on signal recency",
        salesloft: "Cadence timer pauses; lacks operational signal awareness",
        aircall: "Not available",
        crm: "Not available without custom workflow programming",
        hlCheck: true,
        slCheck: false,
        acCheck: false,
        crmCheck: false,
    },
    {
        feature: "Native connection with AI email approval queue",
        humanLayer: "Shared pipeline; call notes inform subsequent AI email drafts",
        salesloft: "Isolated cadence branches",
        aircall: "Third-party webhook integration required",
        crm: "Disconnected email and task modules",
        hlCheck: true,
        slCheck: false,
        acCheck: false,
        crmCheck: false,
    },
    {
        feature: "Predictive auto-dialing & audio transcription",
        humanLayer: "Phase 2 — planned (focus is governance & context today)",
        salesloft: "Live feature (integrated dialer)",
        aircall: "Live feature (core telephony focus)",
        crm: "Add-on telephony bundle required",
        hlCheck: false,
        slCheck: true,
        acCheck: true,
        crmCheck: false,
    },
];

const KEY_FACTS = [
    {
        q: "What is the Human Layer?",
        a: "The Human Layer is CraftMyFunnel's structured calling and escalation module. It provides phone representatives with complete outreach context, suggested conversation starters, and direct funnel stage governance.",
    },
    {
        q: "Does the Human Layer include an automated predictive dialer?",
        a: "No. The Human Layer focuses on context enablement and pipeline governance. Automated voice dialing, call recording, and AI speech transcription are scheduled for Phase 2.",
    },
    {
        q: "Can callers update lead stages directly during a call?",
        a: "Yes. Representatives can advance leads to meeting-ready, schedule follow-ups, or archive disqualified accounts with an audited, single-click interface.",
    },
    {
        q: "How does the Human Layer receive prospect context?",
        a: "It inherits the full activity trail from NetJana buyer signals and CMF Core email dispatches, providing callers with the prospect's exact response history and industry triggers.",
    },
];

const FAQS = [
    {
        q: "How does a caller view prior email correspondence?",
        a: "The caller task card opens with a unified chronological timeline displaying every dispatched email, open event, reply text, and NetJana buyer trigger side-by-side with prospect contact info.",
    },
    {
        q: "Does the Human Layer replace VoIP telephony software like Aircall?",
        a: "The Human Layer organizes what to say, who to call, and how to govern the stage outcome. Callers initiate phone calls using their existing desk phone or preferred browser telephony tool.",
    },
    {
        q: "What happens when a caller flags a lead for email follow-up?",
        a: "The account transitions back to CMF Core with the caller's notes attached. The AI drafting engine reads the notes and prepares a personalized follow-up draft in the manager's approval queue.",
    },
    {
        q: "Is the Human Layer available on all subscription tiers?",
        a: "Yes. Basic caller task management is included across all CraftMyFunnel plans, with advanced multi-caller queue routing available on Growth and Enterprise tiers.",
    },
    {
        q: "How does audit logging ensure operational accountability?",
        a: "Every stage advancement, disposition change, or task postponement records the specific user ID and timestamp, providing executive clarity on pipeline velocity.",
    },
];

export default function HumanLayerPage() {
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
                        "name": "Human Layer",
                        "item": "https://craftmyfunnel.live/products/human-layer",
                    },
                ],
            },
            {
                "@type": "SoftwareApplication",
                "name": "Human Layer — Caller Task & Conversion Pipeline",
                "applicationCategory": "BusinessApplication",
                "operatingSystem": "Web",
                "description": "Structured caller task queue providing contextual email history, buyer signal notes, and stage governance for high-touch B2B sales teams.",
                "url": "https://craftmyfunnel.live/products/human-layer",
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
                    "Full chronological email and signal context preview",
                    "Audited pipeline stage advancement",
                    "Automated follow-up suggestion engine",
                    "Integration with AI email draft approval queue",
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
                        <span className="text-slate-200">Human Layer</span>
                    </nav>

                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider">
                        <PhoneCall className="w-3.5 h-3.5" />
                        Conversion Moat
                    </div>

                    <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
                        Not Every B2B Deal Closes Over Email. Here&apos;s What Happens Next.
                    </h1>

                    <p className="text-lg sm:text-xl text-slate-300 max-w-3xl leading-relaxed">
                        The Human Layer is the structured escalation path for deals that need a human voice. Your callers don&apos;t start from scratch — they inherit full context: what was sent, what was said, and what the recommended next step is.
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
                        The 9-Day Silence: Why We Built Caller Context Queues
                    </h2>
                    <p className="text-sm leading-relaxed text-slate-300">
                        We developed the Human Layer after observing a consistent failure pattern across commercial service pilots: an email outreach would receive an interested reply stating &ldquo;Call my office on Thursday,&rdquo; but because the prospect context lived exclusively inside one rep&apos;s email client, nobody made the call for 9 days. The opportunity died of neglect. The Human Layer bridges digital email outreach and human phone conversations by converting stalled accounts into prioritized caller tasks with historical threads attached.
                    </p>
                </section>

                {/* 3 Feature Cards */}
                <section aria-labelledby="features-heading" className="space-y-6">
                    <div className="space-y-2">
                        <h2 id="features-heading" className="text-2xl sm:text-3xl font-bold text-white">
                            Three Pillars of Caller Governance
                        </h2>
                        <p className="text-sm text-slate-400">
                            Equipping internal phone representatives with the full context required to close.
                        </p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-3">
                        {CALLER_FEATURES.map((feat) => (
                            <div key={feat.title} className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-3">
                                <h3 className="text-base font-bold text-white flex items-center gap-2">
                                    <ClipboardCheck className="w-4 h-4 text-blue-400" />
                                    {feat.title}
                                </h3>
                                <p className="text-xs leading-relaxed text-slate-300">
                                    {feat.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* What It Does / Does NOT Do (Honesty Section per AGENTS.md) */}
                <section aria-labelledby="boundaries-heading" className="space-y-6">
                    <div className="space-y-2">
                        <h2 id="boundaries-heading" className="text-2xl sm:text-3xl font-bold text-white">
                            Functional Boundaries
                        </h2>
                        <p className="text-sm text-slate-400">
                            Honest, verifiable operational boundaries for the Human Layer.
                        </p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-3">
                            <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                What the Human Layer Does
                            </h3>
                            <ul className="space-y-2 text-xs text-slate-300">
                                <li className="flex items-start gap-2">
                                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                    <span>Presents prior email exchanges and detected buyer signals before dialing</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                    <span>Provides one-click stage advancements with audit logging</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                    <span>Suggests customized opening lines based on account pain points</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                    <span>Syncs notes back into CMF Core to inform subsequent email drafts</span>
                                </li>
                            </ul>
                        </div>

                        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-3">
                            <h3 className="text-sm font-bold text-slate-400 flex items-center gap-2">
                                <History className="w-4 h-4 text-slate-500" />
                                What the Human Layer Does NOT Do
                            </h3>
                            <ul className="space-y-2 text-xs text-slate-400">
                                <li className="flex items-start gap-2">
                                    <span className="text-slate-600">•</span>
                                    <span>Does not provide automated predictive or robocall dialing (manual or click-to-call)</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-slate-600">•</span>
                                    <span>Does not attempt to replace human reps with synthetic voice AI bots</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-slate-600">•</span>
                                    <span>Does not transcribe or analyze audio streams (planned for Phase 2)</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-slate-600">•</span>
                                    <span>Does not dispatch messages autonomously without operator trigger</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Industry Fit Cards */}
                <section aria-labelledby="verticals-heading" className="space-y-6">
                    <div className="space-y-2">
                        <h2 id="verticals-heading" className="text-2xl sm:text-3xl font-bold text-white">
                            Built for Conversational B2B Service Sales
                        </h2>
                        <p className="text-sm text-slate-400">
                            Service industries where contract sign-off demands telephone qualification.
                        </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        {VERTICAL_USE_CASES.map((item) => (
                            <div key={item.title} className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 space-y-2">
                                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                                    <ArrowUpRight className="w-3.5 h-3.5 text-blue-400" />
                                    {item.title}
                                </h3>
                                <p className="text-xs leading-relaxed text-slate-300">
                                    {item.pain}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Technical Depth Section (E-E-A-T) */}
                <section aria-labelledby="technical-depth-heading" className="rounded-2xl bg-slate-900/50 border border-slate-800 p-6 sm:p-8 space-y-4">
                    <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider">
                        <ShieldCheck className="w-4 h-4" />
                        Pipeline Integrity
                    </div>
                    <h2 id="technical-depth-heading" className="text-xl sm:text-2xl font-bold text-white">
                        Stage-Transition Audit Trail & Operator Attribution
                    </h2>
                    <p className="text-sm leading-relaxed text-slate-300">
                        In high-stakes commercial sales, ambiguous pipeline statuses (&ldquo;I thought John updated that account&rdquo;) degrade sales forecasting and allow high-value leads to stall. Every status change in the Human Layer commits an immutable audit event recording the authenticated operator ID, originating IP, previous status, updated status, and discretionary disposition rationale. This deterministic log ensures total accountability between outbound marketing teams and executive account executives.
                    </p>
                    <div className="pt-2 text-xs">
                        <Link href="/blog/ai-agents-vs-traditional-sdr-teams-cost-comparison-and-performance-breakdown" className="text-blue-400 hover:text-blue-300 font-semibold underline flex items-center gap-1">
                            Read our analysis on SDR team structures and human-in-the-loop economics <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                </section>

                {/* Comparison Table */}
                <section aria-labelledby="comparison-heading" className="space-y-6">
                    <div className="space-y-2">
                        <h2 id="comparison-heading" className="text-2xl sm:text-3xl font-bold text-white">
                            Human Layer vs. Telephony & Calling Software
                        </h2>
                        <p className="text-sm text-slate-400">
                            How context-rich caller governance compares to standalone VoIP software.
                        </p>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="border-b border-slate-800 bg-slate-950/80 text-xs font-semibold uppercase text-slate-400">
                                <tr>
                                    <th scope="col" className="p-4 sm:p-5">Feature</th>
                                    <th scope="col" className="p-4 sm:p-5 text-blue-400">Human Layer</th>
                                    <th scope="col" className="p-4 sm:p-5">Salesloft Dialer</th>
                                    <th scope="col" className="p-4 sm:p-5">Aircall</th>
                                    <th scope="col" className="p-4 sm:p-5">Vanilla CRM</th>
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
                                                {row.hlCheck ? (
                                                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                                ) : (
                                                    <span className="text-xs text-amber-400 font-semibold">Planned</span>
                                                )}
                                                <span className="text-xs text-slate-200">{row.humanLayer}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 sm:p-5">
                                            <div className="flex items-start gap-2">
                                                {row.slCheck ? (
                                                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                                ) : (
                                                    <X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                                )}
                                                <span className="text-xs text-slate-400">{row.salesloft}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 sm:p-5">
                                            <div className="flex items-start gap-2">
                                                {row.acCheck ? (
                                                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                                ) : (
                                                    <X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                                )}
                                                <span className="text-xs text-slate-400">{row.aircall}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 sm:p-5">
                                            <div className="flex items-start gap-2">
                                                {row.crmCheck ? (
                                                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                                ) : (
                                                    <X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                                )}
                                                <span className="text-xs text-slate-400">{row.crm}</span>
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
                            How does the Human Layer differ from standalone dialers like Salesloft and Aircall?
                        </p>
                        <p className="leading-relaxed">
                            While Salesloft and Aircall focus on telephony hardware routing, predictive dialing, and call recording, the Human Layer focuses on outreach intelligence and pipeline governance. It equips human callers with live buyer signals, pre-analyzed email threads, and direct funnel stage transitions, ensuring telephone outreach connects contextually with prior digital outreach.
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
                            Questions regarding caller setup, telephony tools, and CRM coordination.
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
                        <Link href="/products/ai-outreach" className="rounded-xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 p-3.5 text-xs transition-colors">
                            <span className="font-bold text-white block">AI Outreach</span>
                            <span className="text-[11px] text-slate-400">CMF Core Approval Engine →</span>
                        </Link>
                        <div className="rounded-xl border border-blue-500/40 bg-blue-500/10 p-3.5 text-xs">
                            <span className="font-bold text-white block">Human Layer</span>
                            <span className="text-[11px] text-blue-300">Current Component</span>
                        </div>
                    </div>
                </section>

                {/* Related Reading (E-E-A-T Authority) */}
                <aside aria-label="Related Documentation and Articles" className="rounded-2xl bg-slate-900/30 border border-slate-800/80 p-5 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Related Engineering Guides & Industry Use Cases
                    </h3>
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
                        <Link href="/use-cases/security-services" className="text-blue-400 hover:text-blue-300 underline">
                            Security Services Commercial Outbound Guide
                        </Link>
                        <Link href="/use-cases/staffing" className="text-blue-400 hover:text-blue-300 underline">
                            Staffing & Executive Recruiting Playbook
                        </Link>
                        <Link href="/docs/governed-outreach" className="text-blue-400 hover:text-blue-300 underline">
                            Governed Outreach Architecture Specification
                        </Link>
                    </div>
                </aside>

                {/* Transparency Disclaimer */}
                <div className="rounded-2xl bg-slate-900/40 border border-slate-800 p-5 text-xs text-slate-400 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Operational Transparency
                    </h4>
                    <p className="leading-relaxed">
                        The Human Layer provides context surfaces and stage governance tools for phone representatives. It does not automate human conversation or guarantee closed contracts. Commercial success relies on your sales team&apos;s relationship building, negotiation, and delivery capability. Review our <Link href="/terms" className="text-blue-400 hover:underline">Terms of Service</Link> and <Link href="/privacy" className="text-blue-400 hover:underline">Privacy Policy</Link>.
                    </p>
                </div>

                {/* Footer Dual CTA */}
                <footer className="pt-4 pb-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800">
                    <div className="text-center sm:text-left">
                        <p className="text-base font-bold text-white">Empower your callers with context, not cold scripts</p>
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
