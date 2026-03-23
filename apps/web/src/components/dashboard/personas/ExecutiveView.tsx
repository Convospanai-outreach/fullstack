"use client";

import { useEffect, useMemo, useState } from "react";
import { ROIService, ROIResponse } from "@/services/analytics/roi";
import { ROICard } from "@/components/dashboard/widgets/ROICard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { ArrowUpRight } from "lucide-react";

export default function ExecutiveView() {
    const [data, setData] = useState<ROIResponse | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        ROIService.getSummary().then(setData).catch(() => setData(null));
    }, []);

    const trends = useMemo(() => {
        if (!data) return [];
        return data.history.map((row) => ({ date: row.date, value: row.revenue }));
    }, [data]);

    if (!mounted || !data) return <div className="p-10 text-center animate-pulse">Loading Strategic Insights...</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* 1. North Star Metrics (F-Pattern Top Left) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <ROICard
                    title="Revenue (Closed Won)"
                    value={data.financials.revenue.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                    trend={{ value: data.funnel.conversionRate, isUp: true }}
                    status="success"
                    description="Closed-won revenue tracked from CRM pipeline."
                />
                <ROICard
                    title="Spend (LLM Usage)"
                    value={data.financials.spend.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                    trend={{ value: data.financials.spend > 0 ? 1 : 0, isUp: false }}
                    status="warning"
                    description="Calculated from recorded model usage."
                />
                <ROICard
                    title="ROI"
                    value={`${data.financials.roi.toFixed(2)}%`}
                    trend={{ value: data.financials.roi, isUp: data.financials.roi >= 0 }}
                    status={data.financials.roi >= 0 ? "success" : "warning"}
                    description="Profit relative to AI spend."
                />
                <ROICard
                    title="Closed Wins"
                    value={data.funnel.wins.toLocaleString()}
                    trend={{ value: data.funnel.conversionRate, isUp: data.funnel.conversionRate >= 0 }}
                    status="success"
                    description="Deals marked as Closed Won."
                />
            </div>

            {/* 2. Strategic Deep Dive */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Trend Chart */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Revenue Velocity</CardTitle>
                        <CardDescription>6-Month Growth Trajectory</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%" minHeight={1} minWidth={0}>
                            <LineChart data={trends}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                <XAxis dataKey="date" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="value"
                                    stroke="#6366f1"
                                    strokeWidth={3}
                                    dot={{ r: 4, fill: "#6366f1" }}
                                    activeDot={{ r: 8 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Account Health & Recommendations */}
                <div className="space-y-6">
                    <Card className="border-l-4 border-l-emerald-500">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <ActivityIcon className="text-emerald-500 w-5 h-5" />
                                Overall Health Score
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-end gap-2 mb-2">
                                <span className="text-6xl font-black">{Math.min(100, Math.max(0, Math.round(data.financials.roi)))}</span>
                                <span className="text-muted-foreground pb-2">/ 100</span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Health score derived from ROI and conversion signals.
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground">Strategic Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <button className="w-full text-left p-3 hover:bg-muted rounded-lg border border-border transition-colors flex justify-between items-center group">
                                <span className="text-sm font-medium">Review Q3 Forecast</span>
                                <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                            </button>
                            <button className="w-full text-left p-3 hover:bg-muted rounded-lg border border-border transition-colors flex justify-between items-center group">
                                <span className="text-sm font-medium">Approve Hiring Budget</span>
                                <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                            </button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function ActivityIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
    )
}
