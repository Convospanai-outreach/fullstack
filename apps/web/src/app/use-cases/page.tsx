import Link from "next/link";
import { Building2, ShieldCheck, Users, GraduationCap, Briefcase, Server, ArrowRight, Sparkles, CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "B2B Outbound Use Cases & Vertical Playbooks | CraftMyFunnel",
    description: "Discover how revenue teams in facility management, security services, staffing, L&D, consulting, and IT MSPs use CraftMyFunnel's governed outbound workflows.",
    openGraph: {
        title: "CraftMyFunnel Use Cases & Industry Outbound Playbooks",
        description: "Vertical-specific outbound sequences, buyer signal tracking, and human-in-the-loop approval workflows for B2B service firms.",
    },
};

const USE_CASES = [
    {
        slug: "facility-management",
        title: "Facility Management & Commercial Property",
        tagline: "Engage commercial property owners before RFPs go live",
        icon: Building2,
        badge: "Commercial Real Estate",
        color: "from-blue-500/20 to-cyan-500/20",
        borderColor: "border-blue-500/30",
        iconColor: "text-blue-400",
        description: "Track office expansions, construction permits, and facility lease renewals. Trigger review-ready outreach to Property Directors with pre-calibrated FM playbooks.",
        stats: ["4.2x Faster RFP discovery", "Zero unapproved messaging", "100% tenant data isolation"]
    },
    {
        slug: "security-services",
        title: "Security & Guarding Services",
        tagline: "High-compliance outbound for physical & corporate security",
        icon: ShieldCheck,
        badge: "Security & Risk",
        color: "from-emerald-500/20 to-teal-500/20",
        borderColor: "border-emerald-500/30",
        iconColor: "text-emerald-400",
        description: "Protect brand credibility in compliance-sensitive sectors. Ensure every security proposal draft is approved by operations managers before leaving the mailbox.",
        stats: ["Manager review queues", "SOC2 compliance audit trails", "Wire Message-ID sync"]
    },
    {
        slug: "staffing",
        title: "Staffing & Executive Search",
        tagline: "Turn hiring surges into high-margin placement engagements",
        icon: Users,
        badge: "Recruiting & Staffing",
        color: "from-purple-500/20 to-indigo-500/20",
        borderColor: "border-purple-500/30",
        iconColor: "text-purple-400",
        description: "Monitor hiring spikes and leadership departures. Auto-draft tailored candidate capability summaries and review in batch before sending to hiring executives.",
        stats: ["LinkedIn intent scraping", "Batch candidate pitch approval", "Multi-client workspace quotas"]
    },
    {
        slug: "training",
        title: "L&D & Corporate Training",
        tagline: "Reach enterprise HR leaders during platform migrations & reorgs",
        icon: GraduationCap,
        badge: "Enterprise L&D",
        color: "from-amber-500/20 to-orange-500/20",
        borderColor: "border-amber-500/30",
        iconColor: "text-amber-400",
        description: "Target enterprise CHROs and VP L&D when companies adopt new SaaS tools, undergo mergers, or post compliance training mandates.",
        stats: ["Tech stack change signals", "Contextual training proposals", "Automated sequence cadences"]
    },
    {
        slug: "consulting",
        title: "Management Consulting & Advisory",
        tagline: "Governed outreach for high-trust boutique advisory firms",
        icon: Briefcase,
        badge: "Professional Advisory",
        color: "from-rose-500/20 to-pink-500/20",
        borderColor: "border-rose-500/30",
        iconColor: "text-rose-400",
        description: "Prevent awkward partner-level email mistakes. Arm senior consultants with research-backed account insights and human-gated email dispatching.",
        stats: ["Executive persona targeting", "Inline draft editing", "Full shared timeline visibility"]
    },
    {
        slug: "managed-services",
        title: "Managed IT Services & MSPs",
        tagline: "Win high-ACV recurring retainer contracts with governed outbound",
        icon: Server,
        badge: "IT & MSPs",
        color: "from-indigo-500/20 to-blue-500/20",
        borderColor: "border-indigo-500/30",
        iconColor: "text-indigo-400",
        description: "Deliver professional, coordinated first impressions to CTOs and IT Directors. Target companies outgrowing internal IT or experiencing security incidents.",
        stats: ["IT leadership buyer signals", "RFC 8058 deliverability safety", "Multi-mailbox rotation"]
    }
];

export default function UseCasesHubPage() {
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": "CraftMyFunnel Industry Use Cases",
        "description": "Explore how B2B companies across facility management, security, staffing, consulting, training, and managed services automate outbound sales with human approval governance.",
        "url": "https://craftmyfunnel.live/use-cases",
        "mainEntity": {
            "@type": "ItemList",
            "itemListElement": USE_CASES.map((uc, index) => ({
                "@type": "ListItem",
                "position": index + 1,
                "name": uc.title,
                "url": `https://craftmyfunnel.live/use-cases/${uc.slug}`
            }))
        }
    };

    return (
        <div className="min-h-screen bg-[#020617] text-slate-100 pt-28 pb-24 px-4 sm:px-6 lg:px-8">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            <div className="max-w-6xl mx-auto space-y-16">
                {/* Header */}
                <div className="text-center space-y-4 max-w-3xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider">
                        <Sparkles className="w-3.5 h-3.5" />
                        Vertical Solutions
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
                        Built for High-Value B2B Services
                    </h1>
                    <p className="text-lg text-slate-400 leading-relaxed">
                        Generic mass email blasting destroys sender reputation and burns high-ACV enterprise accounts. Explore how vertical leaders use CraftMyFunnel's governed workflows to secure qualified meetings.
                    </p>
                </div>

                {/* Grid of Use Cases */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {USE_CASES.map((uc) => {
                        const Icon = uc.icon;
                        return (
                            <Link
                                key={uc.slug}
                                href={`/use-cases/${uc.slug}`}
                                className="bg-slate-900/60 border border-slate-800 rounded-3xl p-7 flex flex-col justify-between hover:border-blue-500/40 transition-all hover:shadow-2xl hover:shadow-blue-500/5 group relative overflow-hidden"
                            >
                                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${uc.color} rounded-full blur-3xl opacity-30 group-hover:opacity-60 transition-opacity`} />

                                <div className="space-y-4 relative z-10">
                                    <div className="flex items-center justify-between">
                                        <div className={`w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700/80 flex items-center justify-center ${uc.iconColor} group-hover:scale-110 transition-transform`}>
                                            <Icon className="w-6 h-6" />
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-300 bg-slate-800/80 border border-slate-700 px-2.5 py-1 rounded-full uppercase tracking-wider">
                                            {uc.badge}
                                        </span>
                                    </div>

                                    <div>
                                        <h2 className="text-xl font-bold text-white group-hover:text-blue-300 transition-colors">
                                            {uc.title}
                                        </h2>
                                        <p className="text-xs font-medium text-blue-400 mt-1">
                                            {uc.tagline}
                                        </p>
                                    </div>

                                    <p className="text-sm text-slate-400 leading-relaxed">
                                        {uc.description}
                                    </p>

                                    <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
                                        {uc.stats.map((s, idx) => (
                                            <div key={idx} className="flex items-center gap-2 text-xs text-slate-300">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                                <span>{s}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-6 mt-6 border-t border-slate-800/80 flex items-center gap-2 text-sm font-semibold text-blue-400 group-hover:text-blue-300 relative z-10">
                                    <span>Explore Vertical Playbook</span>
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </Link>
                        );
                    })}
                </div>

                {/* Bottom CTA Banner */}
                <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-r from-blue-900/40 via-indigo-950/40 to-slate-900 border border-blue-500/30 text-center space-y-6">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                        Need a Custom Playbook for Your Vertical?
                    </h2>
                    <p className="text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
                        Our platform supports custom vertical sequence templates, persona prompt tuning, and tailored buyer intent signals.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                        <Link
                            href="/pricing"
                            className="px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-xl shadow-blue-600/30 transition-all flex items-center gap-2"
                        >
                            Start 14-Day Pilot
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link
                            href="/contact"
                            className="px-6 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition-all"
                        >
                            Talk to Outbound Specialist
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
