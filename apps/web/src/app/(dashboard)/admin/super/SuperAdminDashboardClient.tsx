"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Cpu, Database, KeyRound, RefreshCw, Shield, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";
import { SectionHeader } from "@/components/ui/SectionHeader";

type SuperOverview = {
    range: string;
    generatedAt: string;
    windowStart: string;
    totals: {
        users: number;
        teams: number;
        apiKeys: number;
        activeApiKeys: number;
        leads: number;
        campaigns: number;
        llmRequests: number;
        tokensIn: number;
        tokensOut: number;
        tokenCost: number;
        creditsSpent: number;
        auditEvents: number;
        systemEvents: number;
        userAttributedRequests: number;
        userAttributedTokens: number;
    };
    users: Array<{
        id: string;
        email: string;
        name?: string | null;
        role: string;
        enterpriseRole: string;
        credits: number;
        teamCount: number;
        creditsSpent: number;
        llmRequests: number;
        tokensIn: number;
        tokensOut: number;
        tokenCost: number;
        usageAttribution: "user" | "team";
        teams: Array<{ id: string; name: string; role: string; status: string }>;
    }>;
    teams: Array<{
        id: string;
        name: string;
        credits: number;
        memberCount: number;
        leadCount: number;
        campaignCount: number;
        apiKeyCount: number;
        activeApiKeyCount: number;
        lastApiKeyUsedAt?: string | null;
        llmRequests: number;
        tokensIn: number;
        tokensOut: number;
        tokenCost: number;
        creditsSpent: number;
    }>;
    apiKeys: Array<{
        id: string;
        name: string;
        scopes: string[];
        isActive: boolean;
        lastUsedAt?: string | null;
        createdAt: string;
        teamId: string;
        teamName: string;
    }>;
    providers: Array<{ provider: string; requests: number; tokensIn: number; tokensOut: number; cost: number }>;
    models: Array<{ model: string; requests: number; tokensIn: number; tokensOut: number; cost: number }>;
    recentAudit: Array<{
        id: string;
        action: string;
        entity: string;
        entityId?: string | null;
        createdAt: string;
        user?: { email?: string | null; enterpriseRole?: string | null } | null;
        team?: { name?: string | null } | null;
    }>;
    recentSystemEvents: Array<{
        id: string;
        type: string;
        name: string;
        teamId: string;
        timestamp: string;
    }>;
};

const rangeLabels: Record<string, string> = {
    "7d": "Last 7d",
    "30d": "Last 30d",
    "90d": "Last 90d",
};

function compactNumber(value: number) {
    return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
}

function money(value: number) {
    return `$${(value || 0).toFixed(2)}`;
}

function dateLabel(value?: string | null) {
    if (!value) return "Never";
    return new Date(value).toLocaleDateString();
}

export default function SuperAdminDashboardClient() {
    const [range, setRange] = useState("30d");
    const [data, setData] = useState<SuperOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = async (nextRange = range) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/proxy/admin/super/overview?range=${nextRange}`, {
                cache: "no-store",
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            setData(await response.json());
        } catch (loadError: any) {
            setData(null);
            setError(loadError?.message || "Failed to load super admin overview");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load(range);
    }, [range]);

    const summary = useMemo(() => {
        if (!data) return [];
        return [
            { label: "Users", value: data.totals.users.toLocaleString(), icon: Users },
            { label: "Teams", value: data.totals.teams.toLocaleString(), icon: Database },
            { label: "Active API Keys", value: `${data.totals.activeApiKeys}/${data.totals.apiKeys}`, icon: KeyRound },
            { label: "LLM Requests", value: compactNumber(data.totals.llmRequests), icon: Cpu },
            { label: "User-Attributed", value: compactNumber(data.totals.userAttributedRequests), icon: Shield },
            { label: "Tokens", value: compactNumber(data.totals.tokensIn + data.totals.tokensOut), icon: Activity },
            { label: "Token Cost", value: money(data.totals.tokenCost), icon: Wallet },
        ];
    }, [data]);

    return (
        <div className="min-h-screen bg-black p-6 text-white">
            <div className="mx-auto max-w-7xl space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <SectionHeader
                        title="Super Admin Command Center"
                        subtitle="All workspaces, users, API keys, token usage, credits, and platform activity"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                        {["7d", "30d", "90d"].map((value) => (
                            <Button key={value} variant={range === value ? "default" : "outline"} onClick={() => setRange(value)}>
                                {rangeLabels[value]}
                            </Button>
                        ))}
                        <Button variant="outline" onClick={() => load(range)}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Refresh
                        </Button>
                    </div>
                </div>

                <GlassCard className="border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-100">
                    New LLM usage is attributed to users when the request carries an actor. Older rows without actor IDs fall back to workspace attribution.
                </GlassCard>

                {loading && <GlassCard className="p-6 text-slate-200">Loading platform overview...</GlassCard>}
                {!loading && error && <GlassCard className="border-red-400/20 p-6 text-red-200">Failed to load overview: {error}</GlassCard>}

                {!loading && data && (
                    <>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                            {summary.map((item) => (
                                <GlassCard key={item.label} className="p-5">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
                                            <p className="mt-2 text-2xl font-semibold text-white">{item.value}</p>
                                        </div>
                                        <item.icon className="h-5 w-5 text-cyan-300" />
                                    </div>
                                </GlassCard>
                            ))}
                        </div>

                        <div className="grid gap-4 xl:grid-cols-2">
                            <TablePanel title="Users and Usage" icon={Users}>
                                <thead className="text-xs uppercase text-slate-400">
                                    <tr>
                                        <th className="py-3 pr-4 text-left">User</th>
                                        <th className="py-3 pr-4 text-left">Role</th>
                                        <th className="py-3 pr-4 text-right">Teams</th>
                                        <th className="py-3 pr-4 text-right">Credits Spent</th>
                                        <th className="py-3 pr-4 text-left">Usage Source</th>
                                        <th className="py-3 pr-4 text-right">Requests</th>
                                        <th className="py-3 text-right">Cost</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {data.users.slice(0, 25).map((user) => (
                                        <tr key={user.id} className="text-sm text-slate-200">
                                            <td className="py-3 pr-4">
                                                <div className="font-medium text-white">{user.name || "Unnamed"}</div>
                                                <div className="text-xs text-slate-400">{user.email}</div>
                                            </td>
                                            <td className="py-3 pr-4">{user.enterpriseRole || user.role}</td>
                                            <td className="py-3 pr-4 text-right">{user.teamCount}</td>
                                            <td className="py-3 pr-4 text-right">{user.creditsSpent.toLocaleString()}</td>
                                            <td className="py-3 pr-4">
                                                <span className={`rounded-full px-2 py-1 text-xs ${
                                                    user.usageAttribution === "user"
                                                        ? "bg-emerald-400/10 text-emerald-200"
                                                        : "bg-amber-400/10 text-amber-200"
                                                }`}>
                                                    {user.usageAttribution === "user" ? "User exact" : "Team fallback"}
                                                </span>
                                            </td>
                                            <td className="py-3 pr-4 text-right">{user.llmRequests.toLocaleString()}</td>
                                            <td className="py-3 text-right">{money(user.tokenCost)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </TablePanel>

                            <TablePanel title="Teams and Workspaces" icon={Database}>
                                <thead className="text-xs uppercase text-slate-400">
                                    <tr>
                                        <th className="py-3 pr-4 text-left">Team</th>
                                        <th className="py-3 pr-4 text-right">Members</th>
                                        <th className="py-3 pr-4 text-right">Leads</th>
                                        <th className="py-3 pr-4 text-right">API Keys</th>
                                        <th className="py-3 pr-4 text-right">Requests</th>
                                        <th className="py-3 text-right">Cost</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {data.teams.slice(0, 25).map((team) => (
                                        <tr key={team.id} className="text-sm text-slate-200">
                                            <td className="py-3 pr-4">
                                                <div className="font-medium text-white">{team.name}</div>
                                                <div className="text-xs text-slate-400">{team.id}</div>
                                            </td>
                                            <td className="py-3 pr-4 text-right">{team.memberCount}</td>
                                            <td className="py-3 pr-4 text-right">{team.leadCount}</td>
                                            <td className="py-3 pr-4 text-right">{team.activeApiKeyCount}/{team.apiKeyCount}</td>
                                            <td className="py-3 pr-4 text-right">{team.llmRequests.toLocaleString()}</td>
                                            <td className="py-3 text-right">{money(team.tokenCost)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </TablePanel>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-3">
                            <TablePanel title="API Keys" icon={KeyRound}>
                                <thead className="text-xs uppercase text-slate-400">
                                    <tr>
                                        <th className="py-3 pr-4 text-left">Key</th>
                                        <th className="py-3 pr-4 text-left">Team</th>
                                        <th className="py-3 pr-4 text-left">Status</th>
                                        <th className="py-3 text-right">Last Used</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {data.apiKeys.slice(0, 20).map((key) => (
                                        <tr key={key.id} className="text-sm text-slate-200">
                                            <td className="py-3 pr-4">
                                                <div className="font-medium text-white">{key.name}</div>
                                                <div className="text-xs text-slate-400">{key.scopes.join(", ") || "No scopes"}</div>
                                            </td>
                                            <td className="py-3 pr-4">{key.teamName}</td>
                                            <td className="py-3 pr-4">{key.isActive ? "Active" : "Disabled"}</td>
                                            <td className="py-3 text-right">{dateLabel(key.lastUsedAt)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </TablePanel>

                            <TablePanel title="Provider Usage" icon={Cpu}>
                                <thead className="text-xs uppercase text-slate-400">
                                    <tr>
                                        <th className="py-3 pr-4 text-left">Provider</th>
                                        <th className="py-3 pr-4 text-right">Requests</th>
                                        <th className="py-3 pr-4 text-right">Tokens</th>
                                        <th className="py-3 text-right">Cost</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {data.providers.map((provider) => (
                                        <tr key={provider.provider} className="text-sm text-slate-200">
                                            <td className="py-3 pr-4">{provider.provider}</td>
                                            <td className="py-3 pr-4 text-right">{provider.requests}</td>
                                            <td className="py-3 pr-4 text-right">{compactNumber(provider.tokensIn + provider.tokensOut)}</td>
                                            <td className="py-3 text-right">{money(provider.cost)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </TablePanel>

                            <TablePanel title="Recent Activity" icon={Shield}>
                                <tbody className="divide-y divide-white/5">
                                    {[...data.recentAudit.map((item) => ({
                                        id: item.id,
                                        label: `${item.action} ${item.entity}`,
                                        meta: `${item.user?.email || "System"} · ${item.team?.name || "No team"}`,
                                        time: item.createdAt,
                                    })), ...data.recentSystemEvents.map((item) => ({
                                        id: item.id,
                                        label: `${item.type}: ${item.name}`,
                                        meta: item.teamId,
                                        time: item.timestamp,
                                    }))].slice(0, 12).map((item) => (
                                        <tr key={item.id} className="text-sm text-slate-200">
                                            <td className="py-3 pr-4">
                                                <div className="font-medium text-white">{item.label}</div>
                                                <div className="text-xs text-slate-400">{item.meta}</div>
                                            </td>
                                            <td className="py-3 text-right text-xs text-slate-400">{dateLabel(item.time)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </TablePanel>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function TablePanel({ title, icon: Icon, children }: { title: string; icon: typeof Users; children: React.ReactNode }) {
    return (
        <GlassCard className="overflow-hidden p-5">
            <div className="mb-4 flex items-center gap-2">
                <Icon className="h-5 w-5 text-cyan-300" />
                <h2 className="text-lg font-semibold text-white">{title}</h2>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[560px]">{children}</table>
            </div>
        </GlassCard>
    );
}
