"use client";

import Link from "next/link";

interface KPIData {
  meetingsBooked: number;
  meetingsDelta: number;
  activeLeads: number;
  draftsReady: number;
  draftsPendingSend: number;
  openRatePct: number;
  openRateDelta: number;
}

interface KPIRowProps {
  data: KPIData | null;
  loading?: boolean;
  error?: boolean;
}

const strip = "grid grid-cols-2 lg:grid-cols-4 gap-x-6 border-y border-border mb-6";

// Home's four numbers. A metric with nothing behind it yet shows what will fill it and
// the next step, instead of a bare 0.
export function KPIRow({ data, loading, error }: KPIRowProps) {
  // An outage must not look like a fresh (all-zero) account: show an explicit
  // "unavailable" state that is distinct from both the loading shimmer and real
  // zero metrics.
  if (!loading && error) {
    return (
      <div className={strip}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="py-4 text-sm text-destructive">Unavailable</div>
        ))}
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className={strip}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="py-4">
            <div className="h-3 w-24 rounded bg-muted animate-pulse mb-3" />
            <div className="h-8 w-16 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  const hasLeads = data.activeLeads > 0;
  const kpis = [
    {
      id: "meetings",
      label: "Meetings booked",
      value: data.meetingsBooked > 0 ? String(data.meetingsBooked) : null,
      note: null,
      blank: "Your first booked meeting shows up here.",
      href: "/calendar",
      cta: null,
    },
    {
      id: "leads",
      label: "Leads in outreach",
      value: hasLeads ? String(data.activeLeads) : null,
      note: null,
      blank: "No leads yet.",
      href: hasLeads ? "/leads" : "/leads/import",
      cta: "Import leads",
    },
    {
      id: "drafts",
      label: "Drafts waiting",
      value: data.draftsReady > 0 ? String(data.draftsReady) : null,
      note: data.draftsPendingSend > 0 ? "Needs your approval" : null,
      blank: hasLeads ? "Nothing to approve yet." : "Drafts come after you add leads.",
      href: data.draftsReady > 0 ? "/inbox?tab=approvals" : "/campaigns/new",
      cta: hasLeads ? "Start a campaign" : null,
    },
    {
      id: "open_rate",
      label: "Engagement rate",
      value: data.openRatePct > 0 ? `${data.openRatePct}%` : null,
      note: "Opens, clicks and replies per email sent",
      blank: "Shows after your first emails go out.",
      href: "/analytics/roi",
      cta: null,
    },
  ];

  return (
    <div className={strip}>
      {kpis.map((kpi) => (
        <div key={kpi.id} className="py-4">
          <p className="text-sm text-muted-foreground mb-1">{kpi.label}</p>
          {kpi.value ? (
            <>
              <Link href={kpi.href} className="block text-3xl font-medium tracking-tight text-foreground hover:text-primary">
                {kpi.value}
              </Link>
              {kpi.note && <p className="mt-1 text-xs text-muted-foreground">{kpi.note}</p>}
            </>
          ) : (
            <p className="text-sm text-foreground">
              {kpi.blank}
              {kpi.cta && (
                <>
                  {" "}
                  <Link href={kpi.href} className="font-medium text-primary hover:underline">{kpi.cta}</Link>
                </>
              )}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
