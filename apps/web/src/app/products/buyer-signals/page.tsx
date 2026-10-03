import Link from "next/link";
import { ArrowRight, Check, X, CheckCircle2, Sparkles, Network, TrendingUp, ShieldCheck, Database, Building2, Briefcase, FileSearch } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Buyer Signals by NetJana — B2B Intent Data for Service Teams | CraftMyFunnel",
    description: "NetJana monitors hiring surges, facility expansions, tender activity, and procurement changes so your team reaches active buyers before the RFP drops.",
    alternates: {
        canonical: "https://craftmyfunnel.live/products/buyer-signals",
    },
    openGraph: {
        title: "Buyer Signals by NetJana — B2B Intent Data for Service Teams | CraftMyFunnel",
        description: "Reach buyers the week they have a need. Not the week they chose a vendor. Real-time commercial signals for B2B service teams.",
        url: "https://craftmyfunnel.live/products/buyer-signals",
        images: [
            {
                url: "/images/og-branded.png",
                width: 1200,
                height: 630,
                alt: "NetJana Buyer Signals Architecture",
            },
        ],
    },
};

const SIGNALS = [
    {
        title: "Hiring Expansion",
        description: "A target enterprise posting 10+ open roles is actively scaling operational capacity. That expansion generates immediate requirement for physical facility support, site security coverage, contingent staffing, and IT managed services in a single signal.",
        verticalContext: "For Staffing and Facilities teams, sudden headcount growth signals operational strain 60 days before executive leadership considers agency retainers.",
        example: "Trigger: Enterprise posting 14 new facilities and operations roles across 3 weeks.",
    },
    {
        title: "Branch Openings",
        description: "New geographical branches require immediate vendor contracts. Local physical fit-outs, commercial security installations, and regional branch staffing occur before public notices appear.",
        verticalContext: "For Security and Facility Management providers, physical site permits identify commercial lease signings weeks before formal RFPs launch.",
        example: "Trigger: Commercial permit filed for 24,000 sq ft office fit-out in regional tech corridor.",
    },
    {
        title: "Tender Activity",
        description: "When commercial or public procurement notices go live, vendor response windows are brief. NetJana monitors public procurement and commercial RFP announcements the day they publish.",
        verticalContext: "For Consulting and IT contractors, early notification provides time to assemble compliant bidding materials before competitor evaluation cycles close.",
        example: "Trigger: Municipal enterprise portal publishes corporate facility security tender.",
    },
    {
        title: "Facility Expansion",
        description: "Commercial lease signings, construction permit starts, and industrial warehouse re-zoning indicate physical infrastructure readiness weeks before corporate staff move in.",
        verticalContext: "For Integrated Facility Management (IFM) firms, early permit detection allows proactive capability presentations before vendor lists finalize.",
        example: "Trigger: Industrial lease expansion registered for regional fulfillment hub.",
    },
    {
        title: "Procurement Changes",
        description: "A newly appointed VP or Head of Procurement evaluates existing vendor rosters within their first 90 days. NetJana tracks senior procurement leadership moves across target sectors.",
        verticalContext: "For B2B service agencies, procurement leadership transitions represent the highest conversion window for introducing alternative service contracts.",
        example: "Trigger: Tier-1 enterprise announces new VP of Global Procurement.",
    },
    {
        title: "Technology Adoption",
        description: "Enterprise rollouts of major software stacks (ERP, CRM, cybersecurity tooling) create immediate demand for external integration consulting, L&D employee training, and managed tier-2 support.",
        verticalContext: "For Training and IT Managed Service firms, adjacent software adoption identifies warm pipeline accounts requiring rapid workflow upskilling.",
        example: "Trigger: Cloud HRMS and enterprise security tool deployment detected in public job requirements.",
    },
];

const COMPARISON_ROWS = [
    {
        feature: "Service-sector intent signals (FM, Security, Staffing)",
        netjana: "Built for physical & operational service workflows",
        apollo: "Generic tech-stack tags; lacks physical service intent",
        zoominfo: "High-level enterprise technographics without permit data",
        bombora: "Content-consumption web cookies; no physical filings",
        netjanaCheck: true,
        apolloCheck: false,
        zoomCheck: false,
        bomboraCheck: false,
    },
    {
        feature: "Tender & procurement portal monitoring",
        netjana: "Automated tracking across public and commercial portals",
        apollo: "Not available; static contact database only",
        zoominfo: "Limited corporate news alerts without tender indexing",
        bombora: "Not available; domain-level web topic surges only",
        netjanaCheck: true,
        apolloCheck: false,
        zoomCheck: false,
        bomboraCheck: false,
    },
    {
        feature: "Hiring surge correlated with permit filings",
        netjana: "Correlates headcount spikes with commercial fit-out permits",
        apollo: "Job count changes without operational correlation",
        zoominfo: "Org chart alerts without physical expansion permits",
        bombora: "Not available",
        netjanaCheck: true,
        apolloCheck: false,
        zoomCheck: false,
        bomboraCheck: false,
    },
    {
        feature: "Direct handoff to outreach approval queue",
        netjana: "Native push into CMF Core with contextual AI draft prepped",
        apollo: "Export CSV or sync to external sequence",
        zoominfo: "Export list to external CRM or dialer",
        bombora: "Third-party feed exported into advertising platforms",
        netjanaCheck: true,
        apolloCheck: false,
        zoomCheck: false,
        bomboraCheck: false,
    },
    {
        feature: "Mandatory human approval before message send",
        netjana: "Guaranteed human review gate before prospect contact",
        apollo: "Automated sequence dispatch without review gates",
        zoominfo: "N/A (data provider only)",
        bombora: "N/A (data provider only)",
        netjanaCheck: true,
        apolloCheck: false,
        zoomCheck: false,
        bomboraCheck: false,
    },
    {
        feature: "Transparent fixed-tier workspace pricing",
        netjana: "Transparent monthly tiers without predatory lock-in",
        apollo: "Per-seat fees with extra credit add-ons",
        zoominfo: "Annual quote-based enterprise contracts with upfront minimums",
        bombora: "Quote-based enterprise licensing",
        netjanaCheck: true,
        apolloCheck: false,
        zoomCheck: false,
        bomboraCheck: false,
    },
];

const KEY_FACTS = [
    {
        q: "What is NetJana?",
        a: "NetJana is CraftMyFunnel's buyer intent signal engine. It continuously monitors 6 categories of operational corporate intent: hiring surges, branch openings, tender activity, facility expansion, procurement changes, and technology adoption.",
    },
    {
        q: "What data sources does NetJana monitor?",
        a: "NetJana ingests verified public data feeds including corporate job boards, municipal permit records, procurement and tender portals, and executive leadership announcements.",
    },
    {
        q: "How often is intent signal data refreshed?",
        a: "Signal scoring models run daily. Intent-ranked shortlists and context updates refresh overnight so outbound teams start every morning with current account priorities.",
    },
    {
        q: "Does NetJana require a CRM integration to function?",
        a: "No. NetJana natively delivers intent-ranked accounts and contact context into your CraftMyFunnel Core workspace, while supporting optional sync with HubSpot or CSV export.",
    },
];

const FAQS = [
    {
        q: "How does NetJana differ from generic B2B contact databases?",
        a: "Generic databases sell static spreadsheets of contact information that sit dormant for months. NetJana surfaces dynamic timing: identifying which specific accounts are expanding or issuing tenders this week, so outreach is timely and relevant.",
    },
    {
        q: "Can we define custom signal filters for our industry?",
        a: "Yes. Workspaces configure Ideal Customer Profiles (ICPs) including company headcount, target geography, industry sector, and specific intent categories relevant to their service offerings.",
    },
    {
        q: "How does NetJana protect against inaccurate web scraping?",
        a: "Every signal undergoes multi-factor validation against primary source documents (such as verified corporate job pages or municipal permit registries) before entering the scoring pipeline.",
    },
    {
        q: "Is NetJana available as a standalone data subscription?",
        a: "NetJana is integrated directly into CraftMyFunnel to allow immediate AI drafting and human approval workflows, but accounts can be exported via CSV or API for custom reporting.",
    },
    {
        q: "How quickly does an identified signal turn into an outreach draft?",
        a: "Once an account meets your ICP threshold, CMF Core automatically synthesizes company context and generates a review-ready draft in your manager's approval queue.",
    },
];

export default function BuyerSignalsPage() {
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
                        "item": "https://craftmyfunnel.live/#platform",
                    },
                    {
                        "@type": "ListItem",
                        "position": 3,
                        "name": "Buyer Signals — NetJana",
                        "item": "https://craftmyfunnel.live/products/buyer-signals",
                    },
                ],
            },
            {
                "@type": "SoftwareApplication",
                "name": "Buyer Signals (NetJana)",
                "applicationCategory": "BusinessApplication",
                "operatingSystem": "Web",
                "description": "B2B commercial intent data engine monitoring hiring surges, facility permits, tenders, and procurement moves for service teams.",
                "url": "https://craftmyfunnel.live/products/buyer-signals",
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
                    "6 categories of operational corporate intent signals",
                    "Municipal permit and commercial tender monitoring",
                    "Automated ICP fit and recency-decay scoring",
                    "Native handoff to human approval queue",
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
                        <Link href="/#platform" className="hover:text-blue-400 transition-colors">Products</Link>
                        <span>/</span>
                        <span className="text-slate-200">Buyer Signals — NetJana</span>
                    </nav>

                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider">
                        <Network className="w-3.5 h-3.5" />
                        NetJana Intent Ingestion
                    </div>

                    <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
                        Reach Buyers the Week They Have a Need. Not the Week They Chose a Vendor.
                    </h1>

                    <p className="text-lg sm:text-xl text-slate-300 max-w-3xl leading-relaxed">
                        NetJana monitors 6 categories of corporate intent signals continuously. Your outbound team wakes up to an intent-ranked shortlist — not a cold list that hasn&apos;t moved in months.
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
                        Why Cold Lists Fail B2B Service Contractors
                    </h2>
                    <p className="text-sm leading-relaxed text-slate-300">
                        NetJana exists because cold static contact lists fail when selling high-value facility management, commercial security, or managed services. The earliest versions tracked only job board hiring surges. However, after three customer pilot teams independently pointed out that corporate deals are often decided weeks before public job postings go live, we expanded indexing to municipal commercial permits, corporate lease filings, and public tender registries. Reaching prospects during their initial requirement window transforms cold pitching into timely problem solving.
                    </p>
                </section>

                {/* 6 Signal Cards */}
                <section aria-labelledby="signals-heading" className="space-y-6">
                    <div className="space-y-2">
                        <h2 id="signals-heading" className="text-2xl sm:text-3xl font-bold text-white">
                            6 Operational Intent Signals We Monitor
                        </h2>
                        <p className="text-sm text-slate-400">
                            Actionable commercial triggers detected from verified corporate and municipal registries.
                        </p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {SIGNALS.map((signal) => (
                            <div key={signal.title} className="rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors p-6 flex flex-col justify-between space-y-4">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-blue-400">
                                        <TrendingUp className="w-4 h-4" />
                                        <h3 className="text-lg font-bold text-white">{signal.title}</h3>
                                    </div>
                                    <p className="text-xs leading-relaxed text-slate-300">
                                        {signal.description}
                                    </p>
                                    <p className="text-xs leading-relaxed text-slate-400 border-l-2 border-blue-500/40 pl-2.5">
                                        {signal.verticalContext}
                                    </p>
                                </div>
                                <div className="pt-2 border-t border-slate-800/80">
                                    <span className="text-[11px] font-mono text-cyan-300 bg-cyan-950/40 border border-cyan-800/40 px-2 py-1 rounded block">
                                        {signal.example}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* How NetJana Works */}
                <section aria-labelledby="how-it-works-heading" className="space-y-6">
                    <div className="space-y-2">
                        <h2 id="how-it-works-heading" className="text-2xl sm:text-3xl font-bold text-white">
                            How the Ingestion Engine Operates
                        </h2>
                        <p className="text-sm text-slate-400">
                            From public registry monitoring to verified account presentation.
                        </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-3">
                            <span className="text-xs font-black uppercase tracking-widest text-blue-400">Stage 1</span>
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <FileSearch className="w-4 h-4 text-blue-400" />
                                Continuous Monitor
                            </h3>
                            <p className="text-xs leading-relaxed text-slate-300">
                                Scans job boards, commercial building registries, procurement notices, and corporate leadership updates across your chosen target markets.
                            </p>
                        </div>

                        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-3">
                            <span className="text-xs font-black uppercase tracking-widest text-blue-400">Stage 2</span>
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Database className="w-4 h-4 text-blue-400" />
                                Intent Scoring
                            </h3>
                            <p className="text-xs leading-relaxed text-slate-300">
                                Weighs signal recency, event volume, and ICP parameter correlation to compute a 1–100 commercial readiness score for every account.
                            </p>
                        </div>

                        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-3">
                            <span className="text-xs font-black uppercase tracking-widest text-blue-400">Stage 3</span>
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-blue-400" />
                                Queue Surface
                            </h3>
                            <p className="text-xs leading-relaxed text-slate-300">
                                Delivers top-scoring accounts directly into CMF Core with pre-synthesized background context, ready for AI draft formulation and manager review.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Technical Depth Section (E-E-A-T) */}
                <section aria-labelledby="technical-depth-heading" className="rounded-2xl bg-slate-900/50 border border-slate-800 p-6 sm:p-8 space-y-4">
                    <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider">
                        <ShieldCheck className="w-4 h-4" />
                        Scoring Integrity
                    </div>
                    <h2 id="technical-depth-heading" className="text-xl sm:text-2xl font-bold text-white">
                        Signal Scoring Architecture & Recency Decay
                    </h2>
                    <p className="text-sm leading-relaxed text-slate-300">
                        NetJana avoids static intent scores by implementing an exponential recency-decay weighting function. An executive procurement change logged 48 hours ago carries 4x the mathematical weight of a general job posting from 25 days prior. Signal events are combined with deterministic firmographic filters (geography, industry code, headcount) and normalized against verified historical win patterns. This prevents noisy false positives from flooding the outreach queue.
                    </p>
                    <div className="pt-2 text-xs">
                        <Link href="/blog/predictive-lead-scoring-with-machine-learning-and-llms" className="text-blue-400 hover:text-blue-300 font-semibold underline flex items-center gap-1">
                            Read our technical breakdown on predictive lead scoring models <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                </section>

                {/* Comparison Table */}
                <section aria-labelledby="comparison-heading" className="space-y-6">
                    <div className="space-y-2">
                        <h2 id="comparison-heading" className="text-2xl sm:text-3xl font-bold text-white">
                            NetJana vs. Generic B2B Intent Providers
                        </h2>
                        <p className="text-sm text-slate-400">
                            How vertical-specific operational intent data compares to generalized database providers.
                        </p>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="border-b border-slate-800 bg-slate-950/80 text-xs font-semibold uppercase text-slate-400">
                                <tr>
                                    <th scope="col" className="p-4 sm:p-5">Feature</th>
                                    <th scope="col" className="p-4 sm:p-5 text-blue-400">NetJana</th>
                                    <th scope="col" className="p-4 sm:p-5">Apollo.io</th>
                                    <th scope="col" className="p-4 sm:p-5">ZoomInfo</th>
                                    <th scope="col" className="p-4 sm:p-5">Bombora</th>
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
                                                <span className="text-xs text-slate-200">{row.netjana}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 sm:p-5">
                                            <div className="flex items-start gap-2">
                                                {row.apolloCheck ? (
                                                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                                ) : (
                                                    <X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                                )}
                                                <span className="text-xs text-slate-400">{row.apollo}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 sm:p-5">
                                            <div className="flex items-start gap-2">
                                                {row.zoomCheck ? (
                                                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                                ) : (
                                                    <X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                                )}
                                                <span className="text-xs text-slate-400">{row.zoominfo}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 sm:p-5">
                                            <div className="flex items-start gap-2">
                                                {row.bomboraCheck ? (
                                                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                                ) : (
                                                    <X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                                )}
                                                <span className="text-xs text-slate-400">{row.bombora}</span>
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
                            How does NetJana differ from Apollo.io, ZoomInfo, and Bombora?
                        </p>
                        <p className="leading-relaxed">
                            While legacy vendors like ZoomInfo and Apollo.io rely primarily on static contact records, and Bombora relies on cookie-based web reading surges, NetJana indexes tangible physical and operational triggers (municipal permits, corporate facility expansions, and public procurement tenders). Furthermore, NetJana routes scored accounts directly into an approval-gated outreach pipeline rather than exporting raw, unmanaged CSV lists.
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
                            Details regarding signal indexing sources, frequency, and customization.
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
                        <div className="rounded-xl border border-blue-500/40 bg-blue-500/10 p-3.5 text-xs">
                            <span className="font-bold text-white block">Buyer Signals</span>
                            <span className="text-[11px] text-blue-300">Current Component</span>
                        </div>
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
                        Related Engineering Guides & Industry Use Cases
                    </h3>
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
                        <Link href="/use-cases/facility-management" className="text-blue-400 hover:text-blue-300 underline">
                            Facility Management Commercial Playbook
                        </Link>
                        <Link href="/use-cases/staffing" className="text-blue-400 hover:text-blue-300 underline">
                            Staffing & Executive Recruiting Playbook
                        </Link>
                        <Link href="/blog/predictive-lead-scoring-with-machine-learning-and-llms" className="text-blue-400 hover:text-blue-300 underline">
                            Predictive Lead Scoring with Machine Learning Models
                        </Link>
                    </div>
                </aside>

                {/* Transparency Disclaimer */}
                <div className="rounded-2xl bg-slate-900/40 border border-slate-800 p-5 text-xs text-slate-400 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Operational Transparency
                    </h4>
                    <p className="leading-relaxed">
                        NetJana is an intent discovery and signal scoring tool designed to prioritize prospective accounts for outbound planning. It does not promise guaranteed deals or pipeline conversions. Buyer actions are influenced by broader market factors, proposal strength, and client service delivery. Review our <Link href="/terms" className="text-blue-400 hover:underline">Terms of Service</Link> and <Link href="/privacy" className="text-blue-400 hover:underline">Privacy Policy</Link>.
                    </p>
                </div>

                {/* Footer Dual CTA */}
                <footer className="pt-4 pb-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800">
                    <div className="text-center sm:text-left">
                        <p className="text-base font-bold text-white">Capture warm enterprise demand before the RFP drops</p>
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
