"use client";

import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getBrowserApiBase } from "@/lib/api/browserBase";

type RateLimitStats = { size: number; maxSize: number; calculatedSize: number };

export default function RateLimitPage() {
    const [stats, setStats] = useState<RateLimitStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [clearing, setClearing] = useState(false);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const res = await fetch(getBrowserApiBase() + "/admin/rate-limits");
            const data = await res.json();
            if (data.stats) setStats(data.stats);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleClearAll = async () => {
        setClearing(true);
        try {
            const res = await fetch(getBrowserApiBase() + "/admin/rate-limits", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "clear" })
            });
            if (res.ok) {
                alert("All in-memory rate limits cleared.");
                await fetchStats();
            } else {
                const data = await res.json().catch(() => null);
                alert(data?.error || "Failed to clear rate limits.");
            }
        } catch (error) {
            console.error(error);
            alert("Failed to clear rate limits.");
        } finally {
            setClearing(false);
        }
    };

    if (loading) return <div className="p-8 text-foreground">Loading stats...</div>;

    return (
        <div className="p-8 min-h-screen bg-foreground relative overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 max-w-6xl mx-auto">
                <SectionHeader title="Rate Limiting" subtitle="Traffic Control & Protection" />

                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Cache Stats */}
                    <div className="glass p-6 rounded-xl border border-foreground/10 space-y-4">
                        <h3 className="text-lg font-bold text-foreground mb-2">In-Memory Cache (LRU)</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between text-muted-foreground">
                                <span>Tracked keys</span>
                                <span className="text-foreground font-mono">{stats?.size ?? 0} / {stats?.maxSize ?? 0}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground">
                                <span>Calculated size</span>
                                <span className="text-foreground font-mono">{stats?.calculatedSize ?? 0}</span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleClearAll}
                            disabled={clearing}
                            className="w-full bg-destructive hover:bg-destructive/90 disabled:opacity-50 text-primary-foreground py-2 rounded-lg font-medium"
                        >
                            {clearing ? "Clearing..." : "Clear In-Memory Cache"}
                        </button>
                        <p className="text-xs text-muted-foreground">
                            Redis-backed limits (if configured) remain until their TTL expires.
                        </p>
                    </div>

                    {/* Configured tiers */}
                    <div className="md:col-span-2 glass p-6 rounded-xl border border-foreground/10">
                        <h3 className="text-lg font-bold text-foreground mb-4">Configured Limit Tiers</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-foreground/5 text-muted-foreground text-sm uppercase">
                                    <tr>
                                        <th className="px-4 py-3">Tier</th>
                                        <th className="px-4 py-3">Window</th>
                                        <th className="px-4 py-3">Max Requests</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-foreground/10">
                                    {[
                                        { tier: "PUBLIC", windowMs: 60_000, maxRequests: 100 },
                                        { tier: "AUTH", windowMs: 3_600_000, maxRequests: 5 },
                                        { tier: "AUTHENTICATED", windowMs: 60_000, maxRequests: 1000 },
                                        { tier: "ADMIN", windowMs: 60_000, maxRequests: 5000 },
                                        { tier: "WEBHOOK", windowMs: 60_000, maxRequests: 50 },
                                        { tier: "ERROR_LOGGING", windowMs: 60_000, maxRequests: 10 },
                                    ].map((row) => (
                                        <tr key={row.tier} className="hover:bg-foreground/5">
                                            <td className="px-4 py-3 text-foreground font-mono text-sm">{row.tier}</td>
                                            <td className="px-4 py-3 text-muted-foreground text-sm">{row.windowMs / 1000}s</td>
                                            <td className="px-4 py-3 text-foreground">{row.maxRequests}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                            Tiers are fixed at deploy time (apps/api/src/lib/rateLimit.ts) — there is no runtime config editor.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
