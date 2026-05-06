"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, CheckCircle2, Megaphone, Rocket, Sparkles, TrendingUp, Zap } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardController } from "@/components/dashboard/DashboardController";
import { Button } from "@/components/ui/button";
import { IntelCapsule, IntelSignal } from "@/components/intel/IntelCapsule";

const quickActions = [
    {
        href: "/setup",
        icon: Zap,
        color: "from-violet-500/15 border-violet-500/20 text-violet-400 hover:border-violet-500/40",
        title: "Define ICP",
        desc: "Set the target segment, geography, and buyer profile",
        step: 1,
    },
    {
        href: "/setup",
        icon: TrendingUp,
        color: "from-cyan-500/15 border-cyan-500/20 text-cyan-400 hover:border-cyan-500/40",
        title: "Review outcome goal",
        desc: "Capture qualification and meeting-goal context before launch",
        step: 2,
    },
    {
        href: "/campaigns/new",
        icon: Rocket,
        color: "from-emerald-500/15 border-emerald-500/20 text-emerald-400 hover:border-emerald-500/40",
        title: "Approve campaign plan",
        desc: "Generate the campaign plan, approve launch, and track meetings",
        step: 3,
    },
];

export default function DashboardPage() {
    const [signals, setSignals] = useState<IntelSignal[]>([]);
    const [intelLoading, setIntelLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                const res = await fetch("/api/proxy/intel/summary", { cache: "no-store" });
                if (!res.ok) throw new Error("intel unavailable");
                const json = await res.json();
                const recentSignals = Array.isArray(json?.recentSignals) ? (json.recentSignals as IntelSignal[]) : [];
                if (!cancelled) setSignals(recentSignals.slice(0, 3));
            } catch {
                if (!cancelled) setSignals([]);
            } finally {
                if (!cancelled) setIntelLoading(false);
            }
        };

        load();
        return () => { cancelled = true; };
    }, []);

    return (
        <AppShell>
            {/* ── Header ── */}
            <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-white">Guided Growth Workflow</h1>
                    <p className="mt-1 text-slate-400">Qualified leads, meetings, pipeline, follow-ups, and approvals in one view.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <Link href="/agents/swarm">
                        <Button variant="outline" className="gap-2 border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.07]">
                            <Sparkles className="h-4 w-4 text-violet-400" />
                            Review Follow-ups
                        </Button>
                    </Link>
                    <Link href="/leads">
                        <Button variant="outline" className="gap-2 border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.07]">
                            <Bot className="h-4 w-4 text-cyan-400" />
                            View Qualified Leads
                        </Button>
                    </Link>
                    <Link href="/campaigns/new">
                        <Button className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/20 hover:from-violet-500 hover:to-indigo-500">
                            <Megaphone className="h-4 w-4" />
                            New Autopilot Campaign
                        </Button>
                    </Link>
                </div>
            </div>

            {/* ── Quick Actions / Launch Path ── */}
            <section className="mb-8">
                <div className="mb-5 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-400">Launch path</p>
                        <h2 className="mt-1 text-xl font-bold text-white">Define ICP, set outcomes, approve launch</h2>
                    </div>
                    <Link href="/setup" className="inline-flex items-center gap-1 text-sm font-medium text-violet-400 transition hover:text-violet-300">
                        Open launch readiness <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                    {quickActions.map((action) => (
                        <Link
                            key={action.title}
                            href={action.href}
                            className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${action.color}`}
                        >
                            <div className="mb-4 flex items-center justify-between">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                                    <action.icon className="h-4 w-4" />
                                </div>
                                <span className="text-xs font-semibold text-slate-500">Step {action.step}</span>
                            </div>
                            <h3 className="text-base font-bold text-white">{action.title}</h3>
                            <p className="mt-1 text-sm text-slate-400">{action.desc}</p>
                            <div className="mt-4 flex items-center gap-1 text-xs font-medium opacity-0 transition-all duration-200 group-hover:opacity-100">
                                Go <ArrowRight className="h-3 w-3" />
                            </div>
                        </Link>
                    ))}
                </div>

                <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/8 p-4 text-sm text-emerald-200">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                    <p>
                        <strong>Best practice:</strong> Keep human approval active before launches and follow-ups so meeting opportunities can be reviewed without brand risk.
                    </p>
                </div>
            </section>

            {/* ── Intel Signals ── */}
            <section className="mb-8 rounded-3xl border border-white/8 bg-white/[0.02] p-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-400">Buyer Intent</p>
                        <h2 className="mt-1 text-xl font-bold text-white">Buyer signals ready for qualification</h2>
                        <p className="mt-1 max-w-xl text-sm text-slate-400">
                            Accounts showing intent that can become approved outreach, follow-ups, and qualified meetings.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Link
                            href="/intel"
                            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-200 transition hover:bg-white/[0.08]"
                        >
                            All Signals <ArrowRight className="h-4 w-4" />
                        </Link>
                        <Link href="/campaigns/new" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:from-cyan-500 hover:to-blue-500">
                            Launch from Signal <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                </div>

                <div className="mt-6 space-y-3">
                    {intelLoading && (
                        <div className="flex items-center gap-3 text-sm text-slate-400">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
                            Loading intent signals...
                        </div>
                    )}
                    {!intelLoading && signals.length === 0 && (
                        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-8 text-center">
                            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5">
                                <TrendingUp className="h-6 w-6 text-slate-500" />
                            </div>
                            <p className="font-medium text-slate-300">No buyer signals yet</p>
                            <p className="mt-1 text-sm text-slate-500">
                                When leads show buying intent, qualified-meeting opportunities will appear here.
                            </p>
                            <Link href="/leads" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600/20 px-4 py-2 text-sm font-medium text-violet-300 transition hover:bg-violet-600/30">
                                Import leads to get started <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                        </div>
                    )}
                    {signals.map((signal) => (
                        <div key={signal.id} className="space-y-2">
                            <IntelCapsule signal={signal} />
                            <div className="flex flex-wrap gap-2">
                                <Link
                                    href={`/campaigns/new?intelSignalId=${encodeURIComponent(signal.id)}`}
                                    className="inline-flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.04] px-4 py-2 text-sm text-white transition hover:bg-white/[0.08]"
                                >
                                    Use in campaign <ArrowRight className="h-4 w-4" />
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Main Dashboard ── */}
            <DashboardController />
        </AppShell>
    );
}
