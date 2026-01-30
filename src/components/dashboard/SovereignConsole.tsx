"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, Cpu, Activity, Lock, EyeOff, Radio } from "lucide-react";
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
    const [lastScan, setLastScan] = useState<string>(new Date().toLocaleTimeString());
    const [signals, setSignals] = useState<any[]>([]);
    const [audits, setAudits] = useState<any[]>([]);

    // Poll Real-time Stats
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api/admin/sovereign-stats');
                const data = await res.json();
                if (data.ok) {
                    setSignals(data.signals || []);
                    setAudits(data.audits || []);
                    setLastScan(new Date(data.lastScan).toLocaleTimeString());
                    setPiStatus('ONLINE'); // Assume online if API responds
                }
            } catch (e) {
                console.error("Failed to fetch sovereign stats", e);
                setPiStatus('OFFLINE');
            }
        };

        fetchStats();
        const interval = setInterval(fetchStats, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-white mb-1">Sovereign Console</h2>
                    <p className="text-text-secondary">Real-time visibility into Local Intelligence & Privacy Layer</p>
                </div>
                <div className={`flex items-center gap-3 px-4 py-2 rounded-full border ${piStatus === 'ONLINE' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                    <Cpu className={`w-5 h-5 ${piStatus === 'ONLINE' ? 'animate-pulse' : ''}`} />
                    <span className="font-mono font-bold">NODE_PHI3: {piStatus}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* 1. Sovereign Firewall Status */}
                <Card className="border-emerald-500/20 bg-emerald-950/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-emerald-400">
                            <ShieldCheck className="w-5 h-5" />
                            Sovereign Firewall
                        </CardTitle>
                        <CardDescription>PII Masking & Fail-Closed Logic</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center py-2 border-b border-white/5">
                                <span className="text-sm text-gray-400">Status</span>
                                <Badge variant="success" className="bg-emerald-500/20 text-emerald-400">Active</Badge>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-white/5">
                                <span className="text-sm text-gray-400">Tokenization Strategy</span>
                                <span className="text-xs font-mono text-white bg-white/10 px-2 py-1 rounded">DETERMINISTIC_SHA256</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-sm text-gray-400">Last PII Blocked</span>
                                <span className="text-xs text-white">243ms ago</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Adversarial Critic Feed */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-blue-400">
                            <EyeOff className="w-5 h-5" />
                            Adversarial Critic
                        </CardTitle>
                        <CardDescription>Local "Bot-Likeness" Evaluation</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {audits.length === 0 && <div className="text-gray-500 text-xs text-center py-2">No active threats detected.</div>}
                            {audits.map((audit, i) => (
                                <div key={i} className="flex justify-between items-center p-2 rounded bg-white/5 text-xs">
                                    <span className="italic text-gray-400 truncate max-w-[140px]">"{audit.text}"</span>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${audit.status === 'APPROVED' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                        <span className="font-bold">{audit.score}/10</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* 3. Shadow Ingestion Live Feed */}
                <Card className="border-purple-500/20 bg-purple-950/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-purple-400">
                            <Radio className="w-5 h-5" />
                            Shadow Ingestion
                        </CardTitle>
                        <CardDescription>Live Friction Signals (External)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {signals.map((signal) => (
                                <div key={signal.id} className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                                    <div className="flex justify-between mb-1">
                                        <Badge variant="outline" className="text-[10px] border-purple-400/30 text-purple-300">{signal.source}</Badge>
                                        <span className="text-[10px] text-gray-400">{signal.time}</span>
                                    </div>
                                    <p className="text-xs font-medium text-white mb-2 line-clamp-2">"{signal.context}"</p>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] text-gray-500">Friction Score</span>
                                        <div className="h-1.5 w-16 bg-gray-700 rounded-full overflow-hidden">
                                            <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500" style={{ width: `${signal.friction}%` }} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* 4. Karmic Debt / ROI Chart */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm uppercase tracking-widest text-gray-500">Karmic ROI (Cost Saved vs Cloud)</CardTitle>
                </CardHeader>
                <CardContent className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
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
                </CardContent>
            </Card>
        </div>
    );
}
