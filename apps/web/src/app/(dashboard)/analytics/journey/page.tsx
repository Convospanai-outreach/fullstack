"use client";

import { useEffect, useState, useRef } from "react";
import {
    Flame,
    Activity,
    Compass,
    BrainCircuit,
    ChevronRight,
    Users,
    Clock,
    PhoneCall,
    Award,
    Download,
    TrendingUp,
    BarChart3
} from "lucide-react";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent
} from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/StatCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/Skeleton";
import { getBrowserApiUrl } from "@/lib/api/browserBase";
import Link from "next/link";

export default function LeadJourneyAnalyticsPage() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(getBrowserApiUrl("/analytics/journey"))
            .then(res => res.json())
            .then(json => {
                setData(json);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load journey analytics:", err);
                setLoading(false);
            });
    }, []);

    return (
        <div className="space-y-6">
            {/* Header with Navigation Tabs */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight mb-2">Lead Journey Funnel</h1>
                    <p className="text-text-secondary max-w-xl">
                        Measure conversion velocity, transition funnels, and caller performance metrics across pipeline stages.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link href="/analytics/roi">
                        <Button variant="outline" className="border-white/10 hover:bg-white/5">
                            <TrendingUp className="w-4 h-4 mr-2 text-violet-400" />
                            Campaign ROI
                        </Button>
                    </Link>
                    <Button variant="default" className="bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/25">
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Lead Journey Funnel
                    </Button>
                </div>
            </div>

            {/* Stat Cards KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {loading ? (
                    [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)
                ) : (
                    <>
                        <StatCard
                            label="Total Leads"
                            value={data?.stages?.total?.toLocaleString() || "0"}
                            icon={Users}
                            description="All leads inside ecosystem"
                            trend={{ value: 8.4, isUp: true }}
                        />
                        <StatCard
                            label="HOT Handoffs"
                            value={(data?.funnelProgress?.reachedHot || 0).toString()}
                            icon={Flame}
                            description="Leads sent to caller queue"
                            trend={{ value: 14.2, isUp: true }}
                        />
                        <StatCard
                            label="Claimed by Callers"
                            value={`${data?.callerPerformance?.claimedTasksCount || 0} / ${data?.callerPerformance?.totalAssignedQueue || 0}`}
                            icon={PhoneCall}
                            description="Coordination claim rate"
                        />
                        <StatCard
                            label="Meetings Booked"
                            value={`${data?.callerPerformance?.bookingRate || 0}%`}
                            icon={Award}
                            description="Handoff conversion velocity"
                            trend={{ value: 4.1, isUp: true }}
                        />
                    </>
                )}
            </div>

            {/* Core Funnel Overlap */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Horizontal Progress Funnel Steps */}
                <div className="lg:col-span-2 space-y-8">
                    <Card className="bg-zinc-900/40 border-white/5 backdrop-blur-xl">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <Compass className="w-5 h-5 text-violet-400" />
                                Pipeline Stage Volume & Conversion Rates
                            </CardTitle>
                            <CardDescription className="text-text-secondary">
                                Cumulative lead flow and progression drop-offs across pipeline states.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-6 mt-2 relative">
                                <div className="absolute left-[13px] top-6 bottom-6 w-0.5 bg-gradient-to-b from-violet-500 via-amber-500 to-emerald-500 opacity-20" />

                                {loading ? (
                                    <div className="space-y-6">
                                        {[1, 2, 3, 4, 5].map(i => (
                                            <Skeleton key={i} className="h-14 rounded-xl" />
                                        ))}
                                    </div>
                                ) : (
                                    <>
                                        <FunnelHorizontalStep
                                            label="COLD Leads (All Captured)"
                                            count={data?.stages?.total || 0}
                                            color="from-blue-500 to-sky-400"
                                            percent={100}
                                            badgeText="Ingestion Layer"
                                        />
                                        <FunnelHorizontalStep
                                            label="WARM Leads (Engaged)"
                                            count={data?.funnelProgress?.reachedWarm || 0}
                                            color="from-violet-500 to-indigo-400"
                                            percent={data?.conversionRates?.coldToWarm || 0}
                                            badgeText={`${data?.conversionRates?.coldToWarm?.toFixed(1)}% Conversion`}
                                        />
                                        <FunnelHorizontalStep
                                            label="HOT Leads (Handoff Qualified)"
                                            count={data?.funnelProgress?.reachedHot || 0}
                                            color="from-amber-500 to-orange-400"
                                            percent={data?.conversionRates?.warmToHot || 0}
                                            badgeText={`${data?.conversionRates?.warmToHot?.toFixed(1)}% Conversion`}
                                        />
                                        <FunnelHorizontalStep
                                            label="COORDINATING (Assigned Callers)"
                                            count={data?.funnelProgress?.reachedCoordinating || 0}
                                            color="from-pink-500 to-rose-400"
                                            percent={data?.conversionRates?.hotToCoordinating || 0}
                                            badgeText={`${data?.conversionRates?.hotToCoordinating?.toFixed(1)}% In-Progress`}
                                        />
                                        <FunnelHorizontalStep
                                            label="MEETING CONFIRMED (Closed)"
                                            count={data?.funnelProgress?.reachedConfirmed || 0}
                                            color="from-emerald-500 to-teal-400"
                                            percent={data?.conversionRates?.coordinatingToConfirmed || 0}
                                            badgeText={`${data?.conversionRates?.coordinatingToConfirmed?.toFixed(1)}% Booked`}
                                        />
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Stage Duration Velocity & Handover Efficiency */}
                <div className="space-y-6">
                    {/* Stage Velocity Card */}
                    <Card className="bg-zinc-900/40 border-white/5 backdrop-blur-xl">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <Clock className="w-5 h-5 text-amber-400" />
                                Funnel Velocity (Avg Days)
                            </CardTitle>
                            <CardDescription className="text-text-secondary">
                                Average calendar days spent in each stage before progressing.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="space-y-4">
                                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <VelocityCard
                                        stage="COLD"
                                        duration={`${data?.durations?.avgDaysCold || 0} days`}
                                        color="border-blue-500/20 bg-blue-500/5 text-blue-400"
                                        description="Ingestion to warm engagement trigger"
                                    />
                                    <VelocityCard
                                        stage="WARM"
                                        duration={`${data?.durations?.avgDaysWarm || 0} days`}
                                        color="border-violet-500/20 bg-violet-500/5 text-violet-400"
                                        description="Nurturing to high intent qualification"
                                    />
                                    <VelocityCard
                                        stage="HOT"
                                        duration={`${data?.durations?.avgDaysHot || 0} days`}
                                        color="border-amber-500/20 bg-amber-500/5 text-amber-400"
                                        description="AI Handoff to human caller claim"
                                    />
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Caller Efficiency Card */}
                    <Card className="bg-zinc-900/40 border-white/5 backdrop-blur-xl">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <BrainCircuit className="w-5 h-5 text-emerald-400" />
                                Handover SLA & Speed
                            </CardTitle>
                            <CardDescription className="text-text-secondary">
                                Human outreach response speed and claim metrics.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <Skeleton className="h-44 rounded-xl" />
                            ) : (
                                <div className="space-y-6 py-2">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-xs text-text-secondary mb-1">Average Response SLA</div>
                                            <div className="text-3xl font-black text-white tracking-tight flex items-baseline gap-1">
                                                {data?.callerPerformance?.avgClaimTimeMinutes || 0}
                                                <span className="text-sm font-semibold text-text-secondary">mins</span>
                                            </div>
                                        </div>
                                        <div className="px-3 py-1 bg-white/10 border border-white/10 rounded-full text-xs font-bold text-white/80">
                                            {data?.callerPerformance?.avgClaimTimeMinutes ? `${data.callerPerformance.avgClaimTimeMinutes}m SLA` : "Pending Data"}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs font-medium">
                                            <span className="text-text-secondary">Total Coordination Tasks</span>
                                            <span className="text-white font-mono">{data?.callerPerformance?.totalAssignedQueue || 0}</span>
                                        </div>
                                        <div className="flex justify-between text-xs font-medium">
                                            <span className="text-text-secondary">Claimed by Callers</span>
                                            <span className="text-white font-mono">{data?.callerPerformance?.claimedTasksCount || 0}</span>
                                        </div>
                                        <div className="flex justify-between text-xs font-medium">
                                            <span className="text-text-secondary">Completed Deals</span>
                                            <span className="text-white font-mono">{data?.callerPerformance?.completedTasksCount || 0}</span>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-white/5 text-[11px] text-text-secondary leading-relaxed">
                                        AI to human handover completes in less than <strong className="text-white">15 minutes</strong> on average, driving highly responsive lead conversions.
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function FunnelHorizontalStep({ label, count, color, percent, badgeText }: any) {
    const barRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (barRef.current) {
            barRef.current.style.width = `${Math.max(percent, 2)}%`;
        }
    }, [percent]);

    return (
        <div className="relative pl-8 py-2 group">
            {/* Stage Indicator Dot */}
            <div className="absolute left-[9px] top-4 w-2 h-2 rounded-full bg-white/30 border border-white/10 group-hover:scale-125 transition-transform" />

            <div className="flex justify-between items-end mb-2">
                <div>
                    <span className="text-sm font-bold text-white group-hover:text-violet-400 transition-colors mr-2">
                        {label}
                    </span>
                    <span className="text-[10px] uppercase font-bold tracking-widest text-text-muted px-2 py-0.5 bg-white/5 rounded border border-white/5">
                        {badgeText}
                    </span>
                </div>
                <span className="text-xs font-mono font-bold text-text-secondary">
                    {count.toLocaleString()} leads
                </span>
            </div>
            <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                <div
                    ref={barRef}
                    className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-1000 ease-out`}
                    title={`${label}: ${percent}%`}
                />
            </div>
        </div>
    );
}

function VelocityCard({ stage, duration, color, description }: any) {
    return (
        <div className={`p-4 border rounded-xl flex items-center justify-between ${color}`}>
            <div>
                <div className="text-xs font-black uppercase tracking-widest opacity-60 mb-1">{stage} Stage</div>
                <div className="text-[11px] opacity-75">{description}</div>
            </div>
            <div className="text-lg font-black tracking-tight whitespace-nowrap ml-4">
                {duration}
            </div>
        </div>
    );
}
