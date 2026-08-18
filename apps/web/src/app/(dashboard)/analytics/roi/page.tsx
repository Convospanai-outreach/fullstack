"use client";

import { useEffect, useState, useRef } from "react";
import {
    TrendingUp,
    DollarSign,
    Target,
    PieChart,
    Calendar,
    Download
} from "lucide-react";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent
} from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/StatCard"; // Reusing existing components
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { getBrowserApiUrl } from "@/lib/api/browserBase";
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area
} from "recharts";

const MONTH_OPTIONS = [3, 6, 12] as const;

export default function ROIDashboardPage() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [months, setMonths] = useState<number>(6);

    useEffect(() => {
        setLoading(true);
        const ctrl = new AbortController();
        fetch(getBrowserApiUrl(`/analytics/roi?months=${months}`), { signal: ctrl.signal })
            .then(res => res.json())
            .then(json => {
                setData(json);
                setLoading(false);
            })
            .catch(err => {
                if (err?.name === "AbortError") return;
                console.error(err);
                setLoading(false);
            });
        return () => ctrl.abort();
    }, [months]);

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

    // Prevent CSV formula injection: a cell whose text starts with =, +, -, or @ can
    // be interpreted as a formula by Excel/Sheets when the file is opened. Prefixing
    // with an apostrophe forces spreadsheet apps to treat it as plain text.
    const csvSafeCell = (value: unknown) => {
        let str = value === null || value === undefined ? "" : String(value);
        if (/^[=+\-@]/.test(str)) str = `'${str}`;
        return JSON.stringify(str);
    };

    const toCsvSection = (title: string, rows: Array<Record<string, unknown>>, fallbackHeaders: string[]) => {
        const headers = rows.length > 0 ? Object.keys(rows[0]) : fallbackHeaders;
        return [
            title,
            headers.join(","),
            ...rows.map((row) => headers.map((h) => csvSafeCell(row[h])).join(",")),
        ].join("\n");
    };

    const exportReport = () => {
        const funnel = data?.funnel || {};
        const financials = data?.financials || {};
        const history: Array<Record<string, unknown>> = Array.isArray(data?.history) ? data.history : [];
        const campaigns: Array<Record<string, unknown>> = Array.isArray(data?.campaigns) ? data.campaigns : [];

        const csvSections = [
            toCsvSection("Funnel & Financials (lifetime)", [{ ...funnel, ...financials }], [
                "totalLeads", "totalSent", "opportunities", "wins", "conversionRate",
                "spend", "revenue", "roi", "profit",
            ]),
            toCsvSection("Top Campaigns (lifetime)", campaigns, ["id", "name", "sent", "openRate", "replyRate", "status"]),
            toCsvSection(`Revenue vs Spend History (last ${months} months)`, history, ["date", "revenue", "spend"]),
        ];

        const blob = new Blob([csvSections.join("\n\n")], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `campaign-roi-report-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight mb-2">Campaign ROI</h1>
                    <p className="text-text-secondary max-w-xl">
                        Track the financial impact of your AI agents. Measure spend, attribution, and bottom-line revenue.
                    </p>
                </div>
                <div className="flex gap-2">
                    <div
                        className="flex items-center gap-1 rounded-lg border border-white/10 p-1"
                        title="Sets the Revenue vs Spend chart's time window. KPI totals and campaign stats below are lifetime, not scoped to this range."
                    >
                        <Calendar className="w-4 h-4 mx-2 text-text-secondary" />
                        {MONTH_OPTIONS.map((opt) => (
                            <Button
                                key={opt}
                                size="sm"
                                variant={months === opt ? "default" : "ghost"}
                                className={months === opt ? "" : "text-text-secondary"}
                                onClick={() => setMonths(opt)}
                            >
                                {opt}mo
                            </Button>
                        ))}
                    </div>
                    <Button variant="outline" className="border-white/10" onClick={exportReport} disabled={loading}>
                        <Download className="w-4 h-4 mr-2" />
                        Export Report
                    </Button>
                </div>
            </div>

            {/* KPI Grid */}
            <p className="text-xs uppercase tracking-wide text-text-secondary mb-2">Lifetime totals</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {loading ? [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />) : (
                    <>
                        <StatCard
                            label="Total Revenue"
                            value={formatCurrency(data?.financials?.revenue || 0)}
                            icon={DollarSign}
                            description="Attributed to AI Campaigns"
                            trend={{ value: 12.5, isUp: true }}
                        />
                        <StatCard
                            label="Marketing Spend"
                            value={formatCurrency(data?.financials?.spend || 0)}
                            icon={PieChart}
                            description="Compute + Platform Costs"
                            trend={{ value: 2.1, isUp: false }}
                        />
                        <StatCard
                            label="Return on Ad Spend"
                            value={`${(data?.financials?.roi || 0).toFixed(1)}%`}
                            icon={TrendingUp}
                            description="Efficiency Ratio"
                            trend={{ value: 5.4, isUp: true }}
                        />
                        <StatCard
                            label="Conversion Rate"
                            value={`${(data?.funnel?.conversionRate || 0).toFixed(1)}%`}
                            icon={Target}
                            description="Lead to Win Velocity"
                        />
                    </>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Revenue Chart */}
                <div className="lg:col-span-2 space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>Revenue vs Spend ({months}mo)</CardTitle>
                            <CardDescription>Financial performance over the last {months} months</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[300px] w-full mt-4">
                                {loading ? <Skeleton className="w-full h-full" /> : (
                                    <ResponsiveContainer width="100%" height="100%" minHeight={1}>
                                        <AreaChart data={data?.history}>
                                            <defs>
                                                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                            <XAxis dataKey="date" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                                            <YAxis stroke="#666" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val / 1000}k`} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px' }}
                                                itemStyle={{ color: '#fff' }}
                                            />
                                            <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" name="Revenue" />
                                            <Area type="monotone" dataKey="spend" stroke="#ec4899" strokeWidth={3} fillOpacity={1} fill="url(#colorSpend)" name="Spend" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Top Campaigns</CardTitle>
                            <CardDescription>Highest performing agents by deal volume</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-white/5 text-xs text-text-muted uppercase tracking-wider">
                                            <th className="py-3 font-semibold">Campaign Name</th>
                                            <th className="py-3 font-semibold">Status</th>
                                            <th className="py-3 font-semibold text-right">Sent</th>
                                            <th className="py-3 font-semibold text-right">Open Rate</th>
                                            <th className="py-3 font-semibold text-right">Reply Rate</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm">
                                        {loading ? (
                                            <tr><td colSpan={5} className="py-4 text-center text-text-secondary">Loading...</td></tr>
                                        ) : data?.campaigns?.slice(0, 5).map((c: any) => (
                                            <tr key={c.id} className="border-b border-white/5 group hover:bg-white/5 transition-colors">
                                                <td className="py-3 font-medium text-white group-hover:text-accent-blue transition-colors">{c.name}</td>
                                                <td className="py-3">
                                                    <Badge
                                                        variant={c.status === 'active' ? 'success' : c.status === 'completed' ? 'default' : 'warning'}
                                                        className="py-0.5 px-2 text-[10px] uppercase"
                                                    >
                                                        {c.status}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 text-right font-mono text-text-secondary">{c.sent.toLocaleString()}</td>
                                                <td className="py-3 text-right font-mono text-white">
                                                    {c.openRate.toFixed(1)}%
                                                </td>
                                                <td className="py-3 text-right font-mono text-white">
                                                    {c.replyRate.toFixed(1)}%
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar Funnel */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Conversion Funnel</CardTitle>
                            <CardDescription>Track lead progression through your sales pipeline</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-6 mt-2">
                                {/* Funnel Steps */}
                                <div className="relative">
                                    <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 to-transparent opacity-30" />

                                    <FunnelStep
                                        label="Leads Contacted"
                                        count={data?.funnel?.totalSent || 0}
                                        color="bg-blue-500"
                                        percent={100}
                                    />
                                    <FunnelStep
                                        label="Opportunities"
                                        count={data?.funnel?.opportunities || 0}
                                        color="bg-purple-500"
                                        percent={data?.funnel?.totalSent ? (data.funnel.opportunities / data.funnel.totalSent * 100) : 0}
                                    />
                                    <FunnelStep
                                        label="Closed Won"
                                        count={data?.funnel?.wins || 0}
                                        color="bg-emerald-500"
                                        percent={data?.funnel?.totalSent ? (data.funnel.wins / data.funnel.totalSent * 100) : 0}
                                    />
                                </div>

                                <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs text-text-muted">Total Pipeline Value</span>
                                        <span className="text-xs font-bold text-white">Qualified</span>
                                    </div>
                                    <div className="text-2xl font-black text-white tracking-tight">
                                        {formatCurrency((data?.financials?.revenue || 0) * 3)}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Efficiency Score</CardTitle>
                            <CardDescription>Overall performance and cost-effectiveness</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col items-center justify-center py-6 text-center">
                                <div className="relative w-32 h-32 flex items-center justify-center mb-4">
                                    <svg className="w-full h-full transform -rotate-90">
                                        <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/5" />
                                        <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={377} strokeDashoffset={data?.financials?.roi ? 377 - (377 * Math.min(1, data.financials.roi / 100)) : 377} className="text-blue-500" />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-3xl font-black text-white">{data?.financials?.roi ? `${Math.round(data.financials.roi)}%` : "--"}</span>
                                        <span className="text-[10px] text-text-secondary font-bold uppercase tracking-widest">{data?.financials?.roi ? "Active" : "Pending"}</span>
                                    </div>
                                </div>
                                <p className="text-xs text-text-secondary px-4 leading-relaxed">
                                    {data?.financials?.roi ? (
                                        <>Efficiency ratio calculated from current campaign spend vs attributed revenue.</>
                                    ) : (
                                        <>Efficiency calculations and workspace benchmarks will populate as campaign activity increases.</>
                                    )}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function FunnelStep({ label, count, color, percent }: any) {
    const barRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (barRef.current) {
            barRef.current.style.width = `${Math.max(percent, 2)}%`;
        }
    }, [percent]);

    return (
        <div className="relative pl-8 py-3 group">
            <div className={`absolute left-[9px] top-5 w-2 h-2 rounded-full ${color} shadow-[0_0_8px_currentColor]`} />
            <div className="flex justify-between items-end mb-1">
                <span className="text-sm font-medium text-white group-hover:text-accent-blue transition-colors">{label}</span>
                <span className="text-xs font-mono text-text-secondary">{count.toLocaleString()}</span>
            </div>
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <div
                    ref={barRef}
                    className={`h-full ${color} transition-all duration-1000 ease-out`}
                    title={`${label}: ${percent}%`}
                />
            </div>
        </div>
    );
}
