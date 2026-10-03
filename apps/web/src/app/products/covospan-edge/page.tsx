import Link from "next/link";
import { ArrowRight, Check, X, CheckCircle2, Sparkles, HardDrive, Cpu, ShieldCheck, Lock, Server, Terminal, KeyRound } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Covospan EDGE — Sovereign Edge AI Node for Outreach | CraftMyFunnel",
    description: "Covospan EDGE is an optional Raspberry Pi 5 edge node that runs AI checks, PII tokenisation, and audit logs close to your data — not in a shared cloud. For security, facility, and staffing teams.",
    alternates: {
        canonical: "https://craftmyfunnel.live/products/covospan-edge",
    },
    openGraph: {
        title: "Covospan EDGE — Sovereign Edge AI Node for Outreach | CraftMyFunnel",
        description: "Your client data stays where it belongs. With you. On-premise PII tokenisation, local critic models, and sovereign audit logging.",
        url: "https://craftmyfunnel.live/products/covospan-edge",
        images: [
            {
                url: "/images/og-branded.png",
                width: 1200,
                height: 630,
                alt: "Covospan EDGE Sovereign Hardware Node",
            },
        ],
    },
};

const EDGE_TIERS = [
    {
        tier: "Tier 1",
        title: "Edge Hardware",
        lead: "Raspberry Pi 5 edge node with secure boot, encrypted local storage, and full firmware control.",
        details: "Ships directly to your location. Sits in your server rack, branch office, or local data closet on your private network. You retain physical custody of the hardware, cryptographic keys, and raw storage volumes.",
    },
    {
        tier: "Tier 2",
        title: "On-Device AI Engine",
        lead: "Deterministic PII tokenisation, local micro-LLM intent checks, and adversarial critic engine run close to the data.",
        details: "Client names, contract values, proprietary site codes, and sensitive employee contacts are replaced with HMAC-SHA256 blind tokens before any data leaves your perimeter. The public cloud never observes readable PII.",
    },
    {
        tier: "Tier 3",
        title: "Governed Hybrid Workflow",
        lead: "Seamless coordination between on-device security enforcement and cloud AI generation.",
        details: "Heavy LLM synthesis operating on sanitized tokens routes to external models, while sensitive corporate context remains strictly resident on-device. An immutable on-device audit ledger logs every cryptographic transformation.",
    },
];

const WHAT_RUNS_WHERE = [
    {
        task: "PII Tokenisation & De-identification",
        location: "EDGE Node (Local)",
        rationale: "Client names, contact details, and site locations never cross into external networks unmasked",
    },
    {
        task: "Adversarial Policy & Critic Checks",
        location: "EDGE Node (Local)",
        rationale: "Pre-flight compliance rules evaluate prompts on-premise prior to cloud routing",
    },
    {
        task: "Tamper-Evident Audit Logging",
        location: "EDGE Node (Local)",
        rationale: "Cryptographically signed dispatch records remain permanently in your custody",
    },
    {
        task: "High-Parameter Draft Generation",
        location: "Cloud (Opt-In / Sanitized)",
        rationale: "High-parameter frontier models process only de-identified, tokenized prompt structures",
    },
    {
        task: "Generic Industry Template Retrieval",
        location: "Cloud",
        rationale: "Standardized service sequence patterns contain no proprietary tenant information",
    },
    {
        task: "Mailbox Delivery & Bounce Processing",
        location: "Cloud",
        rationale: "Transactional mail relays monitor delivery headers without reading private message payload content",
    },
];

const HARDWARE_SPECS = [
    { label: "Compute Platform", value: "Raspberry Pi 5 (8GB LPDDR4X)" },
    { label: "Storage Security", value: "AES-256 XTS Encrypted NVMe SSD" },
    { label: "Hardware Root of Trust", value: "Cryptographic secure boot & verified firmware" },
    { label: "Deployment Footprint", value: "Compact on-premise desktop or 1U rack-mount" },
];

const COMPARISON_ROWS = [
    {
        feature: "On-premise physical hardware AI execution",
        edge: "Physical Raspberry Pi 5 node running in your office or private rack",
        cloud: "Shared multi-tenant cloud servers only",
        apollo: "Centralized cloud database only",
        selfhosted: "Manual Docker deployment on user-managed servers",
        edgeCheck: true,
        cloudCheck: false,
        apolloCheck: false,
        shCheck: true,
    },
    {
        feature: "Deterministic PII tokenisation before cloud handoff",
        edge: "HMAC-SHA256 blind indexing runs locally on hardware",
        cloud: "Transmits plain text directly to third-party LLMs",
        apollo: "Centralized cloud processing",
        selfhosted: "Requires custom development and maintenance",
        edgeCheck: true,
        cloudCheck: false,
        apolloCheck: false,
        shCheck: false,
    },
    {
        feature: "Tamper-evident local audit ledger",
        edge: "Signed transaction log stored on encrypted local disk",
        cloud: "Ephemeral cloud logs subject to provider retention rules",
        apollo: "Standard activity log on cloud database",
        selfhosted: "Configurable, but requires external syslog setup",
        edgeCheck: true,
        cloudCheck: false,
        apolloCheck: false,
        shCheck: false,
    },
    {
        feature: "Turnkey enterprise managed hardware & updates",
        edge: "Pre-configured plug-and-play device with signed OTA firmware",
        cloud: "SaaS updates only; zero hardware ownership",
        apollo: "SaaS platform only",
        selfhosted: "High ongoing sysadmin overhead and patch management",
        edgeCheck: true,
        cloudCheck: false,
        apolloCheck: false,
        shCheck: false,
    },
    {
        feature: "Native integration with outreach approval queue",
        edge: "Direct governed pipeline with CMF Core review gates",
        cloud: "Isolated sending tools",
        apollo: "Integrated sequencer without local tokenisation",
        selfhosted: "Requires complex webhook integration",
        edgeCheck: true,
        cloudCheck: false,
        apolloCheck: false,
        shCheck: false,
    },
];

const KEY_FACTS = [
    {
        q: "What is Covospan EDGE?",
        a: "Covospan EDGE is an optional sovereign on-premise AI node based on a Raspberry Pi 5. It performs local PII tokenisation, intent verification, and audit logging on hardware you physically own.",
    },
    {
        q: "Is Covospan EDGE mandatory to use CraftMyFunnel?",
        a: "No. Covospan EDGE is an optional enterprise hardware extension. CraftMyFunnel runs entirely in the cloud with standard tenant isolation for teams without sovereign on-premise mandates.",
    },
    {
        q: "What occurs if the edge hardware experiences an internet disconnection?",
        a: "The device buffers tokenisation logs and queued local audit entries in encrypted storage. Outbound cloud dispatches pause safely until network connectivity is verified.",
    },
    {
        q: "Can the node operate in an air-gapped network configuration?",
        a: "Yes. For high-security defense, facility, or government suppliers, the edge node can perform local PII masking and local draft generation completely disconnected from the public internet.",
    },
];

const FAQS = [
    {
        q: "Who manages and updates the physical hardware?",
        a: "Devices arrive pre-configured with signed firmware images. Routine updates deploy via cryptographically verified over-the-air (OTA) patches that your internal IT team can review and approve.",
    },
    {
        q: "Which subscription tiers include Covospan EDGE?",
        a: "Covospan EDGE is available as an enterprise hardware package with custom deployment support, dedicated SLAs, and hardware warranty.",
    },
    {
        q: "How does local PII tokenisation protect prospect privacy?",
        a: "Before prompt structures route to cloud LLMs, company names, contact emails, and personal identifiers are substituted with cryptographic surrogate tokens. The external AI model synthesizes grammar and flow without learning real prospect identities.",
    },
    {
        q: "What physical connections are required to run the device?",
        a: "The Raspberry Pi 5 node requires a standard 100–240V power adapter and an Ethernet network connection to your local corporate LAN or DMZ.",
    },
    {
        q: "Are the audit logs exportable for compliance audits (SOC 2, ISO 27001)?",
        a: "Yes. Audit logs can be streamed into your internal SIEM (Splunk, Datadog) or exported as signed JSON/CSV bundles for external security review.",
    },
];

export default function CovospanEdgePage() {
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
                        "name": "Covospan EDGE",
                        "item": "https://craftmyfunnel.live/products/covospan-edge",
                    },
                ],
            },
            {
                "@type": "SoftwareApplication",
                "name": "Covospan EDGE Sovereign Node",
                "applicationCategory": "SecurityApplication",
                "operatingSystem": "Linux (Embedded Appliance)",
                "description": "Optional Raspberry Pi 5 sovereign edge node providing on-premise PII tokenisation, cryptographic blind indexing, and local audit logging for confidential B2B sales teams.",
                "url": "https://craftmyfunnel.live/products/covospan-edge",
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
                    "On-premise physical edge AI hardware (Raspberry Pi 5)",
                    "HMAC-SHA256 deterministic PII tokenisation",
                    "Tamper-evident encrypted audit logging",
                    "Air-gapped and hybrid deployment modes",
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
                        <span className="text-slate-200">Covospan EDGE</span>
                    </nav>

                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider">
                        <HardDrive className="w-3.5 h-3.5" />
                        Sovereign Edge Node
                    </div>

                    <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
                        Your Client Data Stays Where It Belongs. With You.
                    </h1>

                    <p className="text-lg sm:text-xl text-slate-300 max-w-3xl leading-relaxed">
                        Covospan EDGE is an optional sovereign node for teams that cannot put confidential client names, contract values, or security briefings through a shared cloud AI. The processing runs on hardware you own, in a location you control.
                    </p>

                    {/* Dual CTA */}
                    <div className="flex flex-wrap items-center gap-4 pt-2">
                        <Link
                            href="/pricing"
                            className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-xl shadow-blue-600/30 transition-all flex items-center gap-2"
                        >
                            View Enterprise Tiers <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link
                            href="/contact"
                            className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition-all"
                        >
                            Contact Engineering
                        </Link>
                    </div>

                    {/* Trust Badges */}
                    <div className="flex flex-wrap gap-3 pt-2 text-xs text-slate-300">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                            Hardware Root of Trust
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                            HMAC-SHA256 Tokenisation
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                            Zero Plaintext PII to Cloud
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
                        Why We Engineered Dedicated On-Premise Hardware
                    </h2>
                    <p className="text-sm leading-relaxed text-slate-300">
                        Covospan EDGE exists because an enterprise security services pilot refused to feed confidential client site blueprints, guard shift rosters, and executive names into a shared commercial cloud LLM. They were entirely justified. Commercial AI privacy policies frequently contain ambiguity regarding telemetry logs and data retention. Rather than asking customers to compromise on core compliance obligations, we designed a dedicated Raspberry Pi 5 edge appliance that runs cryptographic blind indexing and intent filtering inside your physical custody.
                    </p>
                </section>

                {/* 3-Tier Architecture */}
                <section aria-labelledby="tiers-heading" className="space-y-6">
                    <div className="space-y-2">
                        <h2 id="tiers-heading" className="text-2xl sm:text-3xl font-bold text-white">
                            The 3-Tier Sovereign Architecture
                        </h2>
                        <p className="text-sm text-slate-400">
                            Layered security separating physical hardware custody, local AI filtering, and hybrid cloud compute.
                        </p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-3">
                        {EDGE_TIERS.map((tier) => (
                            <div key={tier.title} className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-3">
                                <span className="text-xs font-black uppercase tracking-widest text-blue-400">
                                    {tier.tier}
                                </span>
                                <h3 className="text-base font-bold text-white">
                                    {tier.title}
                                </h3>
                                <p className="text-xs font-medium text-slate-200">
                                    {tier.lead}
                                </p>
                                <p className="text-xs leading-relaxed text-slate-400 pt-1 border-t border-slate-800/80">
                                    {tier.details}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* What Runs Where Table */}
                <section aria-labelledby="what-runs-where-heading" className="space-y-6">
                    <div className="space-y-2">
                        <h2 id="what-runs-where-heading" className="text-2xl sm:text-3xl font-bold text-white">
                            What Runs Where: Deterministic Processing Boundaries
                        </h2>
                        <p className="text-sm text-slate-400">
                            Exact operational separation between physical on-device hardware and cloud generation.
                        </p>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="border-b border-slate-800 bg-slate-950/80 text-xs font-semibold uppercase text-slate-400">
                                <tr>
                                    <th scope="col" className="p-4 sm:p-5">Processing Task</th>
                                    <th scope="col" className="p-4 sm:p-5">Execution Environment</th>
                                    <th scope="col" className="p-4 sm:p-5">Compliance Rationale</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/80">
                                {WHAT_RUNS_WHERE.map((row) => (
                                    <tr key={row.task} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="p-4 sm:p-5 font-semibold text-white">
                                            {row.task}
                                        </td>
                                        <td className="p-4 sm:p-5">
                                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${
                                                row.location.includes("Local")
                                                    ? "bg-blue-500/10 border border-blue-500/30 text-blue-400"
                                                    : "bg-slate-800 border border-slate-700 text-slate-300"
                                            }`}>
                                                {row.location}
                                            </span>
                                        </td>
                                        <td className="p-4 sm:p-5 text-xs text-slate-300">
                                            {row.rationale}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Hardware Spec Strip */}
                <section aria-labelledby="specs-heading" className="space-y-4">
                    <h2 id="specs-heading" className="text-xl font-bold text-white">
                        Appliance Hardware Specifications
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {HARDWARE_SPECS.map((spec) => (
                            <div key={spec.label} className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 space-y-1">
                                <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">{spec.label}</p>
                                <p className="text-sm font-bold text-white">{spec.value}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Technical Depth Section (E-E-A-T) */}
                <section aria-labelledby="technical-depth-heading" className="rounded-2xl bg-slate-900/50 border border-slate-800 p-6 sm:p-8 space-y-4">
                    <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider">
                        <Lock className="w-4 h-4" />
                        Cryptographic Verification
                    </div>
                    <h2 id="technical-depth-heading" className="text-xl sm:text-2xl font-bold text-white">
                        HMAC-SHA256 Blind Indexing & Tokenisation Before Cloud Handoff
                    </h2>
                    <p className="text-sm leading-relaxed text-slate-300">
                        When an outreach draft requires external cloud synthesis, the edge appliance generates a deterministic keyed HMAC-SHA256 blind index for every prospect entity (name, email domain, telephone, physical location). The secret HMAC salt never leaves the physical appliance. Cloud models receive anonymized surrogate tokens (e.g., &ldquo;Enterprise_A&rdquo; and &ldquo;DecisionMaker_B&rdquo;). Once the cloud model generates the draft structure, the local appliance re-hydrates the original identifiers before placing the draft into your manager&apos;s approval queue.
                    </p>
                    <div className="pt-2 text-xs flex flex-wrap gap-4">
                        <Link href="/security" className="text-blue-400 hover:text-blue-300 font-semibold underline flex items-center gap-1">
                            Review our Security Architecture <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                        <Link href="/data-deletion" className="text-blue-400 hover:text-blue-300 font-semibold underline flex items-center gap-1">
                            Data Deletion & Retention Specification <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                </section>

                {/* Comparison Table */}
                <section aria-labelledby="comparison-heading" className="space-y-6">
                    <div className="space-y-2">
                        <h2 id="comparison-heading" className="text-2xl sm:text-3xl font-bold text-white">
                            Covospan EDGE vs. Cloud Outbound Platforms
                        </h2>
                        <p className="text-sm text-slate-400">
                            Comparing data sovereignty, physical custody, and compliance readiness.
                        </p>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="border-b border-slate-800 bg-slate-950/80 text-xs font-semibold uppercase text-slate-400">
                                <tr>
                                    <th scope="col" className="p-4 sm:p-5">Capability</th>
                                    <th scope="col" className="p-4 sm:p-5 text-blue-400">Covospan EDGE</th>
                                    <th scope="col" className="p-4 sm:p-5">Cloud-Only (Instantly/Lemlist)</th>
                                    <th scope="col" className="p-4 sm:p-5">Apollo.io</th>
                                    <th scope="col" className="p-4 sm:p-5">Self-Hosted Open Source</th>
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
                                                <span className="text-xs text-slate-200">{row.edge}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 sm:p-5">
                                            <div className="flex items-start gap-2">
                                                {row.cloudCheck ? (
                                                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                                ) : (
                                                    <X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                                )}
                                                <span className="text-xs text-slate-400">{row.cloud}</span>
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
                                                {row.shCheck ? (
                                                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                                ) : (
                                                    <X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                                )}
                                                <span className="text-xs text-slate-400">{row.selfhosted}</span>
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
                            How does Covospan EDGE differ from cloud-only outreach tools and Apollo.io?
                        </p>
                        <p className="leading-relaxed">
                            Unlike traditional cloud platforms that send plaintext prospect PII to multi-tenant cloud models, Covospan EDGE executes on a dedicated Raspberry Pi 5 node inside your physical custody. Sensitive prospect records undergo HMAC-SHA256 blind tokenisation locally before cloud routing, keeping private client data completely within your control.
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
                            Hardware logistics, physical requirements, and compliance readiness.
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
                            <span className="font-bold text-white block">Covospan EDGE</span>
                            <span className="text-[11px] text-blue-300">Current Component</span>
                        </div>
                    </div>
                </section>

                {/* Related Reading (E-E-A-T Authority) */}
                <aside aria-label="Related Documentation and Articles" className="rounded-2xl bg-slate-900/30 border border-slate-800/80 p-5 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Related Engineering Documentation & Security Hub
                    </h3>
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
                        <Link href="/security" className="text-blue-400 hover:text-blue-300 underline">
                            Enterprise Security & Blind Indexing Architecture
                        </Link>
                        <Link href="/data-deletion" className="text-blue-400 hover:text-blue-300 underline">
                            Data Deletion & Cryptographic Key Destruction
                        </Link>
                        <Link href="/blog/how-to-build-a-sovereign-ai-pipeline-for-enterprise-outbound-sales" className="text-blue-400 hover:text-blue-300 underline">
                            Building Sovereign AI Pipelines for Enterprise Outbound
                        </Link>
                        <Link href="/docs/security-architecture" className="text-blue-400 hover:text-blue-300 underline">
                            Security Architecture Technical Documentation
                        </Link>
                    </div>
                </aside>

                {/* Transparency Disclaimer */}
                <div className="rounded-2xl bg-slate-900/40 border border-slate-800 p-5 text-xs text-slate-400 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Operational Transparency
                    </h4>
                    <p className="leading-relaxed">
                        Covospan EDGE provides on-premise cryptographic tokenisation and security logging. It does not replace internal data protection officers or eliminate overall information security responsibilities. Outcome metrics depend on proper physical appliance maintenance, network security, and prompt hygiene. Review our <Link href="/terms" className="text-blue-400 hover:underline">Terms of Service</Link> and <Link href="/privacy" className="text-blue-400 hover:underline">Privacy Policy</Link>.
                    </p>
                </div>

                {/* Footer Dual CTA */}
                <footer className="pt-4 pb-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800">
                    <div className="text-center sm:text-left">
                        <p className="text-base font-bold text-white">Protect your client contracts with sovereign on-premise AI</p>
                        <p className="text-xs text-slate-400">Speak with our enterprise infrastructure team.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link
                            href="/pricing"
                            className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-xl shadow-blue-600/30 transition-all flex items-center gap-2"
                        >
                            View Enterprise Tiers <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link
                            href="/contact"
                            className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition-all"
                        >
                            Contact Engineering
                        </Link>
                    </div>
                </footer>
            </article>
        </main>
    );
}
