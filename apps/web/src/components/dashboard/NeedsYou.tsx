"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { ArrowRight, CheckCircle2 } from "lucide-react";

type NeedsYouType =
  | "unread_replies"
  | "approvals"
  | "approved_not_sent"
  | "stalled_leads"
  | "mailbox_issues"
  | "meetings_today";

interface NeedsYouEntry {
  id: string;
  title: string;
  detail: string | null;
  href: string;
  at: string | null;
}

interface NeedsYouItem {
  type: NeedsYouType;
  count: number;
  top: NeedsYouEntry[];
  href: string;
}

const LABELS: Record<NeedsYouType, string> = {
  unread_replies: "Replies to answer",
  approvals: "Waiting for your approval",
  approved_not_sent: "Approved but not sent",
  stalled_leads: "Leads gone quiet",
  mailbox_issues: "Mailboxes to reconnect",
  meetings_today: "Meetings today",
};

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`needs-you ${res.status}`);
  return res.json();
};

function when(entry: NeedsYouEntry, type: NeedsYouType) {
  if (!entry.at) return null;
  const date = new Date(entry.at);
  return type === "meetings_today" ? format(date, "h:mm a") : formatDistanceToNow(date, { addSuffix: true });
}

// Home's first section: what's waiting on you, one click from acting on it. Same data as
// the daily digest (apps/api needsYouService). Renders nothing if the API is unavailable,
// so an outage never reads as "All clear".
export function NeedsYou({ hasLeads }: { hasLeads: boolean }) {
  const { data, error, mutate } = useSWR<{ needsYou: NeedsYouItem[] }>("/api/proxy/dashboard/needs-you", fetcher);
  const [approving, setApproving] = useState<string | null>(null);

  if (error || !data?.needsYou) return null;
  const items = data.needsYou.filter((item) => item.count > 0);

  const approve = async (id: string) => {
    setApproving(id);
    try {
      const res = await fetch(`/api/approvals/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE" }),
      });
      if (!res.ok) throw new Error("approve failed");
      toast.success("Approved");
      await mutate();
    } catch {
      toast.error("Couldn't approve. Open it in the Inbox to try again.");
    } finally {
      setApproving(null);
    }
  };

  return (
    <section aria-labelledby="needs-you-heading" className="mb-4">
      <p id="needs-you-heading" className="text-[10px] uppercase tracking-[0.07em] font-medium text-muted-foreground mb-3">
        Needs you
      </p>

      {items.length === 0 ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <div>
              <p className="text-sm font-medium text-foreground">All clear</p>
              <p className="text-xs text-muted-foreground">Nothing is waiting on you right now.</p>
            </div>
          </div>
          <Link
            href={hasLeads ? "/campaigns/new" : "/leads/import"}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            {hasLeads ? "Start a campaign" : "Import your leads"}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <div className="grid gap-2.5 md:grid-cols-2">
          {items.map((item) => (
            <div key={item.type} className="rounded-lg border border-border bg-card p-4">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <Link href={item.href} className="text-sm font-medium text-foreground hover:text-primary">
                  {LABELS[item.type]}
                </Link>
                <span className="text-lg font-medium text-foreground">{item.count}</span>
              </div>
              <ul className="space-y-1.5">
                {item.top.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-2">
                    <Link href={entry.href} className="min-w-0 flex-1 rounded-md px-1 py-0.5 hover:bg-accent">
                      <span className="block truncate text-[13px] text-foreground">{entry.title}</span>
                      {(entry.detail || entry.at) && (
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {[entry.detail, when(entry, item.type)].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </Link>
                    {item.type === "approvals" && (
                      <button
                        type="button"
                        onClick={() => void approve(entry.id)}
                        disabled={approving !== null}
                        className="shrink-0 rounded-md border border-success/40 px-2 py-1 text-[11px] font-medium text-success hover:bg-success/10 disabled:opacity-50"
                      >
                        {approving === entry.id ? "Approving…" : "Approve"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {item.count > item.top.length && (
                <Link href={item.href} className="mt-2 inline-flex items-center gap-1 text-[12px] text-primary hover:underline">
                  See all {item.count}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
