import Link from "next/link";
import { ShieldCheck, CheckCircle2, ArrowLeft, ArrowRight, Lock, Activity, Users, FileCheck } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Security & Guarding Services Outbound Playbook | CraftMyFunnel",
    description: "Learn how commercial physical security, executive guarding, and surveillance providers use CraftMyFunnel to run governed, compliance-safe outbound sales campaigns.",
    openGraph: {
        title: "Security Services Outbound Sales Playbook | CraftMyFunnel",
        description: "Win enterprise guarding and commercial surveillance contracts with manager-approved AI drafts and risk-signal monitoring.",
    },
};

export default function SecurityServicesUseCasePage() {
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": "Security & Guarding Services Outbound Sales Playbook",
        "description": "How physical security and risk management firms automate compliant enterprise outreach using CraftMyFunnel.",
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
        "mainEntityOfPage": "https://craftmyfunnel.live/use-cases/security-services"
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
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Physical Security & Risk Management
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
                        Compliance-Safe Outbound for Physical & Corporate Security
                    </h1>
                    <p className="text-lg text-slate-400 leading-relaxed">
                        Security contracts demand flawless professionalism. Unchecked AI drafts or spam blasting destroys credibility with Chief Security Officers. CraftMyFunnel enforces mandatory manager approvals and risk-signal intelligence.
                    </p>
                    <div className="flex flex-wrap gap-4 pt-2">
                        <Link
                            href="/pricing"
                            className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-xl shadow-emerald-600/30 transition-all flex items-center gap-2"
                        >
                            Launch Security Playbook
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link
                            href="/contact"
                            className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition-all"
                        >
                            Schedule Consultation
                        </Link>
                    </div>
                </div>

                {/* Key Pillars */}
                <div className="space-y-8">
                    <h2 className="text-2xl font-bold text-white">
                        Built for Strict Regulatory & Enterprise Standards
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold">
                                01
                            </div>
                            <h3 className="text-base font-bold text-white">Zero Rogue Sends</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Every outbound email, proposal introduction, and follow-up is routed through a manager review queue to guarantee accurate licensing and compliance claims.
                            </p>
                        </div>

                        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                            <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-400 font-bold">
                                02
                            </div>
                            <h3 className="text-base font-bold text-white">Site Expansion Signals</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Detect new distribution hubs, corporate retail openings, and industrial construction projects that require physical guarding infrastructure.
                            </p>
                        </div>

                        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 font-bold">
                                03
                            </div>
                            <h3 className="text-base font-bold text-white">Encrypted Blind Indexing</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Sensitive prospect data, security contact emails, and facility phone numbers are stored encrypted with deterministic HMAC-SHA256 blind indexing.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Sequence Blueprint */}
                <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-6">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <FileCheck className="w-5 h-5 text-emerald-400" />
                        Enterprise Security Outreach Blueprint
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                            <div className="font-bold text-emerald-400">Day 1: Trigger Detection</div>
                            <p className="text-slate-400">New corporate warehouse or manufacturing facility permit filed.</p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                            <div className="font-bold text-emerald-400">Day 2: Operations Review</div>
                            <p className="text-slate-400">Regional Security Director verifies site risk profile and clears draft.</p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                            <div className="font-bold text-emerald-400">Day 6: Compliance Follow-up</div>
                            <p className="text-slate-400">Automated sequence sends licensing & rapid-response SLA breakdown.</p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                            <div className="font-bold text-emerald-400">Day 10: Executive Phone Call</div>
                            <p className="text-slate-400">Assigned account executive connects directly with Chief Risk Officer.</p>
                        </div>
                    </div>
                </div>

                {/* Call to Action */}
                <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-r from-emerald-950/40 via-teal-950/40 to-slate-900 border border-emerald-500/30 text-center space-y-6">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                        Run Governed Security Outbound Today
                    </h2>
                    <p className="text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
                        Join commercial security operators closing high-value physical security and guarding retainers.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                        <Link
                            href="/pricing"
                            className="px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-xl shadow-emerald-600/30 transition-all flex items-center gap-2"
                        >
                            Explore Plans
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
