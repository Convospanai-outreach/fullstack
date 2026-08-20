import Link from "next/link";
import { Briefcase, CheckCircle2, ArrowLeft, ArrowRight, TrendingUp, Users, Activity, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Management Consulting & Advisory Outbound Playbook | CraftMyFunnel",
    description: "Learn how management consultants and boutique advisory firms use CraftMyFunnel to conduct executive-level outreach with zero hallucinated claims or awkward email errors.",
    openGraph: {
        title: "Management Consulting & Advisory Outbound Playbook | CraftMyFunnel",
        description: "Engage C-suite buyers with high-trust advisory proposals, partner approval workflows, and intent signals.",
    },
};

export default function ConsultingUseCasePage() {
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": "Management Consulting & Advisory Outbound Sales Playbook",
        "description": "How boutique management consultancies and strategic advisory firms scale executive pipeline with governed AI draft synthesis.",
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
        "mainEntityOfPage": "https://craftmyfunnel.live/use-cases/consulting"
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
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold uppercase tracking-wider">
                        <Briefcase className="w-3.5 h-3.5" />
                        Strategic Advisory & Consulting
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
                        Executive-Level Outbound for High-Trust Advisory Firms
                    </h1>
                    <p className="text-lg text-slate-400 leading-relaxed">
                        In strategic consulting, partner reputations are on the line with every email sent. Generic templates and unvetted AI copy get marked as spam by CEOs. CraftMyFunnel gives partners full visibility, inline editing, and deep account research before dispatch.
                    </p>
                    <div className="flex flex-wrap gap-4 pt-2">
                        <Link
                            href="/pricing"
                            className="px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-xl shadow-rose-600/30 transition-all flex items-center gap-2"
                        >
                            Launch Consulting Playbook
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link
                            href="/contact"
                            className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition-all"
                        >
                            Request Advisory Demo
                        </Link>
                    </div>
                </div>

                {/* Key Pillars */}
                <div className="space-y-8">
                    <h2 className="text-2xl font-bold text-white">
                        Built for Discerning Advisory & Professional Services
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                            <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400 font-bold">
                                01
                            </div>
                            <h3 className="text-base font-bold text-white">Partner Review Workflows</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Practice leads and managing partners review and approve account messaging from mobile or desktop before any prospect touchpoint occurs.
                            </p>
                        </div>

                        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                            <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-400 font-bold">
                                02
                            </div>
                            <h3 className="text-base font-bold text-white">Executive Transition Signals</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Monitor new CEO, CFO, and COO appointments at target enterprise accounts. Reach new executives within their first 90-day strategic review window.
                            </p>
                        </div>

                        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 font-bold">
                                03
                            </div>
                            <h3 className="text-base font-bold text-white">Seamless Team Handoffs</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Eliminate siloed inboxes. The entire practice sees the shared prospect timeline, past touchpoints, and scheduled meeting notes in one unified view.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Sequence Blueprint */}
                <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-6">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-rose-400" />
                        Executive Advisory Sequence Blueprint
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                            <div className="font-bold text-rose-400">Day 1: Executive Move</div>
                            <p className="text-slate-400">Target firm appoints new Chief Strategy Officer.</p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                            <div className="font-bold text-rose-400">Day 3: Partner-Approved Note</div>
                            <p className="text-slate-400">Partner verifies peer-to-peer congratulatory note & strategic point of view.</p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                            <div className="font-bold text-rose-400">Day 8: Proprietary Research</div>
                            <p className="text-slate-400">Sequence shares firm's benchmark industry report.</p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                            <div className="font-bold text-rose-400">Day 14: Private Briefing Invite</div>
                            <p className="text-slate-400">Partner sends invitation for a 1-on-1 strategic briefing session.</p>
                        </div>
                    </div>
                </div>

                {/* Call to Action */}
                <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-r from-rose-950/40 via-pink-950/40 to-slate-900 border border-rose-500/30 text-center space-y-6">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                        Protect Your Advisory Reputation While Scaling Pipeline
                    </h2>
                    <p className="text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
                        Experience governed outbound crafted specifically for high-trust professional advisory firms.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                        <Link
                            href="/pricing"
                            className="px-6 py-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-xl shadow-rose-600/30 transition-all flex items-center gap-2"
                        >
                            View Subscription Plans
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
