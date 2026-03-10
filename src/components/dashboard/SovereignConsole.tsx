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

// Mock Data for Karmic Debt / ROI
const roiData = [
    { time: '00:00', cloudCost: 40, localSavings: 120 },
    { time: '04:00', cloudCost: 30, localSavings: 90 },
    { time: '08:00', cloudCost: 20, localSavings: 60 },
    { time: '12:00', cloudCost: 80, localSavings: 240 },
    { time: '16:00', cloudCost: 50, localSavings: 150 },
    { time: '20:00', cloudCost: 90, localSavings: 270 },
    { time: '23:59', cloudCost: 60, localSavings: 180 },
];

export function SovereignConsole() {
    const [piStatus, setPiStatus] = useState<'ONLINE' | 'OFFLINE' | 'BUSY'>('ONLINE');

    const [signals, setSignals] = useState<any[]>([]);
    const [queueDepth, setQueueDepth] = useState<number>(0);
    const [rateLimit, setRateLimit] = useState<string>("STABLE");

    const [events, setEvents] = useState<any[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);

    // Poll Real-time Stats
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api/admin/sovereign-stats');
                const data = await res.json();
                if (data.ok) {
                    setSignals(data.signals || []);
                    setQueueDepth(data.queueDepth || 0);
                    setRateLimit(data.rateLimitStatus || "STABLE");

                    setPiStatus('ONLINE'); // Assume online if API responds
                }

                // Fetch upcoming nurture events
                const nurtureRes = await fetch('/api/nurture/trigger');
                const nurtureData = await nurtureRes.json();
                if (nurtureData.ok) {
                    setEvents(nurtureData.events || []);
                }
            } catch (e) {
                console.error("Failed to fetch sovereign stats", e);
                setPiStatus('OFFLINE');
            }
        };

        fetchStats();
        const interval = setInterval(fetchStats, 10000); // 10s for dashboard
        return () => clearInterval(interval);
    }, []);

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            await fetch('/api/nurture/trigger?action=sync', { method: 'POST' });
            await fetch('/api/nurture/trigger?action=generate', { method: 'POST' });
            // Refresh
            const nurtureRes = await fetch('/api/nurture/trigger');
            const nurtureData = await nurtureRes.json();
            if (nurtureData.ok) setEvents(nurtureData.events || []);
        } catch (e) {
            console.error("Sync failed", e);
        } finally {
            setIsSyncing(false);
        }
    };

    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h2 className="text-4xl font-black tracking-tight text-white mb-2 font-outfit">Sovereign Console</h2>
                    <p className="text-slate-500 font-medium">Real-time local intelligence & privacy orchestration</p>
                </div>
                <div className="flex items-center gap-4">
                    <button 
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="flex items-center gap-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                    >
                        <Radio className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'SYNCING...' : 'SYNC EVENT RADAR'}
                    </button>
                    <div className={`flex items-center gap-4 px-6 py-3 rounded-2xl border ${piStatus === 'ONLINE' ? 'bg-emerald-500/10 border-emerald-500/10 text-emerald-400' : 'bg-red-500/10 border-red-500/10 text-red-400'} shadow-lg backdrop-blur-md`}>
                        <Cpu className={`w-5 h-5 ${piStatus === 'ONLINE' ? 'animate-pulse' : ''}`} />
                        <span className="font-mono font-black text-xs tracking-widest">NODE_PHI3: {piStatus}</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {/* 1. Sovereign Firewall Status */}
                <Card className="glass-premium border-white/5 rounded-[2rem] overflow-hidden shadow-2xl">
                    <CardHeader className="pb-4 pt-8 px-8">
                        <CardTitle className="flex items-center gap-3 text-emerald-400 font-bold font-outfit text-lg">
                            <div className="p-2 rounded-xl bg-emerald-500/10">
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            Sovereign Firewall
                        </CardTitle>
                        <CardDescription className="text-slate-500 font-medium pt-1">PII Masking & Fail-Closed Logic</CardDescription>
                    </CardHeader>
                    <CardContent className="px-8 pb-8">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center py-3 border-b border-white/5">
                                <span className="text-sm font-bold text-slate-400">Status</span>
                                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-3">Active</Badge>
                            </div>
                            <div className="flex justify-between items-center py-3 border-b border-white/5">
                                <span className="text-sm font-bold text-slate-400">Strictness</span>
                                <span className="text-xs font-black bg-white/5 px-3 py-1.5 rounded-lg text-slate-300">MAXIMUM</span>
                            </div>
                            <div className="flex justify-between items-center py-3">
                                <span className="text-sm font-bold text-slate-400">Last PII Blocked</span>
                                <span className="text-xs font-mono text-indigo-400">243ms ago</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Autonomous Event Radar */}
                <Card className="glass-premium border-white/5 rounded-[2rem] overflow-hidden shadow-2xl">
                    <CardHeader className="pb-4 pt-8 px-8">
                        <CardTitle className="flex items-center gap-3 text-orange-400 font-bold font-outfit text-lg">
                            <div className="p-2 rounded-xl bg-orange-500/10">
                                <Radio className="w-5 h-5" />
                            </div>
                            Growth Radar
                        </CardTitle>
                        <CardDescription className="text-slate-500 font-medium pt-1">Event-Driven Nurture Pipeline</CardDescription>
                    </CardHeader>
                    <CardContent className="px-8 pb-8">
                        <div className="space-y-3">
                            {events.length === 0 && (
                                <div className="text-center py-6">
                                    <p className="text-xs text-slate-500 italic font-medium mb-4">No events in current horizon.</p>
                                </div>
                            )}
                            {events.map((event, i) => (
                                <div key={i} className="group relative p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-all">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-[10px] font-black text-orange-500 uppercase tracking-tighter">
                                            {new Date(event.eventDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        </span>
                                        <Badge variant="outline" className="text-[8px] h-4 border-white/10 text-slate-500 uppercase">{event.category}</Badge>
                                    </div>
                                    <h4 className="text-xs font-bold text-white truncate mb-1">{event.eventName}</h4>
                                    <p className="text-[10px] text-slate-500 line-clamp-1 italic">{event.leadGenAngle}</p>
                                    
                                    <div className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* 3. Shadow Ingestion Live Feed */}
                <Card className="glass-premium border-white/5 rounded-[2rem] overflow-hidden shadow-2xl">
                    <CardHeader className="pb-4 pt-8 px-8">
                        <CardTitle className="flex items-center gap-3 text-purple-400 font-bold font-outfit text-lg">
                            <div className="p-2 rounded-xl bg-purple-500/10">
                                <Activity className="w-5 h-5" />
                            </div>
                            Signal Feed
                        </CardTitle>
                        <CardDescription className="text-slate-500 font-medium pt-1">Live Friction Signals (External)</CardDescription>
                    </CardHeader>
                    <CardContent className="px-8 pb-8">
                        <div className="space-y-4">
                            {signals.map((signal) => (
                                <div key={signal.id} className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all">
                                    <div className="flex justify-between mb-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{signal.source}</span>
                                        <span className="text-[10px] font-bold text-indigo-400/60">{signal.time}</span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-200 mb-3 line-clamp-2 leading-relaxed">"{signal.context}"</p>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Friction</span>
                                        <div className="h-1.5 w-24 bg-white/5 rounded-full overflow-hidden">
                                            <FrictionBar percent={signal.friction} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* 4. Hardening & Scalability Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader className="py-4">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <Activity className="w-4 h-4 text-yellow-500" />
                            ORCHESTRATION_QUEUE
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4">
                        <div className="flex items-end gap-4">
                            <span className="text-5xl font-black text-foreground">{queueDepth}</span>
                            <div className="pb-1">
                                <p className="text-xs text-muted-foreground uppercase tracking-widest">Pending Tasks</p>
                                <p className="text-[10px] text-emerald-600 dark:text-emerald-500 font-mono">LATENCY: ~2.4s</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="py-4">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 text-orange-500" />
                            RATE_LIMIT_STATUS
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4">
                        <div className="flex items-center gap-4">
                            <Badge variant={rateLimit === 'STABLE' ? 'success' : 'warning'}>
                                {rateLimit}
                            </Badge>
                            <p className="text-[10px] text-muted-foreground font-mono">PROVIDER: MULTI_LLM_GATEWAY</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* 5. Karmic Debt / ROI Chart */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm uppercase tracking-widest text-gray-500">Karmic ROI (Cost Saved vs Cloud)</CardTitle>
                </CardHeader>
                <CardContent className="h-[200px] w-full">
                    {mounted && (
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <LineChart data={roiData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                <XAxis dataKey="time" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#666" fontSize={12} tickLine={false} axisLine={false} unit="$" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }}
                                    itemStyle={{ fontSize: '12px' }}
                                />
                                <Line type="monotone" dataKey="localSavings" stroke="#10b981" strokeWidth={2} dot={false} name="Local Inference (Saved)" />
                                <Line type="monotone" dataKey="cloudCost" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="5 5" name="Cloud Cost (Avoided)" />
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
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 shadow-[0_0_10px_rgba(99,102,241,0.5)] transition-all duration-1000"
            title={`Friction: ${percent}%`}
        />
    );
}
