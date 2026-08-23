import Link from "next/link";
import { Building2, CheckCircle2, ArrowLeft, ArrowRight, ShieldCheck, Zap, Activity, Users } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Facility Management & Commercial Property Outreach | CraftMyFunnel",
    description: "Learn how commercial facility management and cleaning firms use CraftMyFunnel to track office expansions, construction permits, and engage property managers before RFPs go live.",
    openGraph: {
        title: "Facility Management Outbound Sales Playbook | CraftMyFunnel",
        description: "Win high-margin commercial cleaning and facility maintenance contracts with governed outreach and intent signals.",
    },
};

export default function FacilityManagementUseCasePage() {
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
                        "name": "Use Cases",
                        "item": "https://craftmyfunnel.live/use-cases"
                    },
                    {
                        "@type": "ListItem",
                        "position": 3,
                        "name": "Facility Management",
                        "item": "https://craftmyfunnel.live/use-cases/facility-management"
                    }
                ]
            },
            {
                "@type": "Article",
                "headline": "Facility Management & Commercial Property Outbound Playbook",
                "description": "How facility management and commercial property service providers automate outbound sales using intent signals and governed approval queues.",
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
                "mainEntityOfPage": "https://craftmyfunnel.live/use-cases/facility-management"
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
                {/* Back Link */}
                <Link
                    href="/use-cases"
                    className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to All Use Cases
                </Link>

                {/* Hero Header */}
                <div className="space-y-6 max-w-3xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider">
                        <Building2 className="w-3.5 h-3.5" />
                        Commercial Real Estate & FM
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
                        Win Commercial Property Contracts Before the RFP Lands
                    </h1>
                    <p className="text-lg text-slate-400 leading-relaxed">
                        Facility management deals are won months before formal tenders are published. CraftMyFunnel captures buyer signals—office relocations, lease renewals, and headcount expansions—enabling your team to initiate relationship-building conversations early.
                    </p>
                    <div className="flex flex-wrap gap-4 pt-2">
                        <Link
                            href="/pricing"
                            className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-xl shadow-blue-600/30 transition-all flex items-center gap-2"
                        >
                            Launch Facility Playbook
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link
                            href="/contact"
                            className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition-all"
                        >
                            Request FM Demo
                        </Link>
                    </div>
                </div>

                {/* Core Challenges & Solutions */}
                <div className="space-y-8">
                    <h2 className="text-2xl font-bold text-white">
                        The Facility Management Outbound Engine
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 font-bold">
                                01
                            </div>
                            <h3 className="text-base font-bold text-white">Expansion & Lease Signals</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                CraftMyFunnel's buyer signal engine monitors commercial real estate lease expirations, corporate moves, and corporate facility expansions to pinpoint high-intent accounts.
                            </p>
                        </div>

                        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold">
                                02
                            </div>
                            <h3 className="text-base font-bold text-white">Property Manager Approval Queue</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Property Directors receive dozens of spam emails daily. CraftMyFunnel generates tailored proposals that your account executives review and tweak in seconds.
                            </p>
                        </div>

                        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 font-bold">
                                03
                            </div>
                            <h3 className="text-base font-bold text-white">Multi-Touch Cadence Tracking</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Combine email touchpoints with phone call tasks and LinkedIn profile interactions on a unified activity timeline to keep multi-stakeholder deals moving.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Pre-Engineered Sequence Structure */}
                <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-6">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-400" />
                        Facility Management Sequence Blueprint
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                            <div className="font-bold text-blue-400">Day 1: Signal Ingestion</div>
                            <p className="text-slate-400">Identify new office lease signing & draft contextual greeting.</p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                            <div className="font-bold text-blue-400">Day 3: Human Approved Send</div>
                            <p className="text-slate-400">Rep clears draft highlighting vendor transition support.</p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                            <div className="font-bold text-blue-400">Day 7: LinkedIn Soft Touch</div>
                            <p className="text-slate-400">View VP Facilities profile and share relevant commercial case study.</p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                            <div className="font-bold text-blue-400">Day 12: Phone Call Follow-Up</div>
                            <p className="text-slate-400">Caller task assigned with pre-compiled building specs.</p>
                        </div>
                    </div>
                </div>

                {/* Call to Action */}
                <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-r from-blue-900/40 via-cyan-950/40 to-slate-900 border border-blue-500/30 text-center space-y-6">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                        Scale Your Commercial Facilities Pipeline
                    </h2>
                    <p className="text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
                        Start turning commercial intent signals into high-margin recurring maintenance contracts.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                        <Link
                            href="/pricing"
                            className="px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-xl shadow-blue-600/30 transition-all flex items-center gap-2"
                        >
                            Get Started Free
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
