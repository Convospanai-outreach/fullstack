"use client";

import { useEffect, useState } from 'react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import {
    ShieldCheck,
    AlertTriangle,
    Activity,
    ChevronLeft
} from 'lucide-react';
import Link from 'next/link';
import { getBrowserApiBase } from "@/lib/api/browserBase";

export default function GovernanceAnalyticsPage() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(getBrowserApiBase() + "/settings/governance/analytics")
            .then(res => res.json())
            .then(data => {
                setStats(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    if (loading) return <div className="p-8 text-white">Loading governance analytics...</div>;

    return (
        <div className="space-y-8 max-w-6xl">
            <div className="flex items-center gap-4">
                <Link href="/settings/governance" className="p-2 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-all">
                    <ChevronLeft className="w-6 h-6" />
                </Link>
                <SectionHeader
                    title="Governance Health"
                    subtitle="Performance metrics for your operational guardrails and compliance layers."
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <MetricCard
                    title="Policy Risk Level"
                    value={stats.policyRiskLevel}
                    icon={<ShieldCheck className="w-5 h-5 text-emerald-400" />}
                    subtitle="Based on the last 24h block rate"
                    color={stats.policyRiskLevel === 'HIGH' ? 'text-red-400' : stats.policyRiskLevel === 'MEDIUM' ? 'text-amber-400' : 'text-emerald-400'}
                />
                <MetricCard
                    title="Blocked Risks"
                    value={stats.blockedActions}
                    icon={<AlertTriangle className="w-5 h-5 text-red-400" />}
                    subtitle="Total violations prevented"
                />
            </div>

            <GlassCard className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <Activity className="w-5 h-5 text-blue-400" />
                    <h3 className="text-lg font-bold text-white">Governance Activity (24h)</h3>
                </div>
                {stats.hourlyActivity.every((count: number) => count === 0) ? (
                    <div className="h-32 flex items-center justify-center text-sm text-gray-500">
                        No guardrail activity in the last 24 hours.
                    </div>
                ) : (
                    <div className="h-32 flex items-end gap-1 px-4">
                        {stats.hourlyActivity.map((count: number, i: number) => {
                            const max = Math.max(...stats.hourlyActivity, 1);
                            const hoursAgo = 23 - i;
                            return (
                                <div
                                    key={i}
                                    className="flex-1 bg-blue-500/20 hover:bg-blue-500/50 transition-all rounded-t-sm cursor-help"
                                    style={{ height: `${Math.max((count / max) * 100, count > 0 ? 8 : 2)}%` }}
                                    title={`~${hoursAgo}h ago: ${count} action${count === 1 ? '' : 's'}`}
                                />
                            );
                        })}
                    </div>
                )}
            </GlassCard>
        </div>
    );
}

function MetricCard({ title, value, icon, subtitle, color = "text-white" }: any) {
    return (
        <GlassCard className="p-6 space-y-2">
            <div className="flex justify-between items-center text-gray-500">
                <span className="text-xs font-bold uppercase tracking-wider">{title}</span>
                {icon}
            </div>
            <div className={`text-3xl font-black ${color}`}>{value}</div>
            <div className="text-[10px] text-gray-500">{subtitle}</div>
        </GlassCard>
    );
}
