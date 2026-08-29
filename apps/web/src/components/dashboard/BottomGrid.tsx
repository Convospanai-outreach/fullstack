"use client";

// BottomGrid.tsx
// Two-column grid: activity feed (left) + mini-stat stack (right).

import { EmptyState } from "./EmptyState";
import { formatRelativeTime } from "@/lib/utils/time";

type ActivityType = 'meeting_booked' | 'draft_generated' | 'follow_up_flagged' | 'campaign_activated';

interface ActivityItem {
  id: string;
  type: ActivityType;
  description: string;
  timestamp: string;
}

interface BottomGridProps {
  recentActivity: ActivityItem[];
  meetingsBooked: number;
  meetingsDelta: number;
  draftsPendingSend: number;
  loading?: boolean;
}

const dotColorByType: Record<ActivityType, string> = {
  meeting_booked: 'bg-success',
  draft_generated: 'bg-primary',
  follow_up_flagged: 'bg-warning',
  campaign_activated: 'bg-primary',
};

function BottomGridSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_176px] gap-2.5 animate-pulse">
      <div className="bg-card border border-border rounded-lg p-3.5">
        <div className="h-2.5 w-24 bg-muted rounded mb-4" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex gap-2.5 py-2 border-b border-border last:border-0">
            <div className="w-1.5 h-1.5 rounded-full bg-muted mt-1.5 flex-shrink-0" />
            <div className="flex-1 h-3 bg-muted rounded" />
            <div className="h-3 w-12 bg-muted rounded" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-3 flex-1">
            <div className="h-2 w-20 bg-muted rounded mb-2" />
            <div className="h-5 w-10 bg-muted rounded mb-1" />
            <div className="h-2 w-16 bg-muted rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function BottomGrid({
  recentActivity,
  meetingsBooked,
  meetingsDelta,
  draftsPendingSend,
  loading,
}: BottomGridProps) {
  if (loading) return <BottomGridSkeleton />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_176px] gap-2.5">
      {/* Activity feed */}
      <div className="bg-card border border-border rounded-lg p-3.5">
        <p className="text-[10px] uppercase tracking-[0.07em] font-medium text-muted-foreground mb-3">
          Recent activity
        </p>

        {recentActivity.length === 0 ? (
          <EmptyState
            message="No activity yet today."
            ctaLabel="Import leads to get started"
            ctaHref="/leads/import"
          />
        ) : (
          <div>
            {recentActivity.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-2.5 py-1.5 border-b border-border last:border-0"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${dotColorByType[item.type]}`}
                />
                <span className="flex-1 text-xs text-muted-foreground leading-relaxed">
                  {item.description}
                </span>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {formatRelativeTime(item.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mini-stat stack */}
      <div className="flex flex-col gap-2">
        {/* Qualified meetings */}
        <div className="bg-card border border-border rounded-lg p-3 flex-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Qualified meetings</p>
          <p className="text-[20px] font-medium text-foreground leading-none mt-1">{meetingsBooked}</p>
          <p className="text-[10px] mt-0.5">
            {meetingsDelta > 0 ? (
              <span className="text-success">↑ {meetingsDelta} this week</span>
            ) : meetingsDelta < 0 ? (
              <span className="text-destructive">↓ {Math.abs(meetingsDelta)} this week</span>
            ) : (
              <span className="text-muted-foreground">No change</span>
            )}
          </p>
        </div>

        {/* Pending sends */}
        <div className="bg-card border border-border rounded-lg p-3 flex-1" title="Approved drafts waiting for mailbox transmission">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Pending sends</p>
          <p className="text-[20px] font-medium text-foreground leading-none mt-1">{draftsPendingSend}</p>
          <p className="text-[10px] mt-0.5">
            {draftsPendingSend > 0 ? (
              <span className="text-warning">Awaiting mailbox dispatch</span>
            ) : (
              <span className="text-muted-foreground">Queue clear</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
