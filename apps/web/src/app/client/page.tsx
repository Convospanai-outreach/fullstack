"use client";

import { useEffect, useMemo, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowRight, BarChart3, CheckCircle2, Clock3, LogOut, Megaphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";
import { getBrowserApiUrl } from "@/lib/api/browserBase";
import type { Campaign } from "@/types/common";

type ClientCampaign = Campaign & { targetCount?: number | null };

function progressPercent(campaign: ClientCampaign) {
    const target = Number(campaign.targetCount || campaign._count?.leads || 0);
    const completed = Number(campaign.completedCount || 0);
    if (target <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((completed / target) * 100)));
}

export default function ClientPortalPage() {
    const { data: session, status } = useSession();
    const [campaigns, setCampaigns] = useState<ClientCampaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (status === "loading") return;

        setLoading(true);
        fetch(getBrowserApiUrl("/campaigns"))
            .then((res) => {
                if (!res.ok) throw new Error("Unable to load campaign progress.");
                return res.json();
            })
            .then((data) => {
                setCampaigns(Array.isArray(data) ? data : []);
                setError("");
            })
            .catch((err) => {
                setCampaigns([]);
                setError(err instanceof Error ? err.message : "Unable to load campaign progress.");
            })
            .finally(() => setLoading(false));
    }, [status]);

    const totals = useMemo(() => {
        return campaigns.reduce(
            (acc, campaign) => {
                acc.target += Number(campaign.targetCount || campaign._count?.leads || 0);
                acc.completed += Number(campaign.completedCount || 0);
                if (campaign.status === "active") acc.active += 1;
                return acc;
            },
            { target: 0, completed: 0, active: 0 }
        );
    }, [campaigns]);

    return (
        <main className="min-h-screen bg-slate-950 p-6 text-white">
            <div className="mx-auto max-w-6xl space-y-8">
                <header className="flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-center md:justify-between">
                    <div>
                        <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-cyan-300">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/20 text-xs">CS</span>
                            CraftMyFunnel Client Portal
                        </Link>
                        <h1 className="mt-4 text-3xl font-black tracking-tight">Campaign progress</h1>
                        <p className="mt-2 max-w-2xl text-sm text-slate-400">
                            Read-only view of outreach progress, campaign status, completed work, and lead workflow tracking.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-right text-xs text-slate-400">
                            <p className="font-semibold text-slate-200">{session?.user?.name || "Client user"}</p>
                            <p>{session?.user?.email}</p>
                        </div>
                        <Button variant="outline" onClick={() => signOut({ callbackUrl: "/client-login" })} className="gap-2">
                            <LogOut className="h-4 w-4" />
                            Sign out
                        </Button>
                    </div>
                </header>

                <section className="grid gap-4 md:grid-cols-3">
                    <GlassCard className="p-5">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-slate-400">Active campaigns</p>
                            <Megaphone className="h-5 w-5 text-cyan-300" />
                        </div>
                        <p className="mt-3 text-3xl font-black">{totals.active}</p>
                    </GlassCard>
                    <GlassCard className="p-5">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-slate-400">Completed outreach steps</p>
                            <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                        </div>
                        <p className="mt-3 text-3xl font-black">{totals.completed}</p>
                    </GlassCard>
                    <GlassCard className="p-5">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-slate-400">Tracked lead targets</p>
                            <BarChart3 className="h-5 w-5 text-violet-300" />
                        </div>
                        <p className="mt-3 text-3xl font-black">{totals.target}</p>
                    </GlassCard>
                </section>

                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold">Campaigns</h2>
                        <Badge variant="secondary">{campaigns.length} visible</Badge>
                    </div>

                    {loading ? (
                        <div className="grid gap-4 md:grid-cols-2">
                            {[1, 2, 3, 4].map((item) => (
                                <GlassCard key={item} className="h-48 animate-pulse p-6">
                                    <div className="h-full rounded-2xl bg-white/5" />
                                </GlassCard>
                            ))}
                        </div>
                    ) : error ? (
                        <GlassCard className="p-8 text-center text-sm text-red-200">{error}</GlassCard>
                    ) : campaigns.length === 0 ? (
                        <GlassCard className="p-10 text-center">
                            <Clock3 className="mx-auto h-10 w-10 text-slate-500" />
                            <h3 className="mt-4 text-lg font-semibold">No campaign progress available yet</h3>
                            <p className="mt-2 text-sm text-slate-400">Once your team starts campaign operations, progress will appear here.</p>
                        </GlassCard>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {campaigns.map((campaign) => {
                                const progress = progressPercent(campaign);
                                return (
                                    <GlassCard key={campaign.id} className="p-6">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <h3 className="text-lg font-bold">{campaign.name}</h3>
                                                <p className="mt-1 line-clamp-2 text-sm text-slate-400">{campaign.description || "Campaign progress is being tracked."}</p>
                                            </div>
                                            <Badge variant={campaign.status === "active" ? "success" : "default"}>{campaign.status}</Badge>
                                        </div>

                                        <div className="mt-6">
                                            <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                                                <span>Progress</span>
                                                <span>{progress}%</span>
                                            </div>
                                            <div className="h-2 overflow-hidden rounded-full bg-white/10">
                                                <div className="h-full rounded-full bg-cyan-400" style={{ width: `${progress}%` }} />
                                            </div>
                                        </div>

                                        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                                            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                                                <p className="text-xs text-slate-500">Target</p>
                                                <p className="mt-1 text-xl font-bold">{campaign.targetCount || campaign._count?.leads || 0}</p>
                                            </div>
                                            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                                                <p className="text-xs text-slate-500">Completed</p>
                                                <p className="mt-1 text-xl font-bold">{campaign.completedCount || 0}</p>
                                            </div>
                                        </div>

                                        <div className="mt-5 text-xs text-slate-500">
                                            Read-only campaign progress view <ArrowRight className="ml-1 inline h-3 w-3" />
                                        </div>
                                    </GlassCard>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}
