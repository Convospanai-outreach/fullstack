"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  Database,
  RefreshCw,
  Server,
  Shield,
  Wallet,
} from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";

type ServiceStatus = "UP" | "DOWN" | "DEGRADED" | "NOT_CONFIGURED";

type ServiceHealth = {
  status: ServiceStatus;
  message: string;
  latencyMs?: number;
  endpoint?: string;
  optional?: boolean;
};

type RuntimeOverview = {
  timestamp: string;
  range: string;
  windowStart: string;
  services: {
    web: ServiceHealth;
    api: ServiceHealth;
    database: ServiceHealth;
    redis: ServiceHealth;
    edge: ServiceHealth;
    extension: ServiceHealth;
  };
  dataFlow: {
    leadsCreated: number;
    campaignsCreated: number;
    emailsSent: number;
    repliesReceived: number;
    emailsOpened: number;
    emailsClicked: number;
    openRate: number;
    clickRate: number;
    replyRate: number;
  };
  tokenFlow: {
    requests: number;
    tokensIn: number;
    tokensOut: number;
    totalTokens: number;
    totalCost: number;
    avgLatencyMs: number;
    costPerThousandTokens: number;
    providerMatrix: Array<{
      provider: string;
      requests: number;
      tokensIn: number;
      tokensOut: number;
      cost: number;
    }>;
    topModels: Array<{
      model: string;
      requests: number;
      tokensIn: number;
      tokensOut: number;
      cost: number;
    }>;
  };
  operationalMatrix: {
    jobsByStatus: Array<{ status: string; count: number }>;
    topSystemEvents: Array<{ name: string; count: number }>;
  };
};

const statusClass: Record<ServiceStatus, string> = {
  UP: "bg-emerald-400",
  DOWN: "bg-red-400",
  DEGRADED: "bg-amber-400",
  NOT_CONFIGURED: "bg-slate-400",
};

const shortRangeLabel: Record<string, string> = {
  "1h": "Last 1h",
  "24h": "Last 24h",
  "7d": "Last 7d",
  "30d": "Last 30d",
};

export default function AdminHealthPage() {
  const [range, setRange] = useState("24h");
  const [overview, setOverview] = useState<RuntimeOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = async (nextRange = range) => {
    setLoading(true);
    setError(null);
    try {
      const apiBase = (process.env["NEXT_PUBLIC_API_URL"] || "/api/proxy");
      const res = await fetch(`${apiBase}/admin/runtime-overview?range=${nextRange}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as RuntimeOverview;
      setOverview(data);
    } catch (fetchError: any) {
      setOverview(null);
      setError(fetchError?.message || "Failed to load runtime overview");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview(range);
  }, [range]);

  return (
    <main className="p-8 min-h-screen bg-black relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-12%] left-[-8%] w-[48%] h-[48%] bg-cyan-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-12%] w-[50%] h-[50%] bg-emerald-900/20 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <SectionHeader
            title="Runtime Control Matrix"
            subtitle="Live service status, data flow, token flow, and operational health"
          />
          <div className="flex flex-wrap items-center gap-2">
            {["1h", "24h", "7d", "30d"].map((value) => (
              <Button
                key={value}
                variant={range === value ? "default" : "outline"}
                onClick={() => setRange(value)}
              >
                {shortRangeLabel[value]}
              </Button>
            ))}
            <Button variant="outline" onClick={() => fetchOverview(range)}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {loading && <GlassCard className="p-6 text-gray-200">Loading runtime overview...</GlassCard>}
        {!loading && error && (
          <GlassCard className="p-6 border border-red-400/20 text-red-200">
            Failed to load runtime overview: {error}
          </GlassCard>
        )}

        {!loading && overview && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
              {Object.entries(overview.services).map(([serviceName, service]) => (
                <GlassCard key={serviceName} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-gray-400">{serviceName}</div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${
                          service.optional && service.status !== "UP" ? "bg-amber-400" : statusClass[service.status]
                        }`} />
                        <span className="text-sm font-semibold text-white">{service.status}</span>
                        {service.optional && (
                          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-gray-400">
                            optional
                          </span>
                        )}
                      </div>
                    </div>
                    <Server className="h-4 w-4 text-gray-400" />
                  </div>
                  <p className="mt-3 text-sm text-gray-300">{service.message}</p>
                  {typeof service.latencyMs === "number" && (
                    <p className="mt-2 text-xs text-gray-400">Latency: {service.latencyMs}ms</p>
                  )}
                  {service.endpoint && (
                    <p className="mt-1 text-[11px] text-gray-500 break-all">{service.endpoint}</p>
                  )}
                </GlassCard>
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <GlassCard className="p-6 xl:col-span-2">
                <div className="flex items-center gap-2 text-white">
                  <Activity className="h-5 w-5 text-cyan-300" />
                  <h3 className="text-lg font-semibold">Data Flow</h3>
                </div>
                <p className="text-sm text-gray-400 mt-1">Lead to campaign to email to reply pipeline</p>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <FlowMetric title="Leads Created" value={overview.dataFlow.leadsCreated.toLocaleString()} />
                  <FlowMetric title="Campaigns Created" value={overview.dataFlow.campaignsCreated.toLocaleString()} />
                  <FlowMetric title="Emails Sent" value={overview.dataFlow.emailsSent.toLocaleString()} />
                  <FlowMetric title="Replies Received" value={overview.dataFlow.repliesReceived.toLocaleString()} />
                </div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
                  <StageChip label="Lead Ingest" value={overview.dataFlow.leadsCreated} />
                  <ArrowRight className="mx-auto h-4 w-4 text-gray-500 hidden md:block" />
                  <StageChip label="Campaign Ops" value={overview.dataFlow.campaignsCreated} />
                  <ArrowRight className="mx-auto h-4 w-4 text-gray-500 hidden md:block" />
                  <StageChip label="Email Execution" value={overview.dataFlow.emailsSent} />
                </div>

                <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <FlowRate label="Open Rate" value={overview.dataFlow.openRate} />
                  <FlowRate label="Click Rate" value={overview.dataFlow.clickRate} />
                  <FlowRate label="Reply Rate" value={overview.dataFlow.replyRate} />
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <div className="flex items-center gap-2 text-white">
                  <Wallet className="h-5 w-5 text-emerald-300" />
                  <h3 className="text-lg font-semibold">Token Flow</h3>
                </div>
                <p className="text-sm text-gray-400 mt-1">LLM traffic and cost in selected window</p>
                <div className="mt-5 space-y-3">
                  <MiniStat label="Requests" value={overview.tokenFlow.requests.toLocaleString()} />
                  <MiniStat label="Tokens In" value={overview.tokenFlow.tokensIn.toLocaleString()} />
                  <MiniStat label="Tokens Out" value={overview.tokenFlow.tokensOut.toLocaleString()} />
                  <MiniStat label="Total Tokens" value={overview.tokenFlow.totalTokens.toLocaleString()} />
                  <MiniStat label="Total Cost" value={`$${overview.tokenFlow.totalCost.toFixed(2)}`} />
                  <MiniStat label="Avg Latency" value={`${overview.tokenFlow.avgLatencyMs.toFixed(0)}ms`} />
                  <MiniStat
                    label="Cost / 1K Tokens"
                    value={`$${overview.tokenFlow.costPerThousandTokens.toFixed(4)}`}
                  />
                </div>
              </GlassCard>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <GlassCard className="p-6">
                <h3 className="text-lg font-semibold text-white">Provider Matrix</h3>
                <p className="text-sm text-gray-400 mt-1">Token and cost split by provider</p>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-gray-400 border-b border-white/10">
                      <tr>
                        <th className="py-2 pr-3">Provider</th>
                        <th className="py-2 pr-3 text-right">Req</th>
                        <th className="py-2 pr-3 text-right">In</th>
                        <th className="py-2 pr-3 text-right">Out</th>
                        <th className="py-2 text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-gray-200">
                      {overview.tokenFlow.providerMatrix.length === 0 && (
                        <tr>
                          <td className="py-3 text-gray-400" colSpan={5}>
                            No token usage in this range.
                          </td>
                        </tr>
                      )}
                      {overview.tokenFlow.providerMatrix.map((provider) => (
                        <tr key={provider.provider}>
                          <td className="py-2 pr-3 font-medium text-white">{provider.provider}</td>
                          <td className="py-2 pr-3 text-right">{provider.requests.toLocaleString()}</td>
                          <td className="py-2 pr-3 text-right">{provider.tokensIn.toLocaleString()}</td>
                          <td className="py-2 pr-3 text-right">{provider.tokensOut.toLocaleString()}</td>
                          <td className="py-2 text-right">${provider.cost.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <div className="flex items-center gap-2 text-white">
                  <Shield className="h-5 w-5 text-indigo-300" />
                  <h3 className="text-lg font-semibold">Operational Matrix</h3>
                </div>
                <p className="text-sm text-gray-400 mt-1">Queue health and event pressure points</p>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-gray-400 mb-2">Jobs by status</p>
                    <div className="space-y-2">
                      {overview.operationalMatrix.jobsByStatus.length === 0 && (
                        <div className="text-sm text-gray-400">No jobs in this range.</div>
                      )}
                      {overview.operationalMatrix.jobsByStatus.map((job) => (
                        <div key={job.status} className="flex items-center justify-between text-sm">
                          <span className="text-gray-200">{job.status}</span>
                          <span className="text-white font-semibold">{job.count.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-gray-400 mb-2">Top system events</p>
                    <div className="space-y-2">
                      {overview.operationalMatrix.topSystemEvents.length === 0 && (
                        <div className="text-sm text-gray-400">No events in this range.</div>
                      )}
                      {overview.operationalMatrix.topSystemEvents.map((event) => (
                        <div key={event.name} className="flex items-center justify-between text-sm">
                          <span className="text-gray-200 truncate pr-2">{event.name}</span>
                          <span className="text-white font-semibold">{event.count.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </GlassCard>
            </div>

            <GlassCard className="p-4 flex items-center gap-3 text-xs text-gray-400">
              <Database className="h-4 w-4 text-cyan-300" />
              <span>
                Updated {new Date(overview.timestamp).toLocaleString()} | Window start{" "}
                {new Date(overview.windowStart).toLocaleString()}
              </span>
            </GlassCard>
          </>
        )}
      </div>
    </main>
  );
}

function FlowMetric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs uppercase tracking-[0.14em] text-gray-400">{title}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function StageChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-center">
      <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value.toLocaleString()}</p>
    </div>
  );
}

function FlowRate({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs uppercase tracking-[0.14em] text-gray-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-emerald-300">{value.toFixed(2)}%</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm border-b border-white/5 pb-2">
      <span className="text-gray-400">{label}</span>
      <span className="text-white font-medium">{value}</span>
    </div>
  );
}
