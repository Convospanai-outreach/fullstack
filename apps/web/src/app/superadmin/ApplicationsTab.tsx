"use client";

import { useEffect, useState } from "react";
import { Briefcase, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";

const STATUSES = ["NEW", "REVIEWING", "SHORTLISTED", "REJECTED", "HIRED"] as const;
type Status = (typeof STATUSES)[number];

const STATUS_LABEL: Record<Status, string> = {
  NEW: "New",
  REVIEWING: "Reviewing",
  SHORTLISTED: "Shortlisted",
  REJECTED: "Rejected",
  HIRED: "Hired",
};

type Application = {
  id: string;
  jobTitle: string;
  name: string;
  email: string;
  phone: string | null;
  coverNote: string | null;
  status: Status;
  resumeName: string;
  resumeSize: number;
  createdAt: string;
};

type Summary = { total: number; byStatus: Record<Status, number>; latest: Application[] };

// Job applications from the careers pages: counts, the newest applications, a status picker and the resume.
export default function ApplicationsTab({ onLoggedOut }: { onLoggedOut: () => void }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const response = await fetch("/api/superadmin/applications", { cache: "no-store" });
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
      const response = await fetch("/api/superadmin/applications", {
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Briefcase className="h-4 w-4 text-primary" />
          Job applications
        </h3>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {loading && !summary && <p className="text-xs text-muted-foreground">Loading...</p>}
      {failed && <p className="text-xs text-destructive">Couldn&apos;t load or save applications. Try Refresh.</p>}

      {summary && (
        <>
          <GlassCard className="p-4">
            <p className="text-xs text-muted-foreground">{summary.total} in total</p>
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
            {summary.latest.length === 0 ? (
              <p className="p-4 text-xs text-muted-foreground">No applications yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {summary.latest.map((a) => (
                  <li key={a.id} className="flex flex-col gap-2 p-4 text-xs sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">
                        {a.name} <span className="font-normal text-muted-foreground">{a.email}</span>
                        {a.phone && <span className="font-normal text-muted-foreground"> · {a.phone}</span>}
                      </p>
                      <p className="text-foreground">{a.jobTitle}</p>
                      {a.coverNote && <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{a.coverNote}</p>}
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {new Date(a.createdAt).toLocaleString()} ·{" "}
                        <a className="inline-flex items-center gap-1 text-primary hover:underline" href={`/api/superadmin/applications/${a.id}/resume`}>
                          <Download className="h-3 w-3" />
                          {a.resumeName} ({Math.max(1, Math.round(a.resumeSize / 1024))} KB)
                        </a>
                      </p>
                    </div>
                    <select
                      aria-label={`Status of the application from ${a.name}`}
                      className="rounded-md border border-border bg-background p-1.5 text-xs"
                      value={a.status}
                      disabled={saving === a.id}
                      onChange={(event) => void setStatus(a.id, event.target.value as Status)}
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
