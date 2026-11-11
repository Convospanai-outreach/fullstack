"use client";

import { useEffect, useState } from "react";
import { Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";

const STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "NOT_INTERESTED"] as const;
type Status = (typeof STATUSES)[number];

const STATUS_LABEL: Record<Status, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  CONVERTED: "Converted",
  NOT_INTERESTED: "Not interested",
};

type Enquiry = {
  id: string;
  ticketId: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: Status;
  createdAt: string;
};

type Summary = {
  today: number;
  yesterday: number;
  last7Days: number;
  thisMonth: number;
  total: number;
  waiting: number;
  byStatus: Record<Status, number>;
  daily: { date: string; count: number }[];
  latest: Enquiry[];
};

function Tile({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <GlassCard className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{note}</p>
    </GlassCard>
  );
}

function sameAsYesterday(today: number, yesterday: number) {
  if (today === yesterday) return "Same as yesterday";
  return `${today > yesterday ? "Up" : "Down"} from ${yesterday} yesterday`;
}

// Website enquiries: the numbers the team checks first, and the newest messages with their status.
export default function EnquiriesTab({ onLoggedOut }: { onLoggedOut: () => void }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const response = await fetch("/api/superadmin/enquiries", { cache: "no-store" });
      if (response.status === 401) return onLoggedOut();
      if (!response.ok) throw new Error(String(response.status));
      setSummary(await response.json());
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setStatus = async (id: string, status: Status) => {
    setSaving(id);
    try {
      const response = await fetch("/api/superadmin/enquiries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (response.status === 401) return onLoggedOut();
      if (!response.ok) throw new Error(String(response.status));
      await load();
    } catch {
      setFailed(true);
    } finally {
      setSaving(null);
    }
  };

  const peak = Math.max(1, ...(summary?.daily.map((d) => d.count) ?? [1]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Inbox className="h-4 w-4 text-primary" />
          Enquiries
        </h3>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {loading && !summary && <p className="text-xs text-muted-foreground">Loading...</p>}
      {failed && <p className="text-xs text-destructive">Couldn&apos;t load or save enquiries. Try Refresh.</p>}

      {summary && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Enquiries today" value={summary.today} note={sameAsYesterday(summary.today, summary.yesterday)} />
            <Tile label="Last 7 days" value={summary.last7Days} note={`${(summary.last7Days / 7).toFixed(1)} a day`} />
            <Tile label="This month" value={summary.thisMonth} note={`${summary.total} in total`} />
            <Tile label="Waiting for a call" value={summary.waiting} note="Status New" />
          </div>

          <GlassCard className="p-4">
            <p className="text-xs font-semibold text-foreground">Enquiries, last 14 days (UTC days)</p>
            <div className="mt-3 flex h-24 items-end gap-1" role="img" aria-label="Enquiries per day for the last 14 days">
              {summary.daily.map((d) => (
                <div key={d.date} className="flex flex-1 flex-col items-center justify-end" title={`${d.date}: ${d.count}`}>
                  <div className="w-full rounded-sm bg-primary/70" style={{ height: `${(d.count / peak) * 100}%`, minHeight: d.count ? 4 : 1 }} />
                  <span className="mt-1 text-[10px] text-muted-foreground">{d.date.slice(8)}</span>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-4">
            <p className="text-xs font-semibold text-foreground">Lead pipeline</p>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {STATUSES.map((s) => (
                <div key={s}>
                  <p className="text-[11px] text-muted-foreground">{STATUS_LABEL[s]}</p>
                  <p className="text-lg font-bold text-foreground">{summary.byStatus[s]}</p>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="overflow-hidden p-0">
            <p className="border-b border-border p-4 text-xs font-semibold text-foreground">Latest enquiries</p>
            {summary.latest.length === 0 ? (
              <p className="p-4 text-xs text-muted-foreground">No enquiries yet. They appear here the moment a website form is sent.</p>
            ) : (
              <ul className="divide-y divide-border">
                {summary.latest.map((e) => (
                  <li key={e.id} className="flex flex-col gap-2 p-4 text-xs sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">
                        {e.name} <span className="font-normal text-muted-foreground">{e.email}</span>
                      </p>
                      <p className="text-foreground">{e.subject}</p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{e.message}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {e.ticketId} · {new Date(e.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <select
                      aria-label={`Status of the enquiry from ${e.name}`}
                      className="rounded-md border border-border bg-background p-1.5 text-xs"
                      value={e.status}
                      disabled={saving === e.id}
                      onChange={(event) => void setStatus(e.id, event.target.value as Status)}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </>
      )}
    </div>
  );
}
