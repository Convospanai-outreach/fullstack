"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/dashboard/StatCard";
import { ActivityTimeline } from "@/components/dashboard/ActivityTimeline";
import {
    Activity,
    Users,
    Megaphone,
    ArrowUpRight,
    Zap,
    Mail,
    ArrowRightLeft,
    Bot
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

export default function DashboardPage() {
    const [stats, setStats] = useState({
        activeCampaigns: 0,
        totalLeads: 0,
        creditsUsed: 0,
        roi: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch real stats from API
        fetch('/api/dashboard/stats')
            .then(res => res.json())
            .then(data => {
                if (data.ok && data.stats) {
                    setStats({
                        activeCampaigns: data.stats.campaignsCount || 0,
                        totalLeads: data.stats.leadsCount || 0,
                        creditsUsed: 0, // Will be fetched from billing API
                        roi: 0 // Calculate based on activity
                    });
                }
            })
            .catch(err => console.error('Failed to fetch dashboard stats:', err))
            .finally(() => setLoading(false));
    }, []);

    return (
        <AppShell>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight">Command Center</h1>
                    <p className="text-text-secondary">Overview of your autonomous growth engine.</p>
                </div>
                <div className="flex gap-3">
                    <Link href="/agents/builder">
                        <Button variant="outline" className="gap-2">
                            <Bot className="w-4 h-4" />
                            Build Agent
                        </Button>
                    </Link>
                    <Link href="/campaigns/new">
                        <Button variant="primary" className="gap-2 shadow-glow">
                            <Megaphone className="w-4 h-4" />
                            New Campaign
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Quick Actions Grid for New Modules */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <Link href="/inbox" className="group">
                    <div className="glass p-4 rounded-xl border border-white/5 hover:border-accent-blue/50 transition-all flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                                <Mail className="w-5 h-5" />
                            </div>
                            <span className="font-semibold text-white">Unified Inbox</span>
                        </div>
                        <div className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">3 New</div>
                    </div>
                </Link>

                <Link href="/crm" className="group">
                    <div className="glass p-4 rounded-xl border border-white/5 hover:border-emerald-500/50 transition-all flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                                <ArrowRightLeft className="w-5 h-5" />
                            </div>
                            <span className="font-semibold text-white">CRM Bridge</span>
                        </div>
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    </div>
                </Link>

                <Link href="/agents" className="group">
                    <div className="glass p-4 rounded-xl border border-white/5 hover:border-purple-500/50 transition-all flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
                                <Bot className="w-5 h-5" />
                            </div>
                            <span className="font-semibold text-white">Orchestrator</span>
                        </div>
                        <span className="text-xs text-text-muted">2 Running</span>
                    </div>
                </Link>

                <Link href="/analytics/roi" className="group">
                    <div className="glass p-4 rounded-xl border border-white/5 hover:border-pink-500/50 transition-all flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-pink-500/10 text-pink-400 rounded-lg">
                                <Zap className="w-5 h-5" />
                            </div>
                            <span className="font-semibold text-white">ROI & Stats</span>
                        </div>
                    </div>
                </Link>
            </div>

            {/* Email Verification Banner */}
            {showVerificationBanner && (
                <div className="mb-6 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-start gap-3">
                    <Mail className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h3 className="text-yellow-200 font-semibold mb-1">
                            Please verify your email address
                        </h3>
                        <p className="text-yellow-200/80 text-sm mb-3">
                            We sent a verification link to <strong>{session?.user?.email}</strong>.
                            Check your inbox to verify your account.
                        </p>
                        <Button
                            onClick={handleResendVerification}
                            disabled={resendingEmail}
                            variant="outline"
                            size="sm"
                            className="border-yellow-500/30 hover:bg-yellow-500/10"
                        >
                            {resendingEmail ? 'Sending...' : 'Resend verification email'}
                        </Button>
                    </div>
                    <button
                        onClick={() => setShowVerificationBanner(false)}
                        className="text-yellow-400/60 hover:text-yellow-400"
                    >
                        ×
                    </button>
                </div>
            )}

            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {loading ? (
                    <>
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="glass p-6 rounded-2xl border border-white/5 animate-pulse">
                                <div className="h-16 bg-white/5 rounded mb-2"></div>
                                <div className="h-8 bg-white/5 rounded"></div>
                            </div>
                        ))}
                    </>
                ) : (
                    <>
                        <StatCard
                            label="Active Campaigns"
                            value={stats.activeCampaigns}
                            icon={Megaphone}
                            trend={{ value: 12, isUp: true }}
                        />
                        <StatCard
                            label="Total Leads"
                            value={stats.totalLeads.toLocaleString()}
                            icon={Users}
                            description="+150 this week"
                        />
                        <StatCard
                            label="Credits Used"
                            value={stats.creditsUsed.toLocaleString()}
                            icon={Activity}
                            description="75% of monthly plan"
                        />
                        <StatCard
                            label="Est. ROI"
                            value={`${stats.roi}%`}
                            icon={ArrowUpRight}
                            trend={{ value: 5.2, isUp: true }}
                            description="vs. last month"
                        />
                    </>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <ActivityTimeline />
                </div>

                {/* Recent Activity / System Status */}
                <div className="space-y-6">
                    <div className="glass p-6 rounded-2xl border border-white/5">
                        <h3 className="font-bold text-white mb-4">System Health</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-text-secondary">CRM Sync</span>
                                <span className="text-emerald-400 font-bold flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Operational
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-text-secondary">Email Relay</span>
                                <span className="text-emerald-400 font-bold flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Operational
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-text-secondary">AI Engines</span>
                                <span className="text-emerald-400 font-bold flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Operational
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
