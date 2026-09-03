import Image from "next/image";
import Link from "next/link";
import { Users, CheckCircle2, ArrowLeft, ArrowRight, TrendingUp, Sparkles, Activity, Layers } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Staffing & Executive Recruiting Outbound Playbook | CraftMyFunnel",
    description: "Learn how staffing agencies and executive search firms use CraftMyFunnel to monitor hiring surges, auto-draft candidate capability pitches, and review outreach in batch.",
    alternates: {
        canonical: "https://craftmyfunnel.live/use-cases/staffing",
    },
    openGraph: {
        title: "Staffing & Recruiting Outbound Sales Playbook | CraftMyFunnel",
        description: "Win enterprise hiring retainers and direct-placement contracts with intent-driven recruiting sequences.",
        images: [
            {
                url: "/images/use-cases/staffing.webp",
                width: 820,
                height: 460,
                alt: "Staffing & Executive Recruiting Outbound Playbook",
            }
        ],
    },
};


export default function StaffingUseCasePage() {
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
                        "name": "Staffing & Recruiting",
                        "item": "https://craftmyfunnel.live/use-cases/staffing"
                    }
                ]
            },
            {
                "@type": "Article",
                "headline": "Staffing & Executive Recruiting Outbound Sales Playbook",
                "description": "How staffing and recruitment agencies scale client acquisition with hiring intent signals and governed candidate pitches.",
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
                "mainEntityOfPage": "https://craftmyfunnel.live/use-cases/staffing"
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
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold uppercase tracking-wider">
                        <Users className="w-3.5 h-3.5" />
                        Staffing & Talent Acquisition
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
                        Turn Target Company Hiring Surges into Placement Retainers
                    </h1>
                    <p className="text-lg text-slate-400 leading-relaxed">
                        When a target company posts 15 new engineering or sales roles, they need immediate recruitment capacity. CraftMyFunnel alerts your recruiters to open requisition waves and prepares tailored candidate capability summaries for one-click approval.
                    </p>
                    <div className="flex flex-wrap gap-4 pt-2">
                        <Link
                            href="/pricing"
                            className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-xl shadow-purple-600/30 transition-all flex items-center gap-2"
                        >
                            Launch Staffing Playbook
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link
                            href="/contact"
                            className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition-all"
                        >
                            Talk to Staffing Lead
                        </Link>
                    </div>
                </div>

                {/* Workflow Architecture Visual */}
                <div className="rounded-3xl overflow-hidden border border-slate-800 bg-slate-900/40 p-2 sm:p-4 shadow-2xl">
                    <Image
                        src="/images/use-cases/staffing.webp"
                        alt="Staffing Agency Candidate Capability Outreach and Hiring Surge Radar"
                        width={820}
                        height={460}
                        priority
                        className="w-full h-auto rounded-2xl"
                    />
                </div>

                {/* Key Pillars */}
                <div className="space-y-8">
                    <h2 className="text-2xl font-bold text-white">
                        Built for Fast-Paced Agency &amp; Search Workflows
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 font-bold">
                                01
                            </div>
                            <h3 className="text-base font-bold text-white">Hiring Wave Signals</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Automatically flag corporate accounts that have had open roles unfilled for &gt;45 days or suddenly opened 5+ positions in a key department.
                            </p>
                        </div>

                        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-bold">
                                02
                            </div>
                            <h3 className="text-base font-bold text-white">Batch Candidate Pitch Review</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                AI personalizes candidate availability summaries based on the hiring manager's exact open job descriptions. Recruiters approve in batch.
                            </p>
                        </div>

                        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 font-bold">
                                03
                            </div>
                            <h3 className="text-base font-bold text-white">Multi-Client Agency Quotas</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Isolate candidate and client databases across distinct recruiter workspaces with dedicated credit budgets and custom email tracking domains.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Sequence Blueprint */}
                <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-6">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-purple-400" />
                        Recruitment Agency Client Acquisition Blueprint
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                            <div className="font-bold text-purple-400">Day 1: Role Surge Signal</div>
                            <p className="text-slate-400">Target company posts 8 senior engineering vacancies.</p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                            <div className="font-bold text-purple-400">Day 2: Capability Pitch Cleared</div>
                            <p className="text-slate-400">Recruiter approves pitch highlighting 3 pre-vetted active candidates.</p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                            <div className="font-bold text-purple-400">Day 5: LinkedIn InMail Touch</div>
                            <p className="text-slate-400">Recruiter connects with Head of Talent Acquisition on LinkedIn.</p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                            <div className="font-bold text-purple-400">Day 9: Fee Structure Follow-up</div>
                            <p className="text-slate-400">Automated sequence delivers contingent placement terms.</p>
                        </div>
                    </div>
                </div>

                {/* Call to Action */}
                <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-r from-purple-950/40 via-indigo-950/40 to-slate-900 border border-purple-500/30 text-center space-y-6">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                        Scale Client Acquisition for Your Recruiting Agency
                    </h2>
                    <p className="text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
                        Empower your recruitment team with governed outbound sequences and real-time hiring surge alerts.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                        <Link
                            href="/pricing"
                            className="px-6 py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-xl shadow-purple-600/30 transition-all flex items-center gap-2"
                        >
                            Start 14-Day Free Pilot
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
