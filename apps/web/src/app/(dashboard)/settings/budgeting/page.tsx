"use client";

import { useEffect, useState } from 'react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { UsageStats } from '@/components/dashboard/settings/UsageStats';
import { toast } from 'sonner';
import {
    Wallet,
    Users,
    TrendingUp,
    Settings2,
    ShieldAlert,
    User as UserIcon,
    Save
} from 'lucide-react';

interface Member {
    id: string;
    name: string;
    email: string;
}

interface UserQuota {
    userId: string;
    monthlyLimit: number;
    currentSpend: number;
    user?: { name: string; email: string };
}

interface BudgetPolicy {
    maxCreditsPerUser: number;
    requiresApprovalForOverage: boolean;
}

interface BudgetingData {
    policy: BudgetPolicy;
    members: Member[];
    userQuotas: UserQuota[];
}

const DEFAULT_POLICY: BudgetPolicy = {
    maxCreditsPerUser: 1000,
    requiresApprovalForOverage: true,
};

function normalizeBudgetingData(data: any): BudgetingData {
    return {
        policy: {
            ...DEFAULT_POLICY,
            ...(data?.policy ?? {}),
        },
        members: Array.isArray(data?.members) ? data.members : [],
        userQuotas: Array.isArray(data?.userQuotas) ? data.userQuotas : [],
    };
}

export default function BudgetingPage() {
    const [data, setData] = useState<BudgetingData | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [overrides, setOverrides] = useState<Record<string, number>>({});

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const res = await fetch((process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy") + "/settings/budgeting");
            const d = await res.json();
            const normalized = normalizeBudgetingData(d);
            setData(normalized);

            // Initialize overrides state
            const initialOverrides: Record<string, number> = {};
            normalized.userQuotas.forEach((q: UserQuota) => {
                initialOverrides[q.userId] = q.monthlyLimit;
            });
            setOverrides(initialOverrides);
        } catch (err) {
            toast.error("Failed to load budgeting data");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!data) return;

        setSaving(true);
        try {
            const userOverrides = Object.entries(overrides).map(([userId, monthlyLimit]) => ({
                userId,
                monthlyLimit
            }));

            const res = await fetch((process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy") + "/settings/budgeting", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    maxCreditsPerUser: data.policy.maxCreditsPerUser,
                    requiresApprovalForOverage: data.policy.requiresApprovalForOverage,
                    userOverrides
                })
            });

            if (res.ok) {
                toast.success("Budgeting policy updated");
                fetchData();
            } else {
                toast.error("Failed to update policy");
            }
        } catch (err) {
            toast.error("Error saving limits");
        } finally {
            setSaving(false);
        }
    };

    if (loading || !data) return <div className="p-8 text-white">Loading budgeting console...</div>;

    return (
        <div className="space-y-8 max-w-6xl">
            <SectionHeader
                title="Budgeting & Credit Quotas"
                subtitle="Manage financial guardrails and allocate credits across your organization."
            />

            {/* Global Usage Overview */}
            <UsageStats />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricCard
                    title="Avg Spend / User"
                    value="12.4"
                    icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
                    subtitle="Last 30 days"
                />
                <MetricCard
                    title="Active Overrides"
                    value={data.userQuotas.length}
                    icon={<Settings2 className="w-5 h-5 text-blue-400" />}
                    subtitle="Custom user limits"
                />
                <MetricCard
                    title="Blocked Overages"
                    value="3"
                    icon={<ShieldAlert className="w-5 h-5 text-red-400" />}
                    subtitle="Prevented this month"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Organization Defaults */}
                <GlassCard className="p-6 space-y-6 lg:col-span-1">
                    <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                        <Wallet className="w-5 h-5 text-blue-400" />
                        <h3 className="text-lg font-bold text-white">Global Defaults</h3>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm text-gray-400 font-medium">Monthly Credit Cap (Per User)</label>
                            <input
                                type="number"
                                value={data.policy.maxCreditsPerUser}
                                onChange={(e) => setData({ ...data, policy: { ...data.policy, maxCreditsPerUser: parseInt(e.target.value) } })}
                                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-all font-mono"
                            />
                            <p className="text-[10px] text-gray-500 italic">Default limit applied to all members without an override.</p>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-slate-950/50 rounded-xl border border-white/5">
                            <div>
                                <div className="text-white text-xs font-bold">Block on Overage</div>
                                <div className="text-[10px] text-gray-400">Apply hard cap beyond quota.</div>
                            </div>
                            <Toggle
                                checked={data.policy.requiresApprovalForOverage}
                                onChange={(v) => setData({ ...data, policy: { ...data.policy, requiresApprovalForOverage: v } })}
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? "Updating..." : "Save Budget Policy"}
                    </button>
                </GlassCard>

                {/* User Quotas */}
                <GlassCard className="p-6 space-y-6 lg:col-span-2">
                    <div className="flex items-center justify-between border-b border-white/10 pb-4">
                        <div className="flex items-center gap-3">
                            <Users className="w-5 h-5 text-purple-400" />
                            <h3 className="text-lg font-bold text-white">Individual Allocations</h3>
                        </div>
                    </div>

                    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {data.members.map((member: Member) => {
                            const quota = data.userQuotas.find((q: any) => q.userId === member.id);
                            const currentLimit = overrides[member.id] !== undefined ? overrides[member.id] : data.policy.maxCreditsPerUser;
                            const currentSpend = quota?.currentSpend || 0;
                            const percent = Math.min((currentSpend / currentLimit) * 100, 100);

                            return (
                                <div key={member.id} className="p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-all space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-400">
                                                <UserIcon className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-white">{member.name}</div>
                                                <div className="text-[10px] text-gray-500">{member.email}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Limit:</span>
                                            <input
                                                type="number"
                                                value={currentLimit}
                                                onChange={(e) => setOverrides({ ...overrides, [member.id]: parseInt(e.target.value) })}
                                                className="w-20 bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[10px]">
                                            <span className="text-gray-500">Spend: <span className="text-white font-bold">{currentSpend} cr</span></span>
                                            <span className="text-gray-500">Target: <span className="text-white font-bold">{currentLimit} cr</span></span>
                                        </div>
                                        <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-500 ${percent > 90 ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : percent > 70 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                                                style={{ width: `${percent}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </GlassCard>
            </div>
        </div>
    );
}

function MetricCard({ title, value, icon, subtitle }: any) {
    return (
        <GlassCard className="p-6 space-y-2">
            <div className="flex justify-between items-center text-gray-500">
                <span className="text-xs font-bold uppercase tracking-wider">{title}</span>
                {icon}
            </div>
            <div className="text-3xl font-black text-white">{value}</div>
            <div className="text-[10px] text-gray-500">{subtitle}</div>
        </GlassCard>
    );
}

function Toggle({ checked, onChange }: { checked: boolean, onChange: (val: boolean) => void }) {
    return (
        <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
            <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
    );
}
