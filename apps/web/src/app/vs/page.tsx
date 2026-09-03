import Link from "next/link";
import { CheckCircle2, ArrowRight, ShieldCheck, Zap, Sparkles, Scale } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Product Comparisons & Alternatives | CraftMyFunnel",
    description: "Compare CraftMyFunnel with leading outreach and sales engagement platforms like Apollo.io, Instantly, and Lemlist. Discover how governed outbound workflows protect your deliverability.",
    alternates: {
        canonical: "https://craftmyfunnel.live/vs",
    },
    openGraph: {
        title: "CraftMyFunnel vs Leading Sales Engagement Platforms",
        description: "Compare CraftMyFunnel with Apollo.io, Instantly, and Lemlist. Built for teams that require governed outbound workflows and human-in-the-loop AI review.",
    },
};

const COMPARISONS = [
    {
        slug: "apollo",
        competitor: "Apollo.io",
        title: "CraftMyFunnel vs Apollo.io",
        subtitle: "Why revenue teams looking for human-in-the-loop AI review and deliverability guardrails choose CraftMyFunnel over Apollo's contact database sequencer.",
        highlights: [
            "Mandatory human approval queue before any AI message sends",
            "Multi-model AI personalization with context guardrails",
            "Google Workspace & Gmail lease-locked deliverability engine",
            "Dedicated agency multi-tenancy & credit allocations"
        ],
        badge: "Governed Outbound vs Database Sequencer"
    },
    {
        slug: "instantly",
        competitor: "Instantly.ai",
        title: "CraftMyFunnel vs Instantly",
        subtitle: "Quality and governance over ungoverned mass volume. Protect your domain reputation with approval gates and transactional outbox reliability.",
        highlights: [
            "Interactive batch review vs ungoverned mass blaster",
            "Deterministic HMAC-SHA256 blind indexing for prospect privacy",
            "RFC 5322 Message-ID reply threading & RFC 8058 unsubscribe",
            "Customizable vertical playbooks tailored by industry"
        ],
        badge: "Approval Workflows vs Mass Blasting"
    },
    {
        slug: "lemlist",
        competitor: "Lemlist",
        title: "CraftMyFunnel vs Lemlist",
        subtitle: "Enterprise compliance, vertical playbooks, and multi-tenant security designed for modern B2B service companies and agencies.",
        highlights: [
            "Built-in vertical playbooks with proven messaging blueprints",
            "Transactional outbox pattern preventing dropped events",
            "Strict RBAC and audit logging for team compliance",
            "Credit-based predictable cost allocation per workspace"
        ],
        badge: "Compliance & Playbooks vs Generic Sequences"
    }
];

export default function ComparisonsIndexPage() {
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
                        "item": "https://craftmyfunnel.live"
                    },
                    {
                        "@type": "ListItem",
                        "position": 2,
                        "name": "Product Comparisons",
                        "item": "https://craftmyfunnel.live/vs"
                    }
                ]
            },
            {
                "@type": "CollectionPage",
                "name": "CraftMyFunnel Product Comparisons",
                "description": "Comprehensive feature comparisons between CraftMyFunnel and leading cold email and sales engagement tools.",
                "url": "https://craftmyfunnel.live/vs",
                "mainEntity": {
                    "@type": "ItemList",
                    "itemListElement": COMPARISONS.map((c, i) => ({
                        "@type": "ListItem",
                        "position": i + 1,
                        "name": c.title,
                        "url": `https://craftmyfunnel.live/vs/${c.slug}`
                    }))
                }
            }
        ]
    };

    return (
        <div className="min-h-screen bg-[#020617] text-slate-100 pt-28 pb-24 px-4 sm:px-6 lg:px-8">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            <div className="max-w-5xl mx-auto space-y-16">
                {/* Header */}
                <div className="text-center space-y-4 max-w-3xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider">
                        <Scale className="w-3.5 h-3.5" />
                        Platform Comparisons
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
                        Compare CraftMyFunnel
                    </h1>
                    <p className="text-lg text-slate-400 leading-relaxed">
                        Discover how CraftMyFunnel’s governed outbound workflows, human approval queues, and deliverability guardrails compare with other popular sales engagement tools.
                    </p>
                </div>

                {/* Comparison Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {COMPARISONS.map((comp) => (
                        <div
                            key={comp.slug}
                            className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700 transition-all hover:shadow-xl hover:shadow-blue-500/5 group"
                        >
                            <div className="space-y-4">
                                <div className="text-xs font-semibold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-md inline-block">
                                    {comp.badge}
                                </div>
                                <h2 className="text-2xl font-bold text-white group-hover:text-blue-300 transition-colors">
                                    {comp.title}
                                </h2>
                                <p className="text-sm text-slate-400 leading-relaxed">
                                    {comp.subtitle}
                                </p>
                                <div className="border-t border-slate-800 pt-4 space-y-2.5">
                                    {comp.highlights.map((h, i) => (
                                        <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                            <span>{h}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-6 mt-6 border-t border-slate-800/80">
                                <Link
                                    href={`/vs/${comp.slug}`}
                                    className="inline-flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/20 hover:border-blue-600 font-semibold text-sm transition-all"
                                >
                                    <span>Read Full Comparison</span>
                                    <ArrowRight className="w-4 h-4" />
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Bottom Trust Banner */}
                <div className="p-8 rounded-2xl bg-gradient-to-r from-blue-950/40 via-slate-900 to-indigo-950/40 border border-blue-500/20 flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="space-y-2 text-center sm:text-left">
                        <div className="flex items-center justify-center sm:justify-start gap-2 text-white font-bold text-lg">
                            <ShieldCheck className="w-5 h-5 text-blue-400" />
                            Governed Quality Over Ungoverned Volume
                        </div>
                        <p className="text-sm text-slate-400 max-w-xl">
                            Protect your domain health and close more meetings with AI-crafted outreach reviewed by real human sales professionals.
                        </p>
                    </div>
                    <Link
                        href="/pricing"
                        className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-600/25 transition-all whitespace-nowrap"
                    >
                        Explore Pricing Tiers
                    </Link>
                </div>
            </div>
        </div>
    );
}
