import Link from "next/link";
import { Mail, CheckCircle2, ArrowLeft, ArrowRight, ShieldCheck, Zap, Activity, RefreshCw } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Email Deliverability & Compliance Guardrails | CraftMyFunnel Docs",
    description: "Technical guide on CraftMyFunnel's deliverability architecture: RFC 5322 Message-ID sync, RFC 8058 one-click unsubscribe, and automatic bounce circuit breakers.",
    alternates: {
        canonical: "https://craftmyfunnel.live/docs/deliverability-guardrails",
    },
    openGraph: {
        title: "Email Deliverability & Compliance Architecture Guide",
        description: "Learn how CraftMyFunnel protects domain reputation using RFC standards, lease-locked mailbox sync, and circuit breakers.",
    },
};

export default function DeliverabilityDocPage() {
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
                        "name": "Documentation",
                        "item": "https://craftmyfunnel.live/docs"
                    },
                    {
                        "@type": "ListItem",
                        "position": 3,
                        "name": "Deliverability Guardrails",
                        "item": "https://craftmyfunnel.live/docs/deliverability-guardrails"
                    }
                ]
            },
            {
                "@type": "TechArticle",
                "headline": "Email Deliverability & Compliance Architecture in CraftMyFunnel",
                "description": "Technical specification of RFC 5322 Message-ID threading, RFC 8058 unsubscribe headers, and mailbox warmup guardrails.",
                "author": {
                    "@type": "Organization",
                    "name": "CraftMyFunnel"
                },
                "url": "https://craftmyfunnel.live/docs/deliverability-guardrails"
            }
        ]
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
                        Deliverability Guide
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                        Email Deliverability & Compliance Engine
                    </h1>
                    <p className="text-base sm:text-lg text-slate-400 leading-relaxed">
                        How CraftMyFunnel implements RFC 5322 wire header synchronization, automated RFC 8058 one-click unsubscribe headers, and bounce-rate circuit breakers to protect secondary domain health.
                    </p>
                </div>

                {/* Article Body */}
                <div className="space-y-10 text-slate-300 leading-relaxed text-sm sm:text-base">
                    {/* Section 1 */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold text-white">1. RFC 5322 Wire Message-ID Synchronization</h2>
                        <p>
                            Accurate reply detection and email threading require exact matching of the outbound email's RFC 5322 <code className="text-blue-300">Message-ID</code> header.
                        </p>
                        <p>
                            Many third-party providers (including Google Workspace and Gmail API) overwrite custom message ID headers during wire transmission. CraftMyFunnel employs a two-step post-send sync:
                        </p>
                        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3 font-mono text-xs text-slate-300">
                            <div className="text-blue-400 font-bold">{"// Dispatch & Wire Capture Flow"}</div>
                            <div>1. Generate explicit RFC 5322 Message-ID header: &lt;uuid@domain&gt;</div>
                            <div>2. Dispatch via Google Workspace / Gmail API endpoint</div>
                            <div>3. Re-fetch wire representation to capture actual provider-assigned Message-ID</div>
                            <div>4. Store wire ID in Email.providerId for authoritative In-Reply-To matching</div>
                        </div>
                    </div>

                    {/* Section 2 */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold text-white">2. RFC 8058 One-Click Unsubscribe Compliance</h2>
                        <p>
                            To comply with Google and Yahoo 2024+ sender guidelines, every marketing and cold outreach email dispatched through CraftMyFunnel includes compliant one-click unsubscribe headers:
                        </p>
                        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2 text-xs font-mono text-slate-300">
                            <div>List-Unsubscribe: &lt;https://craftmyfunnel.live/api/unsubscribe?token=...&gt;</div>
                            <div>List-Unsubscribe-Post: List-Unsubscribe=One-Click</div>
                        </div>
                        <p className="text-sm text-slate-400">
                            When a recipient clicks unsubscribe in Gmail or Apple Mail, the webhook instantly marks the lead as <code className="text-red-300 font-mono">UNSUBSCRIBED</code>, immediately halting all active sequence runs across all workspaces.
                        </p>
                    </div>

                    {/* Section 3 */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold text-white">3. Automated Bounce Circuit Breakers</h2>
                        <p>
                            To prevent mailbox blacklisting, CraftMyFunnel calculates continuous bounce and spam complaint metrics per connected mailbox:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                                <div className="text-xs font-bold text-slate-400 uppercase">Warning Threshold</div>
                                <div className="text-xl font-bold text-yellow-400">2.5% Bounce</div>
                                <p className="text-xs text-slate-500">Alerts workspace admin to re-verify prospect email lists.</p>
                            </div>
                            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                                <div className="text-xs font-bold text-slate-400 uppercase">Circuit Breaker</div>
                                <div className="text-xl font-bold text-red-400">5.0% Bounce</div>
                                <p className="text-xs text-slate-500">Automatically pauses all active sends on affected mailbox.</p>
                            </div>
                            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                                <div className="text-xs font-bold text-slate-400 uppercase">Daily Mailbox Cap</div>
                                <div className="text-xl font-bold text-blue-400">30–50 Emails</div>
                                <p className="text-xs text-slate-500">Enforces human sending velocity with randomized intervals.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Navigation */}
                <div className="border-t border-slate-800 pt-8 flex items-center justify-between">
                    <Link
                        href="/docs/governed-outreach"
                        className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1.5"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Governed Outreach Guide
                    </Link>
                    <Link
                        href="/docs/security-architecture"
                        className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1.5"
                    >
                        Security & Outbox Architecture
                        <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                </div>
            </div>
        </div>
    );
}
