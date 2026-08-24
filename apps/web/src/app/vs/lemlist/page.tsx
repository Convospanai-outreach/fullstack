import Link from "next/link";
import { Check, X, ShieldCheck, Zap, ArrowRight, BookOpen, Layers, Users } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "CraftMyFunnel vs Lemlist | Governed AI Outbound vs Generic Sequencer",
    description: "Compare CraftMyFunnel and Lemlist. Discover why B2B agencies and revenue teams choose CraftMyFunnel for vertical playbooks, human approval review, and multi-tenant security.",
    openGraph: {
        title: "CraftMyFunnel vs Lemlist: Governed Outbound & Vertical Playbooks",
        description: "Compare CraftMyFunnel with Lemlist. Designed for teams requiring industry-specific sequence playbooks, approval queues, and enterprise data governance.",
    },
};

const FEATURE_ROWS = [
    {
        feature: "Vertical Outbound Playbooks",
        cmf: "Engineered sector-specific blueprints for SaaS, IT, staffing, & agencies",
        lemlist: "Generic cold email templates requiring manual customization",
        cmfCheck: true,
        lemlistCheck: false,
    },
    {
        feature: "Human Review & Approval Gate",
        cmf: "Dedicated batch review queue for reps to verify every AI draft before dispatch",
        lemlist: "Automated sequence dispatch without native approval queue checkpoints",
        cmfCheck: true,
        lemlistCheck: false,
    },
    {
        feature: "Multi-Tenant Agency Isolation",
        cmf: "Granular workspace roles, per-user credit quotas, & whitelabel branding",
        lemlist: "Workspace switching with shared organizational settings",
        cmfCheck: true,
        lemlistCheck: true,
    },
    {
        feature: "Data Privacy & Search Security",
        cmf: "Deterministic HMAC-SHA256 blind indexing for encrypted prospect records",
        lemlist: "Standard cloud database storage",
        cmfCheck: true,
        lemlistCheck: false,
    },
    {
        feature: "Event Relay Reliability",
        cmf: "Transactional Outbox pattern ensuring zero dropped sequence events",
        lemlist: "Standard message queue dispatch",
        cmfCheck: true,
        lemlistCheck: true,
    },
    {
        feature: "Deliverability Safeguards",
        cmf: "RFC 5322 Message-ID wire sync, RFC 8058 unsubscribe, automatic bounce breakers",
        lemlist: "Custom tracking domains, inbox warm-up (Lemwarm), rotational sending",
        cmfCheck: true,
        lemlistCheck: true,
    },
];

export default function LemlistComparisonPage() {
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
                        "name": "CraftMyFunnel vs Lemlist",
                        "item": "https://craftmyfunnel.live/vs/lemlist"
                    }
                ]
            },
            {
                "@type": "Article",
                "headline": "CraftMyFunnel vs Lemlist: The Modern Comparison for B2B Outbound Teams",
                "description": "Comparing CraftMyFunnel and Lemlist on vertical playbooks, AI approval workflows, and multi-tenant enterprise features.",
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
                "mainEntityOfPage": "https://craftmyfunnel.live/vs/lemlist"
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
                        CraftMyFunnel vs Lemlist
                    </h1>
                    <p className="text-lg text-slate-400 leading-relaxed">
                        Explore how CraftMyFunnel combines vertical playbooks, multi-model AI personalization, and a human-in-the-loop review queue to deliver governed outreach for B2B service teams.
                    </p>
                </div>

                {/* Direct Fact Triples Summary Box */}
                <div className="p-6 sm:p-8 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Zap className="w-5 h-5 text-blue-400" />
                        Executive Summary: Which Fits Your Growth Strategy?
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-slate-300">
                        <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-500/20 space-y-2">
                            <div className="font-bold text-blue-300">Choose CraftMyFunnel if:</div>
                            <ul className="list-disc pl-5 space-y-1 text-slate-300">
                                <li>You want pre-engineered vertical playbooks tailored to your specific industry niche.</li>
                                <li>You require team approval checkpoints before outbound emails leave mailboxes.</li>
                                <li>You need transparent credit budgeting and enterprise multi-tenant security.</li>
                            </ul>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 space-y-2">
                            <div className="font-bold text-slate-300">Choose Lemlist if:</div>
                            <ul className="list-disc pl-5 space-y-1 text-slate-400">
                                <li>Your outreach heavily utilizes image and video personalization snippets.</li>
                                <li>You require standalone email warm-up networks (Lemwarm).</li>
                                <li>You prefer generic multi-step cadences without strict approval gating.</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Comparison Table */}
                <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-white text-center sm:text-left">
                        Comprehensive Capability Comparison
                    </h2>
                    <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-900/40">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-800 bg-slate-900/80">
                                    <th className="p-4 sm:p-5 text-sm font-bold text-slate-300">Capability</th>
                                    <th className="p-4 sm:p-5 text-sm font-bold text-blue-400 w-5/12">CraftMyFunnel</th>
                                    <th className="p-4 sm:p-5 text-sm font-bold text-slate-400 w-5/12">Lemlist</th>
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
                                                {row.lemlistCheck ? (
                                                    <Check className="w-5 h-5 text-emerald-400/60 shrink-0 mt-0.5" />
                                                ) : (
                                                    <X className="w-5 h-5 text-red-400/60 shrink-0 mt-0.5" />
                                                )}
                                                <span>{row.lemlist}</span>
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
                            <BookOpen className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-white">Pre-Engineered Vertical Playbooks</h3>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            CraftMyFunnel comes loaded with industry-specific outbound playbooks. Instead of starting with blank templates, marketing agencies, IT consultants, and SaaS companies launch campaigns with pre-calibrated messaging frameworks and cadence structures proven in their sector.
                        </p>
                    </div>

                    <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                            <Users className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-white">Agency Multi-Tenancy & Quotas</h3>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            Agencies managing multiple client accounts benefit from isolated workspaces, custom portal branding, per-user credit quotas, and strict multi-tenant isolation powered by blind indexing and transactional outbox event relaying.
                        </p>
                    </div>
                </div>

                {/* Call to Action */}
                <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-r from-blue-900/40 via-indigo-950/40 to-slate-900 border border-blue-500/30 text-center space-y-6">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                        Launch Governed Outbound with Vertical Playbooks
                    </h2>
                    <p className="text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
                        Empower your team with AI-generated drafts, human review queues, and enterprise deliverability protection.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                        <Link
                            href="/pricing"
                            className="px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-xl shadow-blue-600/30 transition-all flex items-center gap-2"
                        >
                            View Subscription Plans
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link
                            href="/faq"
                            className="px-6 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition-all"
                        >
                            Browse FAQ Knowledge Base
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
