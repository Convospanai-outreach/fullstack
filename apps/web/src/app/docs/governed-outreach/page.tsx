import Link from "next/link";
import { ShieldCheck, CheckCircle2, ArrowLeft, ArrowRight, UserCheck, AlertTriangle, Sparkles } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Governed Outreach & Human Approval Queue | CraftMyFunnel Docs",
    description: "Technical guide on how CraftMyFunnel's human-in-the-loop review queue eliminates AI hallucinations and keeps outbound messaging compliant.",
    openGraph: {
        title: "Governed Outreach & Human Approval Queue Guide",
        description: "Explore the core workflow that pairs AI draft generation with human review checkpoints before mailbox dispatch.",
    },
};

export default function GovernedOutreachDocPage() {
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "TechArticle",
        "headline": "Governed Outreach Workflow & Human Approval Queue Mechanics",
        "description": "Comprehensive technical guide on implementing human-in-the-loop AI review queues for B2B sales outreach.",
        "author": {
            "@type": "Organization",
            "name": "CraftMyFunnel"
        },
        "url": "https://craftmyfunnel.live/docs/governed-outreach"
    };

    return (
        <div className="min-h-screen bg-[#020617] text-slate-100 pt-28 pb-24 px-4 sm:px-6 lg:px-8">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            <div className="max-w-4xl mx-auto space-y-12">
                {/* Back navigation */}
                <Link
                    href="/docs"
                    className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to Documentation Hub
                </Link>

                {/* Article Header */}
                <div className="space-y-4 border-b border-slate-800 pb-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider">
                        Core Workflow Guide
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                        Governed Outreach & Human Approval Queue
                    </h1>
                    <p className="text-base sm:text-lg text-slate-400 leading-relaxed">
                        How CraftMyFunnel combines generative AI draft synthesis with a strict human approval gate to eliminate AI hallucinations, protect domain health, and maintain high reply rates.
                    </p>
                </div>

                {/* Article Body */}
                <div className="space-y-10 text-slate-300 leading-relaxed text-sm sm:text-base">
                    {/* Section 1 */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold text-white">The Problem With Autonomous "Spray & Pray"</h2>
                        <p>
                            Traditional cold email automation tools rely on ungoverned background loops: prospect lists are uploaded, generic spintax or unconstrained LLM prompts are executed, and thousands of emails are blasted directly from connected mailboxes.
                        </p>
                        <p>
                            This legacy model leads to two catastrophic failure modes:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                            <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/20 space-y-2">
                                <div className="font-bold text-red-400 flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4" />
                                    AI Hallucinations
                                </div>
                                <p className="text-xs text-slate-400">
                                    LLMs invent false company facts, quote incorrect pricing, or reference competitor features, destroying deal credibility in the first touch.
                                </p>
                            </div>
                            <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/20 space-y-2">
                                <div className="font-bold text-red-400 flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4" />
                                    Domain Burn
                                </div>
                                <p className="text-xs text-slate-400">
                                    High complaint and bounce rates trigger algorithmic spam filters across Google Workspace and Microsoft 365, blacklisting sending domains.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Section 2 */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold text-white">The Governed Outreach Lifecycle</h2>
                        <p>
                            CraftMyFunnel enforces a five-stage state machine that keeps human sales reps in control of every message sent on their behalf:
                        </p>
                        <div className="space-y-3 pt-2">
                            {[
                                {
                                    step: "1. Intent Signal Ingestion",
                                    desc: "Prospects are imported via LinkedIn Sales Navigator scraper bridge, CSV files, or inbound landing agents."
                                },
                                {
                                    step: "2. Contextual AI Draft Synthesis",
                                    desc: "The AI engine analyzes prospect persona, company industry, and playbook prompts to generate contextual subject lines and copy."
                                },
                                {
                                    step: "3. Human Approval Queue",
                                    desc: "Drafts enter the interactive queue. Reps can approve in batch, edit copy inline, adjust sender mailboxes, or reject inappropriate leads."
                                },
                                {
                                    step: "4. Rate-Limited Dispatch",
                                    desc: "Approved drafts transition to the Transactional Outbox relay and are dispatched across connected mailboxes with random human-like jitter."
                                },
                                {
                                    step: "5. Outcome & Reply Tracking",
                                    desc: "Inbound replies are synced via lease-locked Gmail PubSub. The platform detects sentiment, tracks meetings secured, and pauses sequences automatically."
                                }
                            ].map((s, i) => (
                                <div key={i} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-4">
                                    <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                                        {i + 1}
                                    </div>
                                    <div>
                                        <div className="font-bold text-white text-sm">{s.step}</div>
                                        <div className="text-xs text-slate-400 mt-1">{s.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Section 3 */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold text-white">Key Features of the Approval Interface</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 space-y-2">
                                <div className="font-bold text-white flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                    One-Click Batch Approvals
                                </div>
                                <p className="text-xs text-slate-400">
                                    Review 50+ drafts simultaneously with side-by-side prospect profile snapshots and AI reasoning logs.
                                </p>
                            </div>
                            <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 space-y-2">
                                <div className="font-bold text-white flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                    Inline Dynamic Editing
                                </div>
                                <p className="text-xs text-slate-400">
                                    Tweak any generated sentence directly in the queue before approving. Edits are logged for continuous prompt refinement.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Navigation */}
                <div className="border-t border-slate-800 pt-8 flex items-center justify-between">
                    <Link
                        href="/docs"
                        className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1.5"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Docs Index
                    </Link>
                    <Link
                        href="/docs/deliverability-guardrails"
                        className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1.5"
                    >
                        Deliverability & Compliance Engine
                        <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                </div>
            </div>
        </div>
    );
}
