"use client";

import { AlertTriangle, CheckCircle2, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";

export type RedisStatus = {
  state: "connected" | "connecting" | "unreachable" | "off" | "not_configured" | "disabled_by_server";
  switchEnabled: boolean;
  urlConfigured: boolean;
  disabledByServer: boolean;
  lastFailure: { message: string; at: string } | null;
  nextRetryAt: string | null;
};

const LABELS: Record<RedisStatus["state"], string> = {
  connected: "Connected",
  connecting: "Connecting",
  unreachable: "Unreachable",
  off: "Turned off",
  not_configured: "Off - no Redis server configured",
  disabled_by_server: "Off - disabled on the server",
};

export function redisNotice(status: RedisStatus | null): string | null {
  if (!status || status.state === "connected" || status.state === "connecting") return null;
  return `Redis is ${status.state === "unreachable" ? "unreachable" : "off"}. The app is running without it (in-memory rate limits, no cache).`;
}

export default function RedisCard({
  status,
  error,
  saving,
  onToggle,
}: {
  status: RedisStatus | null;
  error: string | null;
  saving: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  const ok = status?.state === "connected";
  const canTurnOn = !!status && status.urlConfigured && !status.disabledByServer;

  return (
    <GlassCard className={`p-5 ${ok ? "border-emerald-500/20 bg-emerald-500/5" : "border-amber-500/20 bg-amber-500/5"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Database className="h-4 w-4 text-cyan-400" />
            Redis (cache and rate limits)
          </h3>
          <p className={`mt-1 flex items-center gap-1.5 text-lg font-bold ${ok ? "text-emerald-400" : "text-warning"}`}>
            {ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {status ? LABELS[status.state] : error ? "Status unavailable" : "Loading..."}
          </p>
        </div>
        {status && (
          status.switchEnabled && status.state !== "not_configured" && status.state !== "disabled_by_server" ? (
            <Button variant="outline" size="sm" disabled={saving} onClick={() => onToggle(false)}>
              {saving ? "Saving..." : "Turn off"}
            </Button>
          ) : (
            <Button size="sm" disabled={saving || !canTurnOn} onClick={() => onToggle(true)}>
              {saving ? "Connecting..." : "Turn on"}
            </Button>
          )
        )}
      </div>

      <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
        <p>Without Redis the app keeps working: rate limits are counted in memory and flags and user context are read from the database.</p>
        {status?.state === "unreachable" && status.lastFailure && (
          <p className="font-mono text-destructive">
            {status.lastFailure.message}
            {status.nextRetryAt ? ` - retrying at ${new Date(status.nextRetryAt).toLocaleTimeString()}` : ""}
          </p>
        )}
        {status && !status.urlConfigured && (
          <p>
            To turn it on, a Redis server address (REDIS_URL) must be set on the API server first. It can hold a password, so it is
            set on the server, not in this panel.
          </p>
        )}
        {status?.disabledByServer && <p>DISABLE_REDIS is set on the API server, which overrides this switch.</p>}
        {error && <p className="text-destructive">{error}</p>}
        <p className="text-[10px]">Status as the API server sees it. Other API processes pick up a change within 30 seconds.</p>
      </div>
    </GlassCard>
  );
}
