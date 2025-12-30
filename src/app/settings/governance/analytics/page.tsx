"use client";

import { useEffect, useState } from 'react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import {
    ShieldCheck,
    AlertTriangle,
    Zap,
    BarChart3,
    Clock,
    Activity,
    ChevronLeft
} from 'lucide-react';
import Link from 'next/link';

export default function GovernanceAnalyticsPage() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/settings/governance/analytics")
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricCard
                    title="Policy Risk Level"
                    value={stats.policyRiskLevel}
                    icon={<ShieldCheck className="w-5 h-5 text-emerald-400" />}
                    subtitle="Based on concurrent limits"
                    color={stats.policyRiskLevel === 'HIGH' ? 'text-red-400' : 'text-emerald-400'}
                />
                <MetricCard
                    title="Blocked Risks"
                    value={stats.blockedActions}
                    icon={<AlertTriangle className="w-5 h-5 text-red-400" />}
                    subtitle="Total violations prevented"
                />
                <MetricCard
                    title="Risk Savings"
                    value={`$${stats.complianceSavings}`}
                    icon={<Zap className="w-5 h-5 text-yellow-400" />}
                    subtitle="Estimated liability saved"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <GlassCard className="p-6 space-y-4">
                    <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                        <BarChart3 className="w-5 h-5 text-blue-400" />
                        <h3 className="text-lg font-bold text-white">Control Efficiency</h3>
                    </div>
                    <div className="space-y-4">
                        <EfficiencyRow label="Compliance Coverage" value="98.2%" />
                        <EfficiencyRow label="Approval Latency" value="4.2h" />
                        <EfficiencyRow label="Policy Drift" value="Low" />
                        <EfficiencyRow label="Operational Overhead" value="Medium" />
                    </div>
                </GlassCard>

                <GlassCard className="p-6 space-y-4">
                    <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                        <Clock className="w-5 h-5 text-purple-400" />
                        <h3 className="text-lg font-bold text-white">Approval Velocity</h3>
                    </div>
                    <div className="flex flex-col items-center justify-center h-48 space-y-2">
                        <div className="text-4xl font-black text-white">{stats.approvalRate.toFixed(1)}%</div>
                        <div className="text-sm text-gray-500">Approval Throughput Rate</div>
                        <div className="w-full h-2 bg-slate-900 rounded-full mt-4 overflow-hidden border border-white/5">
                            <div
                                className="h-full bg-gradient-to-r from-blue-500 to-purple-600 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                style={{ width: `${stats.approvalRate}%` }}
                            />
                        </div>
                    </div>
                </GlassCard>
            </div>

            <GlassCard className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <Activity className="w-5 h-5 text-blue-400" />
                    <h3 className="text-lg font-bold text-white">Governance Activity (24h)</h3>
                </div>
                <div className="h-32 flex items-end gap-1 px-4">
                    {Array.from({ length: 48 }).map((_, i) => (
                        <div
                            key={i}
                            className="flex-1 bg-blue-500/20 hover:bg-blue-500/50 transition-all rounded-t-sm cursor-help"
                            style={{ height: `${Math.random() * 100}%` }}
                            title={`Actions: ${Math.floor(Math.random() * 50)}`}
                        />
                    ))}
                </div>
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

function EfficiencyRow({ label, value }: { label: string, value: string }) {
    return (
        <div className="flex justify-between items-center p-3 bg-slate-950/50 rounded-lg border border-white/5">
            <span className="text-sm text-gray-400">{label}</span>
            <span className="text-sm font-bold text-white">{value}</span>
        </div>
    );
}
