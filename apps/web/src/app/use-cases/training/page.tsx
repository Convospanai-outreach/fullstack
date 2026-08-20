import Link from "next/link";
import { GraduationCap, CheckCircle2, ArrowLeft, ArrowRight, BookOpen, Layers, Activity, Sparkles } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "L&D & Corporate Training Outbound Playbook | CraftMyFunnel",
    description: "Learn how enterprise training providers and executive coaches use CraftMyFunnel to identify technology migrations, reorgs, and engage Chief People Officers.",
    openGraph: {
        title: "Corporate Training & L&D Outbound Playbook | CraftMyFunnel",
        description: "Engage enterprise HR and L&D leaders during technology rollouts and organizational transitions with governed outbound sales.",
    },
};

export default function TrainingUseCasePage() {
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": "L&D & Corporate Training Outbound Sales Playbook",
        "description": "How corporate training providers and L&D consultants acquire enterprise learning contracts with intent signals.",
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
        "mainEntityOfPage": "https://craftmyfunnel.live/use-cases/training"
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
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold uppercase tracking-wider">
                        <GraduationCap className="w-3.5 h-3.5" />
                        Enterprise Learning & Development
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
                        Reach Enterprise HR Leaders During Tech Migrations & Reorgs
                    </h1>
                    <p className="text-lg text-slate-400 leading-relaxed">
                        Corporate training budgets unlock during key organizational moments: major software rollouts, mergers, and leadership reorganizations. CraftMyFunnel detects these signals and generates tailored curriculum proposals for Chief People Officers and VP L&Ds.
                    </p>
                    <div className="flex flex-wrap gap-4 pt-2">
                        <Link
                            href="/pricing"
                            className="px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-xl shadow-amber-600/30 transition-all flex items-center gap-2"
                        >
                            Launch L&D Playbook
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link
                            href="/contact"
                            className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition-all"
                        >
                            Schedule L&D Consultation
                        </Link>
                    </div>
                </div>

                {/* Key Pillars */}
                <div className="space-y-8">
                    <h2 className="text-2xl font-bold text-white">
                        Precision Targeting for Corporate Training Providers
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 font-bold">
                                01
                            </div>
                            <h3 className="text-base font-bold text-white">Tech Stack Change Signals</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Spot target companies rolling out new enterprise platforms (Salesforce, SAP, Workday) and require employee upskilling programs.
                            </p>
                        </div>

                        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400 font-bold">
                                02
                            </div>
                            <h3 className="text-base font-bold text-white">Curriculum Proposal Review</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                AI personalizes learning module descriptions based on the client's industry sector and executive headcount. Sales managers approve in minutes.
                            </p>
                        </div>

                        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 font-bold">
                                03
                            </div>
                            <h3 className="text-base font-bold text-white">Multi-Stakeholder Cadences</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Coordinate outreach across the VP of Human Resources, Director of Learning, and line-of-business department heads simultaneously without stepping on touches.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Sequence Blueprint */}
                <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-6">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-amber-400" />
                        Enterprise L&D Outreach Blueprint
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                            <div className="font-bold text-amber-400">Day 1: Trigger Detection</div>
                            <p className="text-slate-400">Target firm announces new AI or software adoption initiative.</p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                            <div className="font-bold text-amber-400">Day 3: Cleared Proposal</div>
                            <p className="text-slate-400">Rep clears draft offering tailored pilot workshop curriculum.</p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                            <div className="font-bold text-amber-400">Day 7: Case Study Share</div>
                            <p className="text-slate-400">Automated sequence sends client training ROI and adoption metrics.</p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                            <div className="font-bold text-amber-400">Day 11: Call Task Assigned</div>
                            <p className="text-slate-400">Sales executive contacts Chief People Officer to schedule demo.</p>
                        </div>
                    </div>
                </div>

                {/* Call to Action */}
                <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-r from-amber-950/40 via-orange-950/40 to-slate-900 border border-amber-500/30 text-center space-y-6">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                        Accelerate Corporate Training Sales
                    </h2>
                    <p className="text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
                        Start securing enterprise learning workshops and retainer engagements with governed outreach.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                        <Link
                            href="/pricing"
                            className="px-6 py-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-xl shadow-amber-600/30 transition-all flex items-center gap-2"
                        >
                            Explore Pricing Plans
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
