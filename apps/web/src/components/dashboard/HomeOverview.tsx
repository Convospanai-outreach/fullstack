"use client";

import Link from "next/link";
import useSWR from "swr";
import { format } from "date-fns";

interface Overview {
  stages: { stage: string; count: number }[];
  channels: { channel: "email" | "linkedin" | "whatsapp"; sent: number; replies: number | null }[];
  record: { id: string; action: string; status: string; at: string; by: string | null }[];
}

const STAGE_LABELS: Record<string, string> = {
  COLD: "Cold",
  WARM: "Warm",
  HOT: "Hot",
  COORDINATING: "Coordinating",
  MEETING_CONFIRMED: "Meeting confirmed",
  COMPLETED: "Completed",
};

const CHANNEL_LABELS = { email: "Email", linkedin: "LinkedIn", whatsapp: "WhatsApp" } as const;

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`overview ${res.status}`);
  return res.json();
};

// "email_draft_approval" -> "Email draft approval"
function words(code: string) {
  const text = code.replace(/_/g, " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const heading = "text-sm font-medium text-foreground";
const empty = "rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground";
const action = "font-medium text-primary hover:underline";

// Home: where leads stand, what each channel did this week, and the approval record.
// Renders nothing if the API is unavailable, so an outage never reads as an empty account.
export function HomeOverview() {
  const { data, error } = useSWR<Overview>("/api/dashboard/overview", fetcher);
  if (error || !data?.stages) return null;

  const totalLeads = data.stages.reduce((sum, s) => sum + s.count, 0);
  const anySent = data.channels.some((c) => c.sent > 0);

  return (
    <div className="mb-4 space-y-6">
      <section aria-labelledby="home-pipeline-heading">
        <h2 id="home-pipeline-heading" className={`${heading} mb-2.5`}>
          {totalLeads > 0 ? `Where your ${totalLeads} ${totalLeads === 1 ? "lead stands" : "leads stand"}` : "Your pipeline"}
        </h2>
        {totalLeads === 0 ? (
          <p className={empty}>
            Each lead moves from cold to meeting here.{" "}
            <Link href="/leads/import" className={action}>Add your first leads</Link> to see it fill in.
          </p>
        ) : (
          <ol className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
            {data.stages.map((s) => (
              <li key={s.stage}>
                <Link href="/pipeline" className="block rounded-lg border border-border bg-card px-3.5 py-3 hover:bg-accent/40">
                  <span className="block text-xs text-muted-foreground">{STAGE_LABELS[s.stage] ?? words(s.stage)}</span>
                  <span className={`block text-2xl font-medium ${s.count > 0 ? "text-foreground" : "text-muted-foreground"}`}>{s.count}</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="home-channels-heading">
        <h2 id="home-channels-heading" className={`${heading} mb-2.5`}>Outreach by channel, last 7 days</h2>
        {!anySent ? (
          <p className={empty}>
            Email, LinkedIn and WhatsApp activity shows up here as soon as outreach starts.{" "}
            <Link href="/campaigns/new" className={action}>Start a campaign</Link>
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full min-w-[420px] text-sm tabular-nums">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Channel</th>
                  <th className="px-4 py-2.5 text-right font-medium">Sent or logged</th>
                  <th className="px-4 py-2.5 text-right font-medium">Replies</th>
                  <th className="px-4 py-2.5 text-right font-medium">Reply rate</th>
                </tr>
              </thead>
              <tbody>
                {data.channels.map((c) => (
                  <tr key={c.channel} className="border-t border-border">
                    <td className="px-4 py-2.5 font-medium text-foreground">{CHANNEL_LABELS[c.channel]}</td>
                    {c.sent === 0 ? (
                      <td colSpan={3} className="px-4 py-2.5 text-right text-muted-foreground">Nothing sent yet</td>
                    ) : (
                      <>
                        <td className="px-4 py-2.5 text-right text-foreground">{c.sent}</td>
                        <td className="px-4 py-2.5 text-right text-foreground">{c.replies ?? <span className="text-muted-foreground">Not tracked yet</span>}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-foreground">{c.replies === null ? "" : `${Math.round((c.replies / c.sent) * 100)}%`}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="home-record-heading">
        <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="home-record-heading" className={heading}>Approval record</h2>
          <span className="text-xs text-muted-foreground">Keeps decisions and outcomes, never message text.</span>
        </div>
        {data.record.length === 0 ? (
          <p className={empty}>Every draft you approve or reject is listed here, starting with your first one.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">When</th>
                  <th className="px-4 py-2.5 font-medium">Who</th>
                  <th className="px-4 py-2.5 font-medium">Action</th>
                  <th className="px-4 py-2.5 font-medium">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {data.record.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-2.5 text-muted-foreground">{format(new Date(r.at), "d MMM, HH:mm")}</td>
                    <td className="px-4 py-2.5 text-foreground">{r.by ?? "System"}</td>
                    <td className="px-4 py-2.5 text-foreground">{words(r.action)}</td>
                    <td className={`px-4 py-2.5 font-medium ${r.status === "APPROVED" ? "text-success" : "text-destructive"}`}>{words(r.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
