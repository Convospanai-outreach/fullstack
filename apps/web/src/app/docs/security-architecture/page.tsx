import Link from "next/link";
import { Lock, ShieldCheck, ArrowLeft, ArrowRight, Database, RefreshCw, Key, CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Security, Outbox & Blind Indexing Architecture | CraftMyFunnel Docs",
    description: "Technical deep-dive on CraftMyFunnel's enterprise multi-tenant isolation, Transactional Outbox pattern, and deterministic HMAC-SHA256 blind indexing for encrypted PII.",
    openGraph: {
        title: "Security, Outbox & Blind Indexing Architecture",
        description: "Explore the database security, deterministic blind indexing, and transactional outbox patterns powering CraftMyFunnel.",
    },
};

export default function SecurityArchitectureDocPage() {
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "TechArticle",
        "headline": "Security, Outbox & Blind Indexing Architecture in CraftMyFunnel",
        "description": "Technical specification of multi-tenant data isolation, Transactional Outbox relay, and HMAC-SHA256 blind indexing.",
        "author": {
            "@type": "Organization",
            "name": "CraftMyFunnel"
        },
        "url": "https://craftmyfunnel.live/docs/security-architecture"
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
                        Architecture Guide
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                        Security, Outbox & Blind Indexing Architecture
                    </h1>
                    <p className="text-base sm:text-lg text-slate-400 leading-relaxed">
                        How CraftMyFunnel enforces multi-tenant data isolation, guarantees zero event drop with the Transactional Outbox pattern, and searches encrypted PII using deterministic HMAC-SHA256 blind indexing.
                    </p>
                </div>

                {/* Article Body */}
                <div className="space-y-10 text-slate-300 leading-relaxed text-sm sm:text-base">
                    {/* Section 1 */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold text-white">1. Multi-Tenant Data Isolation</h2>
                        <p>
                            Every database entity in CraftMyFunnel (<code className="text-blue-300">Lead</code>, <code className="text-blue-300">Campaign</code>, <code className="text-blue-300">SequenceStep</code>, <code className="text-blue-300">ConnectedMailbox</code>) is strictly scoped to a validated <code className="text-blue-300">teamId</code>.
                        </p>
                        <p>
                            Database queries enforce server-side tenant scoping derived exclusively from cryptographic Clerk / NextAuth JWT sessions. Client-provided workspace cookies are cross-checked against database membership records prior to executing any read, write, or delete operation.
                        </p>
                    </div>

                    {/* Section 2 */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold text-white">2. Deterministic HMAC-SHA256 Blind Indexing</h2>
                        <p>
                            To protect sensitive prospect information at rest while retaining high-performance exact-match search capabilities, CraftMyFunnel implements the <strong>Blind Indexing Pattern</strong> (<code className="text-blue-300">BlindIndexService</code>):
                        </p>
                        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3 font-mono text-xs text-slate-300">
                            <div className="text-emerald-400 font-bold">// Deterministic Blind Hash Generation</div>
                            <div>1. PII field (e.g. email/phone) is normalized (lowercase, trimmed)</div>
                            <div>2. Computed hash: HMAC-SHA256(normalized_value, BLIND_INDEX_SALT + ":" + teamId)</div>
                            <div>3. Raw PII is stored encrypted with AES-256-GCM / Fernet</div>
                            <div>4. Exact lookups query the indexed blind hash column with zero plaintext exposure</div>
                        </div>
                    </div>

                    {/* Section 3 */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold text-white">3. Transactional Outbox Pattern</h2>
                        <p>
                            Direct background queue dispatching in distributed systems is prone to partial-failure anomalies (database write succeeds, but message broker crashes before job enqueue).
                        </p>
                        <p>
                            CraftMyFunnel utilizes an atomic <strong>Transactional Outbox</strong> (<code className="text-blue-300">OutboxService</code>):
                        </p>
                        <div className="space-y-3 pt-2">
                            {[
                                {
                                    title: "Atomic Business Transaction",
                                    desc: "Domain changes and corresponding OutboxEvent records are committed inside a single ACID database transaction."
                                },
                                {
                                    title: "Optimistic Lock Worker Relay",
                                    desc: "Background relay workers poll pending outbox events using versioned lease-locks, publish events to workers, and mark status as PUBLISHED."
                                },
                                {
                                    title: "At-Least-Once Delivery & Idempotency",
                                    desc: "Consumer workers utilize idempotency keys to guarantee safe retry handling without duplicate sends."
                                }
                            ].map((item, i) => (
                                <div key={i} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-4">
                                    <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                                    <div>
                                        <div className="font-bold text-white text-sm">{item.title}</div>
                                        <div className="text-xs text-slate-400 mt-1">{item.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer Navigation */}
                <div className="border-t border-slate-800 pt-8 flex items-center justify-between">
                    <Link
                        href="/docs/deliverability-guardrails"
                        className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1.5"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Deliverability Guide
                    </Link>
                    <Link
                        href="/docs/api"
                        className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1.5"
                    >
                        REST API & Webhooks
                        <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                </div>
            </div>
        </div>
    );
}
