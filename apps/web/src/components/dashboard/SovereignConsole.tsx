"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, Cpu, Activity, Radio } from "lucide-react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from "recharts";
import { getBrowserApiUrl } from "@/lib/api/browserBase";

type Signal = {
    id: string;
    source: string;
    friction: number;
    context: string;
    time: string;
};

type AuditEvent = {
    id: string;
    score: number;
    status: string;
    text: string;
};

type RoiPoint = {
    time: string;
    revenue: number;
    spend: number;
};

export function SovereignConsole() {
    const [piStatus, setPiStatus] = useState<"ONLINE" | "OFFLINE">("OFFLINE");
    // The edge node is optional: the firewall card says "Not configured" until one is set up.
    const [edgeStatus, setEdgeStatus] = useState<"UP" | "DOWN" | "NOT_CONFIGURED">("NOT_CONFIGURED");
    const [signals, setSignals] = useState<Signal[]>([]);
    const [audits, setAudits] = useState<AuditEvent[]>([]);
    const [queueDepth, setQueueDepth] = useState<number>(0);
    const [rateLimit, setRateLimit] = useState<string>("UNKNOWN");
    const [roiHistory, setRoiHistory] = useState<RoiPoint[]>([]);
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch(getBrowserApiUrl("/admin/sovereign-stats"));
                if (!res.ok) throw new Error("Failed to fetch sovereign stats");
                const data = await res.json();
                if (data.ok) {
                    setSignals(data.signals || []);
                    setAudits(data.audits || []);
                    setQueueDepth(data.queueDepth || 0);
                    setRateLimit(data.rateLimitStatus || "UNKNOWN");
                    setPiStatus("ONLINE");
                }
            } catch (e) {
                console.error("Failed to fetch sovereign stats", e);
                setPiStatus("OFFLINE");
            }
        };

        const fetchEdge = async () => {
            try {
                const res = await fetch(getBrowserApiUrl("/edge/status"));
                const data = res.ok ? await res.json() : null;
                setEdgeStatus(data?.status === "UP" || data?.status === "DOWN" ? data.status : "NOT_CONFIGURED");
            } catch {
                setEdgeStatus("NOT_CONFIGURED");
            }
        };

        fetchStats();
        fetchEdge();
        const interval = setInterval(() => { fetchStats(); fetchEdge(); }, 10000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const fetchRoi = async () => {
            try {
                const res = await fetch(getBrowserApiUrl("/analytics/roi"));
                if (!res.ok) throw new Error("Failed to fetch ROI");
                const data = await res.json();
                const history = (data?.history || []) as { date: string; revenue: number; spend: number }[];
                setRoiHistory(
                    history.map((entry) => ({
                        time: entry.date,
                        revenue: entry.revenue || 0,
                        spend: entry.spend || 0
                    }))
                );
            } catch (e) {
                console.error("Failed to fetch ROI", e);
            }
        };

        fetchRoi();
    }, []);

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h2 className="text-4xl font-black tracking-tight text-foreground mb-2 font-outfit">Sovereign Console</h2>
                    <p className="text-muted-foreground font-medium">Real-time local intelligence and privacy orchestration</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className={`flex items-center gap-4 px-6 py-3 rounded-2xl border ${piStatus === "ONLINE" ? "bg-success/10 border-success/30 text-success" : "bg-destructive/10 border-destructive/30 text-destructive"}`}>
                        <Cpu className={`w-5 h-5 ${piStatus === "ONLINE" ? "animate-pulse" : ""}`} />
                        <span className="font-mono font-black text-xs tracking-widest">NODE_PHI3: {piStatus}</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <Card className="border-border rounded-[2rem] overflow-hidden shadow-sm">
                    <CardHeader className="pb-4 pt-8 px-8">
                        <CardTitle className="flex items-center gap-3 text-success font-bold font-outfit text-lg">
                            <div className="p-2 rounded-xl bg-success/10">
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            Sovereign Firewall
                        </CardTitle>
                        <CardDescription className="text-muted-foreground font-medium pt-1">PII masking and fail-closed logic</CardDescription>
                    </CardHeader>
                    <CardContent className="px-8 pb-8">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center py-3 border-b border-border">
                                <span className="text-sm font-bold text-muted-foreground">Status</span>
                                {edgeStatus === "UP" ? (
                                    <Badge className="bg-success/10 text-success border-success/30 px-3">Active (edge node)</Badge>
                                ) : edgeStatus === "DOWN" ? (
                                    <Badge className="bg-destructive/10 text-destructive border-destructive/30 px-3">Edge node down, AI calls blocked</Badge>
                                ) : (
                                    <Badge className="bg-muted text-muted-foreground border-border px-3">Not configured</Badge>
                                )}
                            </div>
                            <div className="flex justify-between items-center py-3 border-b border-border">
                                <span className="text-sm font-bold text-muted-foreground">Strictness</span>
                                <span className="text-xs font-black bg-muted px-3 py-1.5 rounded-lg text-foreground">{edgeStatus === "NOT_CONFIGURED" ? "BASIC (local patterns)" : "MAXIMUM"}</span>
                            </div>
                            <div className="flex justify-between items-center py-3">
                                <span className="text-sm font-bold text-muted-foreground">Last PII Blocked</span>
                                <span className="text-xs font-mono text-primary">Recent</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border rounded-[2rem] overflow-hidden shadow-sm">
                    <CardHeader className="pb-4 pt-8 px-8">
                        <CardTitle className="flex items-center gap-3 text-warning font-bold font-outfit text-lg">
                            <div className="p-2 rounded-xl bg-warning/10">
                                <Radio className="w-5 h-5" />
                            </div>
                            Sentinel Events
                        </CardTitle>
                        <CardDescription className="text-muted-foreground font-medium pt-1">Recent security and policy events</CardDescription>
                    </CardHeader>
                    <CardContent className="px-8 pb-8">
                        <div className="space-y-3">
                            {audits.length === 0 && (
                                <div className="text-center py-6">
                                    <p className="text-xs text-muted-foreground italic font-medium">No sentinel events recorded.</p>
                                </div>
                            )}
                            {audits.map((event) => (
                                <div key={event.id} className="group relative p-3 rounded-xl bg-muted border border-border hover:bg-accent transition-all">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-[10px] font-black text-warning uppercase tracking-tighter">
                                            {event.status}
                                        </span>
                                        <Badge variant="outline" className="text-[8px] h-4 border-border text-muted-foreground uppercase">{event.score}</Badge>
                                    </div>
                                    <h4 className="text-xs font-bold text-foreground truncate mb-1">{event.text}</h4>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border rounded-[2rem] overflow-hidden shadow-sm">
                    <CardHeader className="pb-4 pt-8 px-8">
                        <CardTitle className="flex items-center gap-3 text-primary font-bold font-outfit text-lg">
                            <div className="p-2 rounded-xl bg-primary/10">
                                <Activity className="w-5 h-5" />
                            </div>
                            Signal Feed
                        </CardTitle>
                        <CardDescription className="text-muted-foreground font-medium pt-1">Live friction signals (external)</CardDescription>
                    </CardHeader>
                    <CardContent className="px-8 pb-8">
                        <div className="space-y-4">
                            {signals.length === 0 && (
                                <div className="text-center py-6">
                                    <p className="text-xs text-muted-foreground italic font-medium">No signals yet.</p>
                                </div>
                            )}
                            {signals.map((signal) => (
                                <div key={signal.id} className="p-4 rounded-2xl bg-muted border border-border hover:border-primary/30 transition-all">
                                    <div className="flex justify-between mb-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{signal.source}</span>
                                        <span className="text-[10px] font-bold text-primary/70">{signal.time}</span>
                                    </div>
                                    <p className="text-xs font-bold text-foreground mb-3 line-clamp-2 leading-relaxed">"{signal.context}"</p>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Friction</span>
                                        <div className="h-1.5 w-24 bg-border rounded-full overflow-hidden">
                                            <FrictionBar percent={signal.friction} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader className="py-4">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <Activity className="w-4 h-4 text-warning" />
                            ORCHESTRATION_QUEUE
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4">
                        <div className="flex items-end gap-4">
                            <span className="text-5xl font-black text-foreground">{queueDepth}</span>
                            <div className="pb-1">
                                <p className="text-xs text-muted-foreground uppercase tracking-widest">Pending Tasks</p>
                                <p className="text-[10px] text-success dark:text-success font-mono">Latency: live queue</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="py-4">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 text-warning" />
                            RATE_LIMIT_STATUS
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4">
                        <div className="flex items-center gap-4">
                            <Badge variant={rateLimit === "STABLE" ? "success" : "warning"}>
                                {rateLimit}
                            </Badge>
                            <p className="text-[10px] text-muted-foreground font-mono">PROVIDER: MULTI_LLM_GATEWAY</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground">Revenue vs Spend (last 6 months)</CardTitle>
                </CardHeader>
                <CardContent className="h-[200px] w-full">
                    {mounted && (
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <LineChart data={roiHistory}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                                <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} unit="$" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                                    itemStyle={{ fontSize: "12px" }}
                                />
                                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} name="Revenue" />
                                <Line type="monotone" dataKey="spend" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} strokeDasharray="5 5" name="Spend" />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function FrictionBar({ percent }: { percent: number }) {
    const barRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (barRef.current) {
            barRef.current.style.width = `${percent}%`;
        }
    }, [percent]);

    return (
        <div
            ref={barRef}
            className="h-full bg-gradient-to-r from-primary to-primary/60 shadow-[0_0_10px_hsl(var(--primary)/0.5)] transition-all duration-1000"
            title={`Friction: ${percent}%`}
        />
    );
}
