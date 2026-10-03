"use client";

import { useEffect, useState } from "react";
import { Flag, Layers, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";

type FeatureFlagRow = { key: string; description: string; layer: string; defaultValue: boolean; override: boolean | null };
type OptionalFeature = { key: string; label: string; description: string; disabledByPlatform: boolean };
type Policy = {
  productMode: string;
  productSurface: string | null;
  maxDailyActions: number;
  maxCampaigns: number;
  maxAgents: number;
  maxCreditsPerUser: number;
  allowInMail: boolean;
  allowScraping: boolean;
  allowUploads: boolean;
  requiresApprovalForCampaign: boolean;
  requiresApprovalForOverage: boolean;
  detectPII: boolean;
};
type TeamState = { id: string; name: string; credits: number; storedFeatures: string[] | null; effectiveFeatures: string[]; policy: Policy | null };

// Schema defaults for a team that has no OrganizationPolicy row yet.
const DEFAULT_POLICY: Policy = {
  productMode: "ENTERPRISE_CORE",
  productSurface: "outreach",
  maxDailyActions: 200,
  maxCampaigns: 10,
  maxAgents: 5,
  maxCreditsPerUser: 50,
  allowInMail: false,
  allowScraping: false,
  allowUploads: true,
  requiresApprovalForCampaign: false,
  requiresApprovalForOverage: true,
  detectPII: false,
};
const LIMITS: Array<[keyof Policy, string]> = [
  ["maxDailyActions", "Daily actions"],
  ["maxCampaigns", "Campaigns"],
  ["maxAgents", "Agents"],
  ["maxCreditsPerUser", "Credits per user"],
];
const SWITCHES: Array<[keyof Policy, string]> = [
  ["allowInMail", "Allow LinkedIn InMail"],
  ["allowScraping", "Allow scraping"],
  ["allowUploads", "Allow uploads"],
  ["requiresApprovalForCampaign", "Campaigns need approval"],
  ["requiresApprovalForOverage", "Credit overage needs approval"],
  ["detectPII", "Detect personal data"],
];

async function call<T>(url: string, init: RequestInit | undefined, onLoggedOut: () => void): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    ...init,
    ...(init?.body ? { headers: { "Content-Type": "application/json" } } : {}),
  });
  if (res.status === 401) {
    onLoggedOut();
    throw new Error("Signed out");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json as T;
}

export default function FeaturesTab({ teams, onLoggedOut }: { teams: Array<{ id: string; name: string }>; onLoggedOut: () => void }) {
  const [flags, setFlags] = useState<FeatureFlagRow[]>([]);
  const [features, setFeatures] = useState<OptionalFeature[]>([]);
  const [teamId, setTeamId] = useState("");
  const [team, setTeam] = useState<TeamState | null>(null);
  const [teamFeatures, setTeamFeatures] = useState<Set<string>>(new Set());
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void run(async () => {
      const [flagRes, featureRes] = await Promise.all([
        call<{ flags: FeatureFlagRow[] }>("/api/superadmin/flags", undefined, onLoggedOut),
        call<{ features: OptionalFeature[] }>("/api/superadmin/features", undefined, onLoggedOut),
      ]);
      setFlags(flagRes.flags);
      setFeatures(featureRes.features);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showTeam = (state: TeamState) => {
    setTeam(state);
    setTeamFeatures(new Set(state.storedFeatures ?? state.effectiveFeatures));
    setPolicy(state.policy ?? DEFAULT_POLICY);
  };

  useEffect(() => {
    if (!teamId) return;
    void run(async () => showTeam(await call<TeamState>(`/api/superadmin/teams/${teamId}`, undefined, onLoggedOut)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const setFlag = (key: string, enabled: boolean | null) =>
    run(async () => {
      const res = await call<{ flags: FeatureFlagRow[] }>("/api/superadmin/flags", { method: "POST", body: JSON.stringify({ key, enabled }) }, onLoggedOut);
      setFlags(res.flags);
    });

  const setPlatformFeature = (key: string, disabled: boolean) =>
    run(async () => {
      const res = await call<{ features: OptionalFeature[] }>(
        "/api/superadmin/features",
        { method: "POST", body: JSON.stringify({ key, disabled }) },
        onLoggedOut
      );
      setFeatures(res.features);
    });

  const saveTeam = (body: object) =>
    run(async () => {
      showTeam(await call<TeamState>(`/api/superadmin/teams/${teamId}`, { method: "PUT", body: JSON.stringify(body) }, onLoggedOut));
      setMessage("Saved.");
    });

  const adjustCredits = () =>
    run(async () => {
      const amount = Number(creditAmount);
      if (!window.confirm(`${amount > 0 ? "Add" : "Remove"} ${Math.abs(amount)} credits ${amount > 0 ? "to" : "from"} ${team?.name}?`)) return;
      const res = await call<{ credits: number }>(
        `/api/superadmin/teams/${teamId}/credits`,
        { method: "POST", body: JSON.stringify({ amount, reason: creditReason }) },
        onLoggedOut
      );
      setTeam((prev) => (prev ? { ...prev, credits: res.credits } : prev));
      setCreditAmount("");
      setCreditReason("");
      setMessage(`Credits now ${res.credits}.`);
    });

  const platformOff = new Set(features.filter((f) => f.disabledByPlatform).map((f) => f.key));

  return (
    <div className="space-y-6">
      {message && <p className="text-xs text-muted-foreground">{message}</p>}

      <GlassCard className="p-5">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-foreground">
          <Flag className="h-4 w-4 text-cyan-400" /> Platform feature flags
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">
          These apply to every team. A team&apos;s product mode can still keep a flag off for that team.
        </p>
        <div className="space-y-2">
          {flags.map((flag) => {
            const effective = flag.override ?? flag.defaultValue;
            return (
              <div key={flag.key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-xs">
                <div>
                  <p className="font-semibold text-foreground">{flag.description}</p>
                  <p className="text-muted-foreground">
                    {flag.key} · default {flag.defaultValue ? "on" : "off"} · now{" "}
                    <span className={effective ? "text-emerald-400" : "text-warning"}>{effective ? "on" : "off"}</span>
                    {flag.override !== null ? " (overridden)" : ""}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant={flag.override === true ? "default" : "outline"} disabled={busy} onClick={() => void setFlag(flag.key, true)}>
                    On
                  </Button>
                  <Button size="sm" variant={flag.override === false ? "default" : "outline"} disabled={busy} onClick={() => void setFlag(flag.key, false)}>
                    Off
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy || flag.override === null} onClick={() => void setFlag(flag.key, null)}>
                    Default
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-foreground">
          <Layers className="h-4 w-4 text-cyan-400" /> Optional features: platform switch
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Switching a feature off hides it for every team, whatever the team chose. Teams keep their own choice for when it is switched back on.
        </p>
        <div className="grid gap-2 md:grid-cols-2">
          {features.map((feature) => (
            <div key={feature.key} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 text-xs">
              <div>
                <p className="font-semibold text-foreground">{feature.label}</p>
                <p className={feature.disabledByPlatform ? "text-warning" : "text-muted-foreground"}>
                  {feature.disabledByPlatform ? "Off for everyone" : "Teams decide"}
                </p>
              </div>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void setPlatformFeature(feature.key, !feature.disabledByPlatform)}>
                {feature.disabledByPlatform ? "Allow" : "Turn off for all"}
              </Button>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
          <SlidersHorizontal className="h-4 w-4 text-cyan-400" /> Team settings
        </h3>
        <select
          aria-label="Team"
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          className="mb-4 w-full max-w-md rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
        >
          <option value="">Choose a team...</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        {team && (
          <div className="mb-6 flex flex-wrap items-end gap-2 rounded-lg border border-border p-3 text-xs">
            <div className="mr-4">
              <p className="uppercase text-muted-foreground">Credits</p>
              <p className="text-lg font-bold text-foreground">{team.credits.toLocaleString()}</p>
            </div>
            <input
              type="number"
              aria-label="Credit change"
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              placeholder="+500 or -100"
              className="w-32 rounded border border-input bg-background px-2 py-1"
            />
            <input
              aria-label="Reason"
              value={creditReason}
              onChange={(e) => setCreditReason(e.target.value)}
              placeholder="Reason (required)"
              className="min-w-[14rem] flex-1 rounded border border-input bg-background px-2 py-1"
            />
            <Button
              size="sm"
              disabled={busy || !creditReason.trim() || !Number.isInteger(Number(creditAmount)) || Number(creditAmount) === 0}
              onClick={() => void adjustCredits()}
            >
              Adjust credits
            </Button>
          </div>
        )}

        {team && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Optional features {team.storedFeatures === null ? "(automatic: on when the team is ready)" : "(chosen)"}
              </p>
              <div className="space-y-1.5">
                {features.map((feature) => (
                  <label key={feature.key} className="flex items-center gap-2 text-xs text-foreground">
                    <input
                      type="checkbox"
                      checked={teamFeatures.has(feature.key)}
                      onChange={(e) => {
                        const next = new Set(teamFeatures);
                        if (e.target.checked) next.add(feature.key);
                        else next.delete(feature.key);
                        setTeamFeatures(next);
                      }}
                    />
                    {feature.label}
                    {platformOff.has(feature.key) && <span className="text-warning">(off for everyone)</span>}
                  </label>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" disabled={busy} onClick={() => void saveTeam({ enabledFeatures: Array.from(teamFeatures) })}>
                  Save features
                </Button>
                <Button size="sm" variant="outline" disabled={busy || team.storedFeatures === null} onClick={() => void saveTeam({ enabledFeatures: null })}>
                  Reset to automatic
                </Button>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Product mode and limits</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="space-y-1">
                  <span className="text-muted-foreground">Product mode</span>
                  <select
                    value={policy.productMode}
                    onChange={(e) => setPolicy({ ...policy, productMode: e.target.value })}
                    className="w-full rounded border border-input bg-background px-2 py-1"
                  >
                    <option value="ENTERPRISE_CORE">Core only</option>
                    <option value="GROWTH">Growth</option>
                    <option value="ALL_FEATURES">All features</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-muted-foreground">Product surface</span>
                  <select
                    value={policy.productSurface ?? "outreach"}
                    onChange={(e) => setPolicy({ ...policy, productSurface: e.target.value })}
                    className="w-full rounded border border-input bg-background px-2 py-1"
                  >
                    <option value="outreach">Outreach</option>
                    <option value="runtime">Runtime</option>
                  </select>
                </label>
                {LIMITS.map(([field, label]) => (
                  <label key={field} className="space-y-1">
                    <span className="text-muted-foreground">{label}</span>
                    <input
                      type="number"
                      min={0}
                      value={policy[field] as number}
                      onChange={(e) => setPolicy({ ...policy, [field]: Number(e.target.value) })}
                      className="w-full rounded border border-input bg-background px-2 py-1"
                    />
                  </label>
                ))}
              </div>
              <div className="mt-3 space-y-1.5">
                {SWITCHES.map(([field, label]) => (
                  <label key={field} className="flex items-center gap-2 text-xs text-foreground">
                    <input type="checkbox" checked={policy[field] as boolean} onChange={(e) => setPolicy({ ...policy, [field]: e.target.checked })} />
                    {label}
                  </label>
                ))}
              </div>
              <Button size="sm" className="mt-3" disabled={busy} onClick={() => void saveTeam({ policy })}>
                Save product mode and limits
              </Button>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
