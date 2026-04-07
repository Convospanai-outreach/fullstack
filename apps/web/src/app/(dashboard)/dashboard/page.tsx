"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, CheckCircle2, Megaphone, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardController } from "@/components/dashboard/DashboardController";
import { Button } from "@/components/ui/button";
import { IntelCapsule, IntelSignal } from "@/components/intel/IntelCapsule";

const launchSteps = [
    {
        title: "Finish workspace setup",
        detail: "Connect email, AI keys, billing, and approvals so launch rules are clear.",
        href: "/setup"
    },
    {
        title: "Import or confirm leads",
        detail: "Make sure the audience is attached before campaigns are activated.",
        href: "/leads"
    },
    {
        title: "Launch with approvals",
        detail: "Start with visible review and sending guardrails before expanding beyond the beta workflow.",
        href: "/campaigns/new"
    }
];

export default function DashboardPage() {
    const [signals, setSignals] = useState<IntelSignal[]>([]);
    const [intelLoading, setIntelLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                const res = await fetch("/api/proxy/intel/summary", { cache: "no-store" });
                if (!res.ok) {
                    throw new Error("intel unavailable");
                }
                const json = await res.json();
                const recentSignals = Array.isArray(json?.recentSignals) ? (json.recentSignals as IntelSignal[]) : [];
                if (!cancelled) {
                    setSignals(recentSignals.slice(0, 3));
                }
            } catch {
                if (!cancelled) {
                    setSignals([]);
                }
            } finally {
                if (!cancelled) {
                    setIntelLoading(false);
                }
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <AppShell>
            <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-white">Command Center</h1>
                    <p className="text-text-secondary">Choose a working lens, finish setup, and move campaigns forward with less ambiguity.</p>
                </div>
                <div className="flex gap-3">
                    <Link href="/agents/swarm">
                        <Button variant="outline" className="gap-2">
                            <Sparkles className="h-4 w-4" />
                            Run Swarm
                        </Button>
                    </Link>
                    <Link href="/agents/builder">
                        <Button variant="outline" className="gap-2">
                            <Bot className="h-4 w-4" />
                            Build Agent
                        </Button>
                    </Link>
                    <Link href="/campaigns/new">
                        <Button variant="default" className="gap-2 shadow-glow">
                            <Megaphone className="h-4 w-4" />
                            New Campaign
                        </Button>
                    </Link>
                </div>
            </div>

            <section className="mb-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Recommended path</p>
                        <h2 className="mt-2 text-2xl font-semibold text-white">Keep the team aligned on the next best action</h2>
                        <p className="mt-2 max-w-2xl text-sm text-gray-400">
                            The interface below is split by role, but the path stays the same: finish setup, confirm audience, then launch an email campaign under clear controls.
                        </p>
                    </div>
                    <Link href="/setup" className="inline-flex items-center gap-2 text-sm font-medium text-cyan-300 transition hover:text-cyan-200">
                        Open setup
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-3">
                    {launchSteps.map((step, index) => (
                        <Link key={step.title} href={step.href} className="rounded-2xl border border-white/10 bg-black/20 p-5 transition hover:border-cyan-500/30 hover:bg-black/30">
                            <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/15 text-sm font-semibold text-cyan-300">
                                    {index + 1}
                                </div>
                                <p className="font-medium text-white">{step.title}</p>
                            </div>
                            <p className="mt-3 text-sm text-gray-400">{step.detail}</p>
                        </Link>
                    ))}
                </div>

                <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                    <p>
                        Start with approvals for new campaigns. Make review, sending limits, and operator visibility stable before expanding the product surface.
                    </p>
                </div>

                <div className="mt-4 flex items-start gap-3 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm text-cyan-100">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                    <p>
                        TOON optimization is active. Prompt sterilization and token compression are running in the background for AI workflows.
                    </p>
                </div>
            </section>

            <section className="mb-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Buyer Intent</p>
                        <h2 className="mt-2 text-2xl font-semibold text-white">Intel capsules before you launch</h2>
                        <p className="mt-2 max-w-2xl text-sm text-gray-400">
                            Review Netjana signals as a compact intelligence unit, then optionally convert them into editable campaign copy.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Link
                            href="/intel"
                            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-gray-200 transition hover:bg-black/30"
                        >
                            Open Intel
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                        <Link href="/campaigns/new" className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-500">
                            Launch from Intel
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                </div>

                <div className="mt-6 space-y-3">
                    {intelLoading && <div className="text-sm text-gray-400">Loading intel…</div>}
                    {!intelLoading && signals.length === 0 && (
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-gray-400">
                            No intel signals yet. When Netjana pushes buyer intent, you’ll see capsules here.
                        </div>
                    )}
                    {signals.map((signal) => (
                        <div key={signal.id} className="space-y-2">
                            <IntelCapsule signal={signal} />
                            <div className="flex flex-wrap gap-2">
                                <Link
                                    href={`/campaigns/new?intelSignalId=${encodeURIComponent(signal.id)}`}
                                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                                >
                                    Use in new campaign
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <DashboardController />
        </AppShell>
    );
}
