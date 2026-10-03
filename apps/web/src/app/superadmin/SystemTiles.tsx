"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";

export type SystemHealth = {
  database: { ok: boolean; latencyMs: number };
  api: { uptimeSec: number; rssMb: number; heapUsedMb: number; nodeVersion: string };
  worker: {
    state: "active" | "stale" | "unknown";
    lastSeenAt: string | null;
    startedAt: string | null;
    stats: { rssMb?: number; activeJobs?: number } | null;
  };
  queue: { overdueJobs: number; oldestOverdueAt: string | null };
};

function duration(seconds: number) {
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

function ago(iso: string | null) {
  return iso ? `${duration((Date.now() - new Date(iso).getTime()) / 1000)} ago` : "never";
}

function Tile({ label, ok, status, detail }: { label: string; ok: boolean; status: string; detail: string }) {
  return (
    <GlassCard className={`p-4 ${ok ? "border-emerald-500/20 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/10"}`}>
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className={`mt-1 flex items-center gap-1.5 text-lg font-bold ${ok ? "text-emerald-400" : "text-destructive"}`}>
        {ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />} {status}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </GlassCard>
  );
}

// Live database, API and worker tiles from the overview's `system` block.
export default function SystemTiles({ system }: { system: SystemHealth | undefined }) {
  if (!system) {
    return <Tile label="System checks" ok={false} status="Unavailable" detail="The API did not return live checks." />;
  }
  const { database, api, worker, queue } = system;
  const workerOk = worker.state === "active" && queue.overdueJobs === 0;
  return (
    <>
      <Tile
        label="PostgreSQL (Supabase)"
        ok={database.ok}
        status={database.ok ? "Reachable" : "Unreachable"}
        detail={`Round trip ${database.latencyMs} ms`}
      />
      <Tile
        label="API (Oracle VM)"
        ok
        status="Serving"
        detail={`Up ${duration(api.uptimeSec)} · ${api.rssMb} MB memory · Node ${api.nodeVersion}`}
      />
      <Tile
        label="Background worker"
        ok={workerOk}
        status={worker.state === "active" ? (queue.overdueJobs ? "Behind" : "Active") : worker.state === "stale" ? "Not responding" : "No heartbeat yet"}
        detail={[
          `Last seen ${ago(worker.lastSeenAt)}`,
          worker.stats?.rssMb !== undefined ? `${worker.stats.rssMb} MB memory` : null,
          queue.overdueJobs ? `${queue.overdueJobs} jobs overdue since ${ago(queue.oldestOverdueAt)}` : "queue on time",
        ]
          .filter(Boolean)
          .join(" · ")}
      />
    </>
  );
}
