"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  CreditCard,
  Database,
  DollarSign,
  KeyRound,
  Layers,
  Lock,
  RefreshCw,
  Server,
  Shield,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Telemetry } from "@/lib/analytics/telemetry";

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
    newUsersInWindow?: number;
    activeUsersInWindow?: number;
    totalRevenueCents?: number;
    subscriptionsCount?: number;
    activeSubscriptionsCount?: number;
    failedJobsCount?: number;
    completedJobsCount?: number;
    queuedJobsCount?: number;
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
  billing?: {
    totalRevenueCents: number;
    subscriptions: Array<{
      id: string;
      status: string;
      gateway: string;
      currentPeriodEnd: string;
      createdAt: string;
      planName: string;
      monthlyPrice: number;
      userEmail: string;
      userName?: string | null;
    }>;
    invoices: Array<{
      id: string;
      invoiceNumber: string;
      type: string;
      description: string;
      amount: number;
      currency: string;
      gateway: string;
      status: string;
      createdAt: string;
      teamName?: string | null;
      userEmail?: string | null;
    }>;
  };
  jobHealth?: {
    counts: Record<string, number>;
    recentFailed: Array<{
      id: string;
      type: string;
      error?: string | null;
      attempts: number;
      createdAt: string;
      teamId?: string | null;
    }>;
  };
  outages?: {
    recentEvents: Array<{
      id: string;
      type: string;
      name: string;
      teamId?: string | null;
      timestamp: string;
    }>;
  };
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
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type TabType = "activity" | "usage" | "billing" | "api" | "health";

export default function SuperAdminDashboardClient() {
  const [range, setRange] = useState("30d");
  const [activeTab, setActiveTab] = useState<TabType>("activity");
  const [data, setData] = useState<SuperOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState("");

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
      const json = await response.json();
      setData(json);
      Telemetry.adminViewAccessed("super_overview");
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
    const revenueDollars = (data.totals.totalRevenueCents || 0) / 100;
    return [
      {
        label: "Total Users",
        value: data.totals.users.toLocaleString(),
        sub: `${data.totals.activeUsersInWindow || 0} active in ${range}`,
        icon: Users,
        color: "text-cyan-300",
      },
      {
        label: "Platform Revenue",
        value: money(revenueDollars),
        sub: `${data.totals.activeSubscriptionsCount || 0} active subs`,
        icon: DollarSign,
        color: "text-emerald-400",
      },
      {
        label: "LLM Requests",
        value: compactNumber(data.totals.llmRequests),
        sub: `${money(data.totals.tokenCost)} est. cost`,
        icon: Cpu,
        color: "text-indigo-300",
      },
      {
        label: "Tokens Consumed",
        value: compactNumber(data.totals.tokensIn + data.totals.tokensOut),
        sub: `${data.totals.teams.toLocaleString()} teams`,
        icon: Activity,
        color: "text-warning",
      },
      {
        label: "Active API Keys",
        value: `${data.totals.activeApiKeys}/${data.totals.apiKeys}`,
        sub: "across all workspaces",
        icon: KeyRound,
        color: "text-purple-300",
      },
      {
        label: "Job Queue Health",
        value: `${data.totals.completedJobsCount || 0} ok`,
        sub: data.totals.failedJobsCount ? `${data.totals.failedJobsCount} failed` : "0 failures",
        icon: data.totals.failedJobsCount ? AlertTriangle : CheckCircle2,
        color: data.totals.failedJobsCount ? "text-destructive" : "text-emerald-400",
      },
    ];
  }, [data, range]);

  const filteredUsers = useMemo(() => {
    if (!data?.users) return [];
    if (!searchFilter.trim()) return data.users;
    const q = searchFilter.toLowerCase();
    return data.users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        u.role.toLowerCase().includes(q)
    );
  }, [data?.users, searchFilter]);

  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Security & Access Banner */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-warning">
                <Lock className="h-3 w-3" />
                INTERNAL ONLY · APP OWNER
              </span>
              <span className="text-xs text-muted-foreground">Restricted System Administration</span>
            </div>
            <SectionHeader
              title="Platform Administration Command Center"
              subtitle="Global cross-tenant analytics: User Activity, Token Consumption, Invoices, API Traffic & Service Health"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {["7d", "30d", "90d"].map((value) => (
              <Button
                key={value}
                size="sm"
                variant={range === value ? "default" : "outline"}
                onClick={() => setRange(value)}
              >
                {rangeLabels[value]}
              </Button>
            ))}
            <Button size="sm" variant="outline" onClick={() => load(range)} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Global Executive Metric Cards */}
        {loading && !data && (
          <GlassCard className="p-8 text-center text-muted-foreground">Loading platform telemetry...</GlassCard>
        )}
        {!loading && error && (
          <GlassCard className="border-red-500/30 bg-red-500/10 p-6 text-red-200">
            Failed to load admin overview: {error}
          </GlassCard>
        )}

        {data && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {summary.map((item) => (
                <GlassCard key={item.label} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        {item.label}
                      </p>
                      <p className="mt-1 text-2xl font-bold text-foreground">{item.value}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.sub}</p>
                    </div>
                    <item.icon className={`h-5 w-5 ${item.color}`} />
                  </div>
                </GlassCard>
              ))}
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-1 border-b border-border pb-2">
              <TabButton
                active={activeTab === "activity"}
                onClick={() => setActiveTab("activity")}
                icon={Users}
                label="User Activity & Telemetry"
                badge={data.users.length}
              />
              <TabButton
                active={activeTab === "usage"}
                onClick={() => setActiveTab("usage")}
                icon={Zap}
                label="Resource Usage & LLM Costs"
              />
              <TabButton
                active={activeTab === "billing"}
                onClick={() => setActiveTab("billing")}
                icon={CreditCard}
                label="Billing & Subscriptions"
                badge={data.billing?.subscriptions.length}
              />
              <TabButton
                active={activeTab === "api"}
                onClick={() => setActiveTab("api")}
                icon={Layers}
                label="API Calls & Workspaces"
                badge={data.teams.length}
              />
              <TabButton
                active={activeTab === "health"}
                onClick={() => setActiveTab("health")}
                icon={Server}
                label="Outages & Job Health"
                badge={data.totals.failedJobsCount ? `${data.totals.failedJobsCount} err` : undefined}
                badgeColor={data.totals.failedJobsCount ? "bg-rose-500/20 text-destructive" : undefined}
              />
            </div>

            {/* TAB 1: User Activity & Telemetry */}
            {activeTab === "activity" && (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Search users by email, name, role..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="w-72 rounded-lg border border-border bg-muted px-3 py-1.5 text-xs text-foreground placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                    />
                    <span className="text-xs text-muted-foreground">
                      Showing {filteredUsers.length} of {data.users.length} users
                    </span>
                  </div>
                </div>

                <GlassCard className="overflow-hidden p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-border bg-muted text-muted-foreground">
                        <tr>
                          <th className="py-3 px-4">User</th>
                          <th className="py-3 px-4">Role</th>
                          <th className="py-3 px-4 text-center">Workspaces</th>
                          <th className="py-3 px-4 text-right">Credits Balance</th>
                          <th className="py-3 px-4 text-right">Credits Spent</th>
                          <th className="py-3 px-4 text-right">LLM Calls</th>
                          <th className="py-3 px-4 text-right">Est. Cost</th>
                          <th className="py-3 px-4 text-center">Attribution</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border text-foreground">
                        {filteredUsers.slice(0, 50).map((user) => (
                          <tr key={user.id} className="hover:bg-muted">
                            <td className="py-3 px-4">
                              <div className="font-semibold text-foreground">{user.name || "Unnamed User"}</div>
                              <div className="text-muted-foreground">{user.email}</div>
                              <div className="text-[10px] text-muted-foreground font-mono">{user.id}</div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="rounded bg-muted px-2 py-0.5 font-medium text-foreground">
                                {user.enterpriseRole || user.role}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-cyan-300">
                                {user.teamCount}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-medium text-foreground">
                              {user.credits.toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-warning">
                              {user.creditsSpent.toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-right font-mono">{user.llmRequests.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right font-mono font-medium text-emerald-400">
                              {money(user.tokenCost)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] ${
                                  user.usageAttribution === "user"
                                    ? "bg-emerald-500/10 text-success"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {user.usageAttribution}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </GlassCard>
              </div>
            )}

            {/* TAB 2: Resource Usage & LLM Costs */}
            {activeTab === "usage" && (
              <div className="grid gap-6 lg:grid-cols-2">
                <GlassCard className="p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-cyan-300" />
                      LLM Usage by Provider
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {data.providers.map((p) => (
                      <div
                        key={p.provider}
                        className="flex items-center justify-between rounded-lg border border-border bg-muted p-3"
                      >
                        <div>
                          <p className="font-semibold text-foreground capitalize">{p.provider}</p>
                          <p className="text-xs text-muted-foreground">
                            {compactNumber(p.tokensIn + p.tokensOut)} tokens ({compactNumber(p.tokensIn)} in /{" "}
                            {compactNumber(p.tokensOut)} out)
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-emerald-400">{money(p.cost)}</p>
                          <p className="text-xs text-muted-foreground">{p.requests.toLocaleString()} requests</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </GlassCard>

                <GlassCard className="p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Zap className="h-4 w-4 text-indigo-400" />
                      Top Models Consumed
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {data.models.map((m) => (
                      <div
                        key={m.model}
                        className="flex items-center justify-between rounded-lg border border-border bg-muted p-2.5 text-xs"
                      >
                        <div>
                          <p className="font-mono text-foreground">{m.model}</p>
                          <p className="text-muted-foreground">{m.requests.toLocaleString()} calls</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-success">{money(m.cost)}</p>
                          <p className="text-muted-foreground">{compactNumber(m.tokensIn + m.tokensOut)} tok</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              </div>
            )}

            {/* TAB 3: Billing & Subscriptions */}
            {activeTab === "billing" && (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-3">
                  <GlassCard className="p-4">
                    <p className="text-xs uppercase text-muted-foreground">Total Billed In Window</p>
                    <p className="mt-1 text-2xl font-bold text-emerald-400">
                      {money((data.billing?.totalRevenueCents || 0) / 100)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {data.billing?.invoices.length || 0} recorded invoices
                    </p>
                  </GlassCard>
                  <GlassCard className="p-4">
                    <p className="text-xs uppercase text-muted-foreground">Active Subscriptions</p>
                    <p className="mt-1 text-2xl font-bold text-foreground">
                      {data.billing?.subscriptions.filter((s) => s.status === "active").length || 0}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {data.billing?.subscriptions.length || 0} total subscriber accounts
                    </p>
                  </GlassCard>
                  <GlassCard className="p-4">
                    <p className="text-xs uppercase text-muted-foreground">Platform Credits Spent</p>
                    <p className="mt-1 text-2xl font-bold text-warning">
                      {data.totals.creditsSpent.toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">consumed across all teams</p>
                  </GlassCard>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <GlassCard className="p-5">
                    <h3 className="mb-3 text-sm font-bold text-foreground flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-cyan-300" />
                      Active Subscriptions
                    </h3>
                    <div className="space-y-2 text-xs">
                      {(!data.billing?.subscriptions || data.billing.subscriptions.length === 0) && (
                        <p className="text-muted-foreground">No active subscriptions found.</p>
                      )}
                      {data.billing?.subscriptions.map((sub) => (
                        <div
                          key={sub.id}
                          className="flex items-center justify-between rounded-lg border border-border bg-muted p-3"
                        >
                          <div>
                            <p className="font-semibold text-foreground">{sub.userEmail}</p>
                            <p className="text-muted-foreground">
                              Plan: <span className="text-cyan-300">{sub.planName}</span> ({sub.gateway})
                            </p>
                          </div>
                          <div className="text-right">
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                sub.status === "active"
                                  ? "bg-emerald-500/10 text-success"
                                  : "bg-amber-500/10 text-warning"
                              }`}
                            >
                              {sub.status}
                            </span>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              Renews: {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </GlassCard>

                  <GlassCard className="p-5">
                    <h3 className="mb-3 text-sm font-bold text-foreground flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-emerald-400" />
                      Recent Invoices
                    </h3>
                    <div className="space-y-2 text-xs">
                      {(!data.billing?.invoices || data.billing.invoices.length === 0) && (
                        <p className="text-muted-foreground">No invoices in this time range.</p>
                      )}
                      {data.billing?.invoices.slice(0, 10).map((inv) => (
                        <div
                          key={inv.id}
                          className="flex items-center justify-between rounded-lg border border-border bg-muted p-2.5"
                        >
                          <div>
                            <p className="font-semibold text-foreground">{inv.invoiceNumber}</p>
                            <p className="text-muted-foreground">{inv.description || inv.type}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono font-bold text-emerald-400">
                              {inv.currency.toUpperCase()} {(inv.amount / 100).toFixed(2)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">{dateLabel(inv.createdAt)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                </div>
              </div>
            )}

            {/* TAB 4: API Calls & Workspaces */}
            {activeTab === "api" && (
              <div className="space-y-6">
                <GlassCard className="p-5">
                  <h3 className="mb-3 text-sm font-bold text-foreground flex items-center gap-2">
                    <Database className="h-4 w-4 text-cyan-300" />
                    Workspaces & API Consumption
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-border text-muted-foreground">
                        <tr>
                          <th className="py-2.5 px-3">Workspace</th>
                          <th className="py-2.5 px-3 text-center">Members</th>
                          <th className="py-2.5 px-3 text-center">Leads</th>
                          <th className="py-2.5 px-3 text-center">Campaigns</th>
                          <th className="py-2.5 px-3 text-center">API Keys</th>
                          <th className="py-2.5 px-3 text-right">LLM Requests</th>
                          <th className="py-2.5 px-3 text-right">Token Cost</th>
                          <th className="py-2.5 px-3 text-right">Credits Spent</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border text-foreground">
                        {data.teams.map((t) => (
                          <tr key={t.id} className="hover:bg-muted">
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-foreground">{t.name}</div>
                              <div className="font-mono text-[10px] text-muted-foreground">{t.id}</div>
                            </td>
                            <td className="py-2.5 px-3 text-center">{t.memberCount}</td>
                            <td className="py-2.5 px-3 text-center">{t.leadCount}</td>
                            <td className="py-2.5 px-3 text-center">{t.campaignCount}</td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="font-mono">{t.activeApiKeyCount}/{t.apiKeyCount}</span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono">{t.llmRequests.toLocaleString()}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-emerald-400">{money(t.tokenCost)}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-warning">{t.creditsSpent.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </GlassCard>
              </div>
            )}

            {/* TAB 5: Outages, Service Health & Job Failures */}
            {activeTab === "health" && (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-4">
                  <GlassCard className="p-4 border-emerald-500/20 bg-emerald-500/5">
                    <p className="text-xs uppercase text-muted-foreground">PostgreSQL (Neon)</p>
                    <p className="mt-1 text-lg font-bold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" /> Operational
                    </p>
                  </GlassCard>
                  <GlassCard className="p-4 border-emerald-500/20 bg-emerald-500/5">
                    <p className="text-xs uppercase text-muted-foreground">API Gateway (Oracle VM)</p>
                    <p className="mt-1 text-lg font-bold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" /> Healthy
                    </p>
                  </GlassCard>
                  <GlassCard className="p-4 border-emerald-500/20 bg-emerald-500/5">
                    <p className="text-xs uppercase text-muted-foreground">Background Worker</p>
                    <p className="mt-1 text-lg font-bold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" /> Active
                    </p>
                  </GlassCard>
                  <GlassCard className={`p-4 ${data.totals.failedJobsCount ? "border-rose-500/30 bg-rose-500/10" : "border-border"}`}>
                    <p className="text-xs uppercase text-muted-foreground">Job Failures</p>
                    <p className={`mt-1 text-lg font-bold ${data.totals.failedJobsCount ? "text-destructive" : "text-foreground"}`}>
                      {data.totals.failedJobsCount || 0} in {range}
                    </p>
                  </GlassCard>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <GlassCard className="p-5">
                    <h3 className="mb-3 text-sm font-bold text-foreground flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      Recent Failed Worker Jobs
                    </h3>
                    <div className="space-y-2 text-xs">
                      {(!data.jobHealth?.recentFailed || data.jobHealth.recentFailed.length === 0) && (
                        <p className="text-muted-foreground">No failed worker jobs recorded in this window.</p>
                      )}
                      {data.jobHealth?.recentFailed.map((job) => (
                        <div
                          key={job.id}
                          className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-destructive">{job.type}</span>
                            <span className="text-[10px] text-muted-foreground">{dateLabel(job.createdAt)}</span>
                          </div>
                          <p className="mt-1 font-mono text-[11px] text-destructive">{job.error || "Unknown error"}</p>
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            Attempts: {job.attempts} · Team: {job.teamId || "None"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </GlassCard>

                  <GlassCard className="p-5">
                    <h3 className="mb-3 text-sm font-bold text-foreground flex items-center gap-2">
                      <Shield className="h-4 w-4 text-amber-400" />
                      Recent System Events & Outage Logs
                    </h3>
                    <div className="space-y-2 text-xs">
                      {(!data.outages?.recentEvents || data.outages.recentEvents.length === 0) && (
                        <p className="text-muted-foreground">No critical outage events logged in this window.</p>
                      )}
                      {data.outages?.recentEvents.map((evt) => (
                        <div
                          key={evt.id}
                          className="flex items-center justify-between rounded-lg border border-border bg-muted p-2.5"
                        >
                          <div>
                            <span className="font-semibold text-foreground">{evt.name}</span>
                            <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              {evt.type}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">{dateLabel(evt.timestamp)}</span>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  badge,
  badgeColor = "bg-muted text-foreground",
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Users;
  label: string;
  badge?: number | string | undefined;
  badgeColor?: string | undefined;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
        active
          ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/30"
          : "text-muted-foreground hover:bg-background border border-input hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      {badge !== undefined && (
        <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${badgeColor}`}>
          {badge}
        </span>
      )}
    </button>
  );
}
