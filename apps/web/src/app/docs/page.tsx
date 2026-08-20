import Link from "next/link";
import { BookOpen, ShieldCheck, Mail, Cpu, Terminal, ArrowRight, Layers, Lock, FileText } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Documentation & Knowledge Hub | CraftMyFunnel",
    description: "Technical guides, system architecture, deliverability guardrails, and API specifications for CraftMyFunnel's governed B2B outreach platform.",
    openGraph: {
        title: "CraftMyFunnel Documentation & Technical Knowledge Hub",
        description: "Explore in-depth technical guides on governed outreach workflows, human review queues, deliverability safeguards, and API integrations.",
    },
};

const DOC_TOPICS = [
    {
        slug: "governed-outreach",
        title: "Governed Outreach & Approval Queue",
        desc: "Learn how the human-in-the-loop review queue eliminates AI hallucinations, validates draft context, and keeps outbound messaging compliant.",
        icon: ShieldCheck,
        badge: "Core Workflow",
    },
    {
        slug: "deliverability-guardrails",
        title: "Deliverability & Compliance Engine",
        desc: "Deep dive into RFC 5322 wire Message-ID sync, RFC 8058 one-click unsubscribe headers, Google Workspace OAuth, and automatic circuit breakers.",
        icon: Mail,
        badge: "Deliverability",
    },
    {
        slug: "security-architecture",
        title: "Security, Outbox & Blind Indexing",
        desc: "Explore our multi-tenant data isolation architecture, deterministic HMAC-SHA256 blind indexing for encrypted queries, and Transactional Outbox relay.",
        icon: Lock,
        badge: "Architecture",
    },
    {
        slug: "api",
        title: "REST API & Webhooks Specification",
        desc: "Interactive API reference for programmatically creating leads, triggering workflows, querying knowledge bases, and listening to webhook events.",
        icon: Terminal,
        badge: "Developers",
    },
];

export default function DocsHubPage() {
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": "CraftMyFunnel Documentation Hub",
        "description": "Comprehensive technical guides and architecture specifications for CraftMyFunnel.",
        "url": "https://craftmyfunnel.live/docs",
        "mainEntity": {
            "@type": "ItemList",
            "itemListElement": DOC_TOPICS.map((t, idx) => ({
                "@type": "ListItem",
                "position": idx + 1,
                "name": t.title,
                "url": `https://craftmyfunnel.live/docs/${t.slug}`
            }))
        }
    };

    return (
        <div className="min-h-screen bg-[#020617] text-slate-100 pt-28 pb-24 px-4 sm:px-6 lg:px-8">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            <div className="max-w-5xl mx-auto space-y-16">
                {/* Header */}
                <div className="text-center space-y-4 max-w-3xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider">
                        <BookOpen className="w-3.5 h-3.5" />
                        Knowledge Hub
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
                        Platform Documentation
                    </h1>
                    <p className="text-lg text-slate-400 leading-relaxed">
                        Comprehensive architecture specifications, deliverability standards, approval queue mechanics, and developer references.
                    </p>
                </div>

                {/* Topics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {DOC_TOPICS.map((topic) => {
                        const Icon = topic.icon;
                        return (
                            <Link
                                key={topic.slug}
                                href={`/docs/${topic.slug}`}
                                className="bg-slate-900/60 border border-slate-800 rounded-2xl p-7 flex flex-col justify-between hover:border-blue-500/40 transition-all hover:shadow-xl hover:shadow-blue-500/5 group"
                            >
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 group-hover:bg-blue-500/20 transition-all">
                                            <Icon className="w-6 h-6" />
                                        </div>
                                        <span className="text-[11px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full uppercase tracking-wider">
                                            {topic.badge}
                                        </span>
                                    </div>
                                    <h2 className="text-xl font-bold text-white group-hover:text-blue-300 transition-colors">
                                        {topic.title}
                                    </h2>
                                    <p className="text-sm text-slate-400 leading-relaxed">
                                        {topic.desc}
                                    </p>
                                </div>

                                <div className="pt-6 mt-6 border-t border-slate-800/80 flex items-center gap-2 text-sm font-semibold text-blue-400 group-hover:text-blue-300">
                                    <span>Read Technical Guide</span>
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </Link>
                        );
                    })}
                </div>

                {/* LLM / AI Crawler Notice */}
                <div className="p-8 rounded-2xl bg-slate-900/50 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="space-y-2 text-center sm:text-left">
                        <div className="text-white font-bold text-base flex items-center justify-center sm:justify-start gap-2">
                            <Cpu className="w-4 h-4 text-emerald-400" />
                            Machine & AI Readable Documentation
                        </div>
                        <p className="text-xs text-slate-400 max-w-xl">
                            All platform specifications and architecture designs are also formatted for automated agent and LLM ingestion via the <code className="text-blue-300">/llms.txt</code> and <code className="text-blue-300">/llms-full.txt</code> standards.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <a
                            href="/llms.txt"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
                        >
                            llms.txt
                        </a>
                        <a
                            href="/llms-full.txt"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
                        >
                            llms-full.txt
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
