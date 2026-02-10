"use client";

import { useEffect, useState } from "react";
import { MockROIService, ROIMetrics } from "@/services/analytics/roi";
import { ROICard } from "@/components/dashboard/widgets/ROICard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { ArrowUpRight } from "lucide-react";

export default function ExecutiveView() {
    const [metrics, setMetrics] = useState<ROIMetrics | null>(null);
    const [trends, setTrends] = useState<any[]>([]);

    useEffect(() => {
        MockROIService.getMetrics().then(setMetrics);
        MockROIService.getTrends('mrr').then(setTrends);
    }, []);

    if (!metrics) return <div className="p-10 text-center animate-pulse">Loading Strategic Insights...</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* 1. North Star Metrics (F-Pattern Top Left) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <ROICard
                    title="Recurring Revenue (MRR)"
                    value={metrics.mrr.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                    trend={{ value: 12.5, isUp: true }}
                    status="success"
                    description="On track to beat Q3 targets."
                />
                <ROICard
                    title="Customer Lifetime Value (CLV)"
                    value={metrics.clv.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                    trend={{ value: 5.2, isUp: true }}
                    status="success"
                    description="Upsell campaigns performing well."
                />
                <ROICard
                    title="Acquisition Cost (CAC)"
                    value={metrics.cac.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                    trend={{ value: -2.1, isUp: true }} // Down is good for CAC usually, but let's keep green for good
                    status="success" // Manually set status
                    description="Efficiency improved by 2%."
                />
                <ROICard
                    title="Churn Rate"
                    value={metrics.churnRate + '%'}
                    trend={{ value: 0.5, isUp: false }} // Up is bad for churn
                    status="warning"
                    description="Slight uptick in SMB segment."
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
                        <ResponsiveContainer width="100%" height="100%">
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
                                <span className="text-6xl font-black">{metrics.healthScore}</span>
                                <span className="text-muted-foreground pb-2">/ 100</span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Your account is healthy. Usage is up 15% across all teams.
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
