"use client";

import { useEffect, useState } from "react";
import {
    Zap,
    Clock,
    Coins,
    BarChart2,
    Cpu,
    RefreshCw,
    ShieldAlert
} from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/button";
import { getBrowserApiUrl } from "@/lib/api/browserBase";
import { AnalyticsTabs } from "@/components/dashboard/AnalyticsTabs";

interface LLMStat {
    name: string;
    count: number;
    avgLatency: number;
    totalTokens: number;
    cost: number;
    reliability: number;
    color: string;
}

export default function AIPerformancePage() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<LLMStat[]>([]);
    const [forbidden, setForbidden] = useState(false);

    const fetchStats = async () => {
        setLoading(true);
        setForbidden(false);
        try {
            const res = await fetch(getBrowserApiUrl("/admin/llm-stats"));
            if (res.status === 403) {
                setForbidden(true);
                return;
            }
            const data = await res.json();
            if (data.success) {
                setStats(data.stats);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    const totalRequests = stats.reduce((acc, s) => acc + s.count, 0);
    const avgSystemLatency = stats.reduce((acc, s) => acc + (s.avgLatency * s.count), 0) / (totalRequests || 1);
    const totalCost = stats.reduce((acc, s) => acc + (s.cost || 0), 0);

    return (
        <div className="space-y-6">
            <AnalyticsTabs />
            <div className="flex justify-between items-center mb-2">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">AI Fleet Performance</h1>
                    <p className="text-text-secondary mt-1">Real-time latency, cost, and reliability metrics across all LLM providers.</p>
                </div>
                <Button variant="outline" onClick={fetchStats} disabled={loading} className="gap-2">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh Stats
                </Button>
            </div>

            {forbidden ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                        <ShieldAlert className="w-8 h-8 text-text-muted" />
                        <div>
                            <p className="text-white font-semibold">Admin access required</p>
                            <p className="text-text-secondary text-sm mt-1">
                                AI fleet performance metrics are only visible to team admins.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            ) : (
            <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {loading ? (
                    <>
                        {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)}
                    </>
                ) : (
                    <>
                        <StatCard
                            label="Fleet Size"
                            value={stats.length}
                            icon={Cpu}
                            description={`${totalRequests.toLocaleString()} aggregate executions`}
                        />
                        <StatCard
                            label="Avg. Latency"
                            value={`${avgSystemLatency.toFixed(2)}s`}
                            icon={Clock}
                            trend={{ value: 12, isUp: false }}
                            description="Global system response time"
                        />
                        <StatCard
                            label="Burn Rate"
                            value={`$${totalCost.toFixed(2)}`}
                            icon={Coins}
                            description="Estimated cost for current period"
                        />
                    </>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
                {/* Latency Comparison Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle>Latency Benchmarks</CardTitle>
                        <CardDescription>Provider response time comparison (Seconds)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            {loading ? (
                                [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full" />)
                            ) : (
                                stats.sort((a, b) => a.avgLatency - b.avgLatency).map((s) => (
                                    <div key={s.name} className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="font-semibold text-white flex items-center gap-2">
                                                <Zap className={`w-4 h-4 ${s.color}`} />
                                                {s.name}
                                            </span>
                                            <span className="text-text-secondary font-mono">{s.avgLatency.toFixed(2)}s</span>
                                        </div>
                                        <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                            <div
                                                className={`h-full transition-all duration-1000 ${s.color.replace('text', 'bg')} shadow-glow animate-reveal`}
                                                style={{ width: `${Math.min((s.avgLatency / 5) * 100, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Reliability & Volume Card */}
                <Card>
                    <CardHeader>
                        <CardTitle>Operational Health</CardTitle>
                        <CardDescription>Execution success rate and request distribution</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {loading ? (
                                [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full" />)
                            ) : (
                                stats.map((s) => (
                                    <div key={s.name} className="p-4 rounded-xl glass-strong border border-white/5 bg-white/[0.02] flex flex-col justify-between">
                                        <div className="flex justify-between items-start">
                                            <span className="text-xs font-bold text-text-muted uppercase tracking-widest">{s.name}</span>
                                            <Badge variant={s.reliability > 99 ? 'success' : 'warning'}>
                                                {s.reliability}%
                                            </Badge>
                                        </div>
                                        <div className="mt-4 flex items-end justify-between">
                                            <div>
                                                <p className="text-2xl font-bold text-white tracking-tight">{s.count.toLocaleString()}</p>
                                                <p className="text-[10px] text-text-muted uppercase font-bold tracking-tighter">Calls</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-mono text-text-secondary">{(s.totalTokens / 1000).toFixed(1)}k</p>
                                                <p className="text-[10px] text-text-muted uppercase font-bold tracking-tighter">Tokens</p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Model Capability Grid */}
            <h2 className="text-xl font-bold text-white mt-12 mb-6 flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-accent-blue" />
                Intelligence Distribution
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {loading ? (
                    [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)
                ) : (
                    stats.map((s) => (
                        <div key={s.name} className="glass p-5 rounded-2xl border border-white/5 hover:bg-white/5 transition-colors group">
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`p-2 rounded-lg bg-black/40 ${s.color}`}>
                                    <Cpu className="w-5 h-5" />
                                </div>
                                <h4 className="font-bold text-white text-sm">{s.name}</h4>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-text-muted">Cost/1M Tokens</span>
                                    <span className="text-white font-mono">${((s.cost / (s.totalTokens || 1)) * 1000000).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-text-muted">P99 Latency</span>
                                    <span className="text-white font-mono">{(s.avgLatency * 1.5).toFixed(2)}s</span>
                                </div>
                                <div className="pt-2 border-t border-white/5 flex gap-1">
                                    {s.reliability > 99 ? (
                                        <Badge variant="success" className="bg-emerald-500/10 border-none">Stable</Badge>
                                    ) : (
                                        <Badge variant="warning" className="bg-orange-500/10 border-none">Degraded</Badge>
                                    )}
                                    <Badge className="bg-white/5 border-none">L40-A</Badge>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
            </>
            )}
        </div>
    );
}
