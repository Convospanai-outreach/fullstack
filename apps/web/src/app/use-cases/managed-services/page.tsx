import Link from "next/link";
import { Server, CheckCircle2, ArrowLeft, ArrowRight, ShieldCheck, Zap, Activity, Cpu } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Managed IT Services & MSPs Outbound Playbook | CraftMyFunnel",
    description: "Learn how Managed Service Providers (MSPs) and IT outsourcing firms use CraftMyFunnel to target growing companies, replace incumbent vendors, and win recurring retainer contracts.",
    alternates: {
        canonical: "https://craftmyfunnel.live/use-cases/managed-services",
    },
    openGraph: {
        title: "Managed IT Services & MSP Outbound Playbook | CraftMyFunnel",
        description: "Win high-ACV recurring IT support and cybersecurity retainers with governed outreach and intent signals.",
    },
};

export default function ManagedServicesUseCasePage() {
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
                        "name": "Managed IT Services",
                        "item": "https://craftmyfunnel.live/use-cases/managed-services"
                    }
                ]
            },
            {
                "@type": "Article",
                "headline": "Managed IT Services & MSP Outbound Sales Playbook",
                "description": "How Managed Service Providers (MSPs) scale MRR and win recurring IT contracts with intent signals and governed review workflows.",
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
                "mainEntityOfPage": "https://craftmyfunnel.live/use-cases/managed-services"
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
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
                        <Server className="w-3.5 h-3.5" />
                        Managed IT Services & MSPs
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
                        Win High-ACV IT & Cybersecurity Retainers
                    </h1>
                    <p className="text-lg text-slate-400 leading-relaxed">
                        Retainer relationships start with the first impression. CTOs and CISOs delete generic cold emails on sight. CraftMyFunnel tracks IT infrastructure expansion signals, security compliance deadlines, and ensures every proposal passes manager review.
                    </p>
                    <div className="flex flex-wrap gap-4 pt-2">
                        <Link
                            href="/pricing"
                            className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 transition-all flex items-center gap-2"
                        >
                            Launch MSP Playbook
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link
                            href="/contact"
                            className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition-all"
                        >
                            Talk to MSP Specialist
                        </Link>
                    </div>
                </div>

                {/* Key Pillars */}
                <div className="space-y-8">
                    <h2 className="text-2xl font-bold text-white">
                        Built for Managed Service Providers
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-bold">
                                01
                            </div>
                            <h3 className="text-base font-bold text-white">IT Scaling Signals</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Identify companies crossing key headcount milestones (e.g. 50-250 employees) where internal IT becomes overwhelmed and outsourced MSP support is needed.
                            </p>
                        </div>

                        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold">
                                02
                            </div>
                            <h3 className="text-base font-bold text-white">Technical SLA Proposal Review</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                AI personalizes technical capabilities and SLA response guarantees based on the target account's tech stack. Sales reps approve in one click.
                            </p>
                        </div>

                        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 font-bold">
                                03
                            </div>
                            <h3 className="text-base font-bold text-white">Enterprise Deliverability Guardrails</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Protect primary MSP domains with multi-mailbox rotation, automatic bounce circuit breakers, and RFC 5322 wire message ID threading.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Sequence Blueprint */}
                <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-6">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Cpu className="w-5 h-5 text-indigo-400" />
                        MSP Client Acquisition Blueprint
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                            <div className="font-bold text-indigo-400">Day 1: Trigger Event</div>
                            <p className="text-slate-400">Target firm expands to 100+ headcount without internal IT hire.</p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                            <div className="font-bold text-indigo-400">Day 3: IT Audit Offer</div>
                            <p className="text-slate-400">Rep approves proposal offering complimentary infrastructure vulnerability audit.</p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                            <div className="font-bold text-indigo-400">Day 7: Security Case Study</div>
                            <p className="text-slate-400">Automated sequence shares SOC2 compliance & backup recovery metrics.</p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                            <div className="font-bold text-indigo-400">Day 12: Discovery Call</div>
                            <p className="text-slate-400">Assigned account manager connects directly with VP Operations.</p>
                        </div>
                    </div>
                </div>

                {/* Call to Action */}
                <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-r from-indigo-950/40 via-blue-950/40 to-slate-900 border border-indigo-500/30 text-center space-y-6">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                        Grow Your MSP's Monthly Recurring Revenue
                    </h2>
                    <p className="text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
                        Start securing long-term IT retainers and managed support agreements with governed outbound.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                        <Link
                            href="/pricing"
                            className="px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 transition-all flex items-center gap-2"
                        >
                            Get Started
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
