import Link from "next/link";
import { Check, X, ShieldCheck, Zap, ArrowRight, UserCheck, Layers, Lock } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "CraftMyFunnel vs Instantly | Governed Outreach vs Cold Email Blaster",
    description: "Compare CraftMyFunnel and Instantly.ai. Learn why revenue teams and B2B service firms switch from volume mass-sending to CraftMyFunnel's governed AI workflows with human approval gates.",
    alternates: {
        canonical: "https://craftmyfunnel.live/vs/instantly",
    },
    openGraph: {
        title: "CraftMyFunnel vs Instantly: Governed AI Outreach vs High-Volume Blaster",
        description: "Compare CraftMyFunnel with Instantly. Prioritize domain reputation, human review queues, and enterprise data security over mass spam.",
    },
};

const FEATURE_ROWS = [
    {
        feature: "Human-in-the-Loop Review Queue",
        cmf: "Mandatory interactive approval queue for every AI-personalized draft",
        instantly: "Unregulated auto-send engine without draft review checkpoints",
        cmfCheck: true,
        instantlyCheck: false,
    },
    {
        feature: "AI Personalization Depth",
        cmf: "Multi-model contextual RAG synthesizing prospect company & role data",
        instantly: "Basic spintax and short sentence generation variables",
        cmfCheck: true,
        instantlyCheck: false,
    },
    {
        feature: "Data Privacy & Search Security",
        cmf: "Deterministic HMAC-SHA256 blind indexing for encrypted prospect queries",
        instantly: "Standard unencrypted relational storage",
        cmfCheck: true,
        instantlyCheck: false,
    },
    {
        feature: "Outbox Engine Reliability",
        cmf: "Transactional Outbox pattern ensuring zero dropped sequence events",
        instantly: "Standard background job dispatcher",
        cmfCheck: true,
        instantlyCheck: true,
    },
    {
        feature: "Vertical Outbound Playbooks",
        cmf: "Built-in sector-specific sequence blueprints & messaging playbooks",
        instantly: "Community templates and basic follow-up sequences",
        cmfCheck: true,
        instantlyCheck: false,
    },
    {
        feature: "Deliverability Safeguards",
        cmf: "Automatic bounce circuit breakers, RFC 5322 Message-ID, RFC 8058 opt-out",
        instantly: "Mailbox warm-up and rotational inbox pool routing",
        cmfCheck: true,
        instantlyCheck: true,
    },
];

export default function InstantlyComparisonPage() {
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
                    },
                    {
                        "@type": "ListItem",
                        "position": 3,
                        "name": "CraftMyFunnel vs Instantly",
                        "item": "https://craftmyfunnel.live/vs/instantly"
                    }
                ]
            },
            {
                "@type": "Article",
                "headline": "CraftMyFunnel vs Instantly: Why Governed Outbound Beats Mass Blasting",
                "description": "Comparing CraftMyFunnel and Instantly.ai on AI personalization quality, human approval workflows, and deliverability protection.",
                "author": {
                    "@type": "Organization",
                    "name": "CraftMyFunnel"
                },
                "publisher": {
                    "@type": "Organization",
                    "name": "CraftMyFunnel",
                    "logo": {
                        "@type": "ImageObject",
                        "url": "https://craftmyfunnel.live/craftmyfunnel-logo.png"
                    }
                },
                "mainEntityOfPage": "https://craftmyfunnel.live/vs/instantly"
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
                {/* Header Section */}
                <div className="text-center space-y-4 max-w-3xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider">
                        Platform Comparison
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
                        CraftMyFunnel vs Instantly
                    </h1>
                    <p className="text-lg text-slate-400 leading-relaxed">
                        In an era of stringent email spam filters and AI inbox detectors, mass blasting burns domains. See how CraftMyFunnel’s governed outbound engine delivers higher response rates with lower volume.
                    </p>
                </div>

                {/* Direct Fact Triples Summary Box */}
                <div className="p-6 sm:p-8 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Zap className="w-5 h-5 text-blue-400" />
                        Executive Summary: Quality vs Volume
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-slate-300">
                        <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-500/20 space-y-2">
                            <div className="font-bold text-blue-300">Choose CraftMyFunnel if:</div>
                            <ul className="list-disc pl-5 space-y-1 text-slate-300">
                                <li>You want sales reps to review AI drafts before they reach prospective clients.</li>
                                <li>You serve high-value B2B accounts where message relevance is critical.</li>
                                <li>You require enterprise security features like deterministic blind indexing and RBAC.</li>
                            </ul>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 space-y-2">
                            <div className="font-bold text-slate-300">Choose Instantly if:</div>
                            <ul className="list-disc pl-5 space-y-1 text-slate-400">
                                <li>Your outreach model relies on rotational sending across dozens of secondary domains.</li>
                                <li>You prefer fully autonomous sending without human review checkpoints.</li>
                                <li>You do not require deep contextual RAG or vertical playbook customization.</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Comparison Table */}
                <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-white text-center sm:text-left">
                        Feature-by-Feature Breakdown
                    </h2>
                    <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-900/40">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-800 bg-slate-900/80">
                                    <th className="p-4 sm:p-5 text-sm font-bold text-slate-300">Capability</th>
                                    <th className="p-4 sm:p-5 text-sm font-bold text-blue-400 w-5/12">CraftMyFunnel</th>
                                    <th className="p-4 sm:p-5 text-sm font-bold text-slate-400 w-5/12">Instantly.ai</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/80 text-sm">
                                {FEATURE_ROWS.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="p-4 sm:p-5 font-semibold text-white">{row.feature}</td>
                                        <td className="p-4 sm:p-5 text-slate-300">
                                            <div className="flex items-start gap-2">
                                                {row.cmfCheck ? (
                                                    <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                                                ) : (
                                                    <X className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                                                )}
                                                <span>{row.cmf}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 sm:p-5 text-slate-400">
                                            <div className="flex items-start gap-2">
                                                {row.instantlyCheck ? (
                                                    <Check className="w-5 h-5 text-emerald-400/60 shrink-0 mt-0.5" />
                                                ) : (
                                                    <X className="w-5 h-5 text-red-400/60 shrink-0 mt-0.5" />
                                                )}
                                                <span>{row.instantly}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Deep Dive Pillars */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                            <UserCheck className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-white">Preventing Costly AI Hallucinations</h3>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            Sending unreviewed AI generated emails at scale frequently introduces subtle factual errors or awkward phrasing that destroys deal credibility. CraftMyFunnel’s batch review screen lets reps approve 50+ personalized emails in minutes, maintaining quality without slowing down.
                        </p>
                    </div>

                    <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                            <Lock className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-white">Enterprise Privacy & Compliance</h3>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            CraftMyFunnel uses deterministic HMAC-SHA256 blind indexing to store and search encrypted PII safely, combined with full role-based access control (RBAC) and audit trails for SOC2-conscious revenue operations teams.
                        </p>
                    </div>
                </div>

                {/* Call to Action */}
                <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-r from-blue-900/40 via-indigo-950/40 to-slate-900 border border-blue-500/30 text-center space-y-6">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                        Upgrade Your Outbound from Blasting to Governed Precision
                    </h2>
                    <p className="text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
                        Join modern B2B teams closing qualified meetings through governed AI personalization and human review.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                        <Link
                            href="/pricing"
                            className="px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-xl shadow-blue-600/30 transition-all flex items-center gap-2"
                        >
                            Explore Pricing Plans
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link
                            href="/faq"
                            className="px-6 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition-all"
                        >
                            Read Platform FAQ
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
