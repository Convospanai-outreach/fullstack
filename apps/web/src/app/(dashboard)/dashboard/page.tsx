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
 * - Added: BottomGrid (activity feed + mini-stat stack)
 * - Data: fetches from /api/dashboard/summary (stub with TODO for real Supabase queries)
 * - Loading: independent Suspense-like states per section via useState
 */

import { useEffect, useState } from "react";
import { SetupBanner } from "@/components/dashboard/SetupBanner";
import { KPIRow } from "@/components/dashboard/KPIRow";
import { WorkflowSection } from "@/components/dashboard/WorkflowSection";
import { BottomGrid } from "@/components/dashboard/BottomGrid";

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
  setupPercent: number;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch('/api/dashboard/summary', { cache: 'no-store' });
        if (!res.ok) throw new Error('dashboard summary unavailable');
        const json: DashboardData = await res.json();
        if (!cancelled) setData(json);
      } catch {
        // On error, leave data null — components handle empty states
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  const showBanner =
    !bannerDismissed &&
    !loading &&
    data !== null &&
    data.setupPercent < 100;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Setup banner — inline, only when setup is incomplete */}
      {showBanner && data && (
        <SetupBanner
          percent={data.setupPercent}
          onDismiss={() => setBannerDismissed(true)}
        />
      )}

      {/* KPI row — always visible, north-star metrics */}
      <KPIRow data={data?.kpis ?? null} loading={loading} />

      {/* Workflow section — progressive disclosure */}
      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-[0.07em] font-medium text-white/25 mb-3">
          Workflow
        </p>
        <WorkflowSection data={data?.workflow ?? null} loading={loading} />
      </div>

      {/* Bottom grid — activity feed + mini stats */}
      <BottomGrid
        recentActivity={data?.recentActivity ?? []}
        meetingsBooked={data?.kpis.meetingsBooked ?? 0}
        meetingsDelta={data?.kpis.meetingsDelta ?? 0}
        draftsPendingSend={data?.kpis.draftsPendingSend ?? 0}
        loading={loading}
      />
    </div>
  );
}
