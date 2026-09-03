import Link from "next/link";
import { Check, X, ShieldCheck, Zap, ArrowRight, UserCheck, Mail, Database } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "CraftMyFunnel vs Apollo.io | Governed AI Outreach Alternative",
    description: "Compare CraftMyFunnel and Apollo.io. Discover why B2B revenue teams requiring human approval workflows, AI personalization guardrails, and deliverability protection choose CraftMyFunnel.",
    alternates: {
        canonical: "https://craftmyfunnel.live/vs/apollo",
    },
    openGraph: {
        title: "CraftMyFunnel vs Apollo.io: Governed AI Outreach vs Data Sequencer",
        description: "Compare CraftMyFunnel with Apollo.io. Built for teams that prioritize message quality, human-in-the-loop review, and domain sender reputation.",
    },
};

const FEATURE_ROWS = [
    {
        feature: "Human-in-the-Loop Approval Queue",
        cmf: "Native interactive batch queue before any message is sent",
        apollo: "Basic send or direct auto-pilot; lacks mandatory approval gating",
        cmfCheck: true,
        apolloCheck: false,
    },
    {
        feature: "AI Personalization Architecture",
        cmf: "Contextual multi-model RAG synthesis with prompt & content guardrails",
        apollo: "Basic field/snippet interpolation or generic AI prompts",
        cmfCheck: true,
        apolloCheck: false,
    },
    {
        feature: "Email Deliverability Safeguards",
        cmf: "RFC 5322 wire Message-ID sync, RFC 8058 headers, automatic circuit breakers",
        apollo: "Standard mailbox connection with rotational dispatch",
        cmfCheck: true,
        apolloCheck: true,
    },
    {
        feature: "Security & Multi-Tenancy Isolation",
        cmf: "Deterministic HMAC-SHA256 blind indexing & Transactional Outbox relay",
        apollo: "Standard centralized cloud multi-tenant database",
        cmfCheck: true,
        apolloCheck: false,
    },
    {
        feature: "Industry Vertical Playbooks",
        cmf: "Pre-built sequence blueprints for SaaS, IT, staffing, & consulting",
        apollo: "Generic saved search templates",
        cmfCheck: true,
        apolloCheck: false,
    },
    {
        feature: "Predictable Workspace Credit Budgeting",
        cmf: "Granular per-user credit caps and hard budget limits to stop overages",
        apollo: "Per-seat pricing with credit add-on bundles",
        cmfCheck: true,
        apolloCheck: true,
    },
];

export default function ApolloComparisonPage() {
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
                        "name": "CraftMyFunnel vs Apollo.io",
                        "item": "https://craftmyfunnel.live/vs/apollo"
                    }
                ]
            },
            {
                "@type": "Article",
                "headline": "CraftMyFunnel vs Apollo.io: In-Depth Comparison for B2B Outbound Teams",
                "description": "A comprehensive comparison between CraftMyFunnel and Apollo.io focusing on AI governance, approval workflows, and deliverability safeguards.",
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
                "mainEntityOfPage": "https://craftmyfunnel.live/vs/apollo"
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
                        CraftMyFunnel vs Apollo.io
                    </h1>
                    <p className="text-lg text-slate-400 leading-relaxed">
                        CraftMyFunnel is a governed B2B outreach platform combining intent signal ingestion, AI draft generation, and mandatory human-in-the-loop approvals. See how it compares to Apollo’s database-first sequencer.
                    </p>
                </div>

                {/* Direct Fact Triples Summary Box */}
                <div className="p-6 sm:p-8 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Zap className="w-5 h-5 text-blue-400" />
                        Executive Summary: Which Platform Is Right For You?
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-slate-300">
                        <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-500/20 space-y-2">
                            <div className="font-bold text-blue-300">Choose CraftMyFunnel if:</div>
                            <ul className="list-disc pl-5 space-y-1 text-slate-300">
                                <li>You require team members to review and approve AI-generated drafts before dispatch.</li>
                                <li>You want strict deliverability guardrails that protect domain reputation from bounce spikes.</li>
                                <li>You need industry-tailored sequence playbooks and enterprise multi-tenant isolation.</li>
                            </ul>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 space-y-2">
                            <div className="font-bold text-slate-300">Choose Apollo.io if:</div>
                            <ul className="list-disc pl-5 space-y-1 text-slate-400">
                                <li>Your primary requirement is an all-in-one contact database search.</li>
                                <li>You prioritize mass prospecting volume over granular approval oversight.</li>
                                <li>You use basic template sequences without custom AI approval gating.</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Comparison Table */}
                <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-white text-center sm:text-left">
                        Feature-by-Feature Comparison
                    </h2>
                    <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-900/40">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-800 bg-slate-900/80">
                                    <th className="p-4 sm:p-5 text-sm font-bold text-slate-300">Capability</th>
                                    <th className="p-4 sm:p-5 text-sm font-bold text-blue-400 w-5/12">CraftMyFunnel</th>
                                    <th className="p-4 sm:p-5 text-sm font-bold text-slate-400 w-5/12">Apollo.io</th>
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
                                                {row.apolloCheck ? (
                                                    <Check className="w-5 h-5 text-emerald-400/60 shrink-0 mt-0.5" />
                                                ) : (
                                                    <X className="w-5 h-5 text-red-400/60 shrink-0 mt-0.5" />
                                                )}
                                                <span>{row.apollo}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Deep Dive Key Differences */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                            <UserCheck className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-white">Governed AI vs Blind Automation</h3>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            Apollo's sequencer focuses on scheduling large volume blasts. CraftMyFunnel introduces a mandatory human-in-the-loop review workflow, enabling revenue teams to audit and fine-tune AI-personalized drafts in batches before sending, eliminating embarrassing AI hallucinations.
                        </p>
                    </div>

                    <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-white">Deliverability & Sender Reputation</h3>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            CraftMyFunnel tracks RFC 5322 wire message IDs directly from Google Workspace to ensure precise reply threading. Automated circuit breakers pause campaigns when bounce thresholds are approached, protecting your secondary domain health.
                        </p>
                    </div>
                </div>

                {/* Call to Action Banner */}
                <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-r from-blue-900/40 via-indigo-950/40 to-slate-900 border border-blue-500/30 text-center space-y-6">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                        Ready for Governed, High-Converting B2B Outreach?
                    </h2>
                    <p className="text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
                        Start managing buyer signals, AI-personalized drafts, and team approval queues with CraftMyFunnel today.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                        <Link
                            href="/pricing"
                            className="px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-xl shadow-blue-600/30 transition-all flex items-center gap-2"
                        >
                            View Plans & Pricing
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link
                            href="/faq"
                            className="px-6 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition-all"
                        >
                            Read Frequently Asked Questions
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
