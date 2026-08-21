"use client";

// RecentLeadsCard.tsx
// Tier 2 (right column): most recently active leads. Row click opens LeadDrilldown.

import Link from "next/link";
import { DrilldownLead } from "./LeadDrilldown";

const statusLabels: Record<string, string> = {
  NEW: "New",
  enriched: "Enriched",
  ENRICHED: "Enriched",
  CONTACTED: "Contacted",
  CONNECTED: "Engaged",
  REPLIED: "Replied",
  CONVERTED: "Converted",
  LOST: "Lost",
  STOPPED: "Stopped",
};

function formatRelative(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

interface RecentLeadsCardProps {
  leads: DrilldownLead[];
  totalLeads: number;
  loading?: boolean;
  onSelect: (lead: DrilldownLead) => void;
}

export function RecentLeadsCard({ leads, totalLeads, loading, onSelect }: RecentLeadsCardProps) {
  if (loading) {
    return (
      <div className="bg-[#101624] border border-white/7 rounded-lg p-3.5 h-full animate-pulse">
        <div className="h-2.5 w-24 bg-white/8 rounded mb-4" />
        {[...Array(4)].map((_, i) => <div key={i} className="h-6 bg-white/5 rounded mb-1.5" />)}
      </div>
    );
  }

  return (
    <div className="bg-[#101624] border border-white/7 rounded-lg p-3.5 h-full flex flex-col">
      <p className="text-[10px] uppercase tracking-[0.07em] font-medium text-white/25 mb-3">
        Recent leads
      </p>

      {leads.length === 0 ? (
        <p className="text-xs text-white/30 flex-1">No leads yet.</p>
      ) : (
        <div className="flex-1">
          <div className="grid grid-cols-[1.4fr_0.8fr_0.7fr] gap-2 text-[9px] uppercase tracking-wide text-white/25 pb-1.5 border-b border-white/6">
            <span>Company</span>
            <span>Status</span>
            <span className="text-right">Activity</span>
          </div>
          {leads.map((lead) => (
            <button
              key={lead.id}
              onClick={() => onSelect(lead)}
              className="w-full grid grid-cols-[1.4fr_0.8fr_0.7fr] gap-2 items-center text-left py-1.5 border-b border-white/4 last:border-0 hover:bg-white/4 transition-colors rounded-sm px-0.5"
            >
              <span className="text-xs text-white/70 truncate">{lead.company !== "—" ? lead.company : lead.name}</span>
              <span className="text-[10px] text-white/40 truncate">{statusLabels[lead.status] ?? lead.status}</span>
              <span className="text-[10px] text-white/25 text-right">{formatRelative(lead.lastActivityAt)}</span>
            </button>
          ))}
        </div>
      )}

      <Link
        href="/leads"
        className="text-center text-[11px] text-white/40 hover:text-white/70 transition-colors border-t border-white/6 mt-2 pt-2"
      >
        View all {totalLeads} →
      </Link>
    </div>
  );
}
