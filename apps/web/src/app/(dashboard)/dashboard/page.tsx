"use client";

/*
 * app/(dashboard)/dashboard/page.tsx — Dashboard home page (reworked)
 *
 * Changes from previous version:
 * - Removed: AppShell wrapper (was causing shell-within-a-shell with its own Sidebar + Header)
 * - Removed: flat quickActions step cards with decorative colors (teal/violet/emerald/amber)
 * - Removed: funnelCards section (moved to /analytics/roi)
 * - Removed: intel signals section (accessible via /intel)
 * - Removed: DashboardController (generic widget blob)
 * - Added: SetupBanner (inline, only when setupPercent < 100)
 * - Added: KPIRow (north-star metrics above the fold)
 * - Added: WorkflowSection (progressive disclosure — rail + active step detail)
 * - Added: BottomGrid (activity feed; its meetings/pending-send mini-stats were removed as duplicates)
 * - Added: NeedsYou first (what's waiting on you, shared with the daily digest); setup banner and
 *   workflow rail only while setupPercent < 100
 * - Data: fetches from /api/dashboard/summary (real Prisma-backed aggregation, not a stub)
 * - Loading: independent Suspense-like states per section via useState
 */

import { useCallback, useEffect, useState } from "react";
import { SetupBanner } from "@/components/dashboard/SetupBanner";
import { NeedsYou } from "@/components/dashboard/NeedsYou";
import { GoalProgress } from "@/components/dashboard/GoalProgress";
import { KPIRow } from "@/components/dashboard/KPIRow";
import { WorkflowSection } from "@/components/dashboard/WorkflowSection";
import { BottomGrid } from "@/components/dashboard/BottomGrid";
import { PipelineTrendCard } from "@/components/dashboard/PipelineTrendCard";
import { RecentLeadsCard } from "@/components/dashboard/RecentLeadsCard";
import { LeadDrilldown, type DrilldownLead } from "@/components/dashboard/LeadDrilldown";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DashboardKPIs {
  meetingsBooked: number;
  meetingsDelta: number;
  activeLeads: number;
  draftsReady: number;
  draftsPendingSend: number;
  openRatePct: number;
  openRateDelta: number;
}

interface DashboardWorkflow {
  leadsImported: boolean;
  leadsCount: number;
  draftsGenerated: boolean;
  draftsCount: number;
  followUpsReviewed: boolean;
  followUpsCount: number;
  pendingSendCount: number;
}

interface ActivityItem {
  id: string;
  type: 'meeting_booked' | 'draft_generated' | 'follow_up_flagged' | 'campaign_activated';
  description: string;
  timestamp: string;
}

interface DashboardData {
  kpis: DashboardKPIs;
  workflow: DashboardWorkflow;
  recentActivity: ActivityItem[];
  recentLeads: DrilldownLead[];
  pipelineTrend: number[];
  setupPercent: number;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [selectedLead, setSelectedLead] = useState<DrilldownLead | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/dashboard/summary', { cache: 'no-store' });
      if (!res.ok) throw new Error('dashboard summary unavailable');
      const json: DashboardData = await res.json();
      setData(json);
    } catch {
      // Surface the failure instead of leaving the page looking like a fresh,
      // empty account (an outage and a zero-metric account must not look alike).
      setData(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setupIncomplete = !loading && data !== null && data.setupPercent < 100;
  const showBanner = setupIncomplete && !bannerDismissed;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Load failure — make an outage legible instead of rendering an empty shell */}
      {error && !loading && (
        <div className="mb-4 flex items-center justify-between gap-4 border-[0.5px] border-destructive/30 bg-destructive/5 px-4 py-3">
          <span className="text-sm text-destructive">
            Couldn&apos;t load your dashboard. This is a temporary problem, not an empty account.
          </span>
          <button
            onClick={() => void load()}
            className="text-xs font-medium uppercase tracking-widest text-destructive border-[0.5px] border-destructive/40 px-3 py-1 hover:bg-destructive/10 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Needs you — what's waiting on the user, one click from acting */}
      <NeedsYou hasLeads={(data?.kpis.activeLeads ?? 0) > 0} />

      {/* Monthly meeting goal — booked vs goal, and whether the team is on pace */}
      <GoalProgress />

      {/* KPI row — always visible, north-star metrics */}
      <KPIRow data={data?.kpis ?? null} loading={loading} error={error} />

      {/* Tier 2 — pipeline trend + recent leads (row click opens drill-down) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 mb-4">
        <PipelineTrendCard trend={data?.pipelineTrend ?? []} loading={loading} />
        <RecentLeadsCard
          leads={data?.recentLeads ?? []}
          totalLeads={data?.kpis.activeLeads ?? 0}
          loading={loading}
          onSelect={setSelectedLead}
        />
      </div>

      <LeadDrilldown lead={selectedLead} onClose={() => setSelectedLead(null)} />

      {/* Setup checklist — only while setup is incomplete */}
      {setupIncomplete && data && (
        <div className="mb-4">
          {showBanner && (
            <SetupBanner
              percent={data.setupPercent}
              onDismiss={() => setBannerDismissed(true)}
            />
          )}
          <p className="text-[10px] uppercase tracking-[0.07em] font-medium text-muted-foreground mb-3">
            Workflow
          </p>
          <WorkflowSection data={data.workflow} loading={false} />
        </div>
      )}

      {/* Activity feed */}
      <BottomGrid recentActivity={data?.recentActivity ?? []} loading={loading} />
    </div>
  );
}
