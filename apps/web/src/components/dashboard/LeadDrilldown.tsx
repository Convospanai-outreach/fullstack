"use client";

// LeadDrilldown.tsx
// Slide-over panel opened from a Recent Leads row click (dashboard Tier 2).
// "Send follow-up" queues an ApprovalRequest — lands in /approvals, then /inbox once approved.

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

export interface DrilldownLead {
  id: string;
  name: string;
  company: string;
  status: string;
  lastActivityAt: string;
}

interface LeadDrilldownProps {
  lead: DrilldownLead | null;
  onClose: () => void;
}

export function LeadDrilldown({ lead, onClose }: LeadDrilldownProps) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!lead) return null;

  const handleSendFollowUp = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${lead.id}/follow-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: `Follow-up requested from dashboard for ${lead.name}` }),
      });
      if (!res.ok) throw new Error("Failed to queue follow-up");
      setSent(true);
    } catch {
      setError("Couldn't queue the follow-up. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} aria-hidden="true" />
      <aside className="fixed top-0 right-0 bottom-0 w-[320px] bg-[#0b0f17] border-l border-white/10 z-50 flex flex-col p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[15px] font-medium text-white/90">{lead.name}</p>
            <p className="text-[12px] text-white/40 mt-0.5">{lead.company}</p>
          </div>
          <button onClick={onClose} className="p-1 text-white/30 hover:text-white/70 transition-colors" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 border border-dashed border-white/10 rounded-md p-3 text-[12px] text-white/50">
          <p>Status: <span className="text-white/70">{lead.status}</span></p>
          <p className="mt-1">Last activity: {new Date(lead.lastActivityAt).toLocaleString()}</p>
        </div>

        <div className="mt-auto flex flex-col gap-2">
          {error && <p className="text-[11px] text-red-400">{error}</p>}
          {sent ? (
            <div className="text-[12px] text-emerald-400 border border-emerald-500/25 bg-emerald-500/5 rounded-md px-3 py-2 flex items-center justify-between">
              Queued in Approvals
              <Link href="/approvals" className="underline">View →</Link>
            </div>
          ) : (
            <button
              onClick={handleSendFollowUp}
              disabled={sending}
              className="w-full bg-white text-black text-[13px] font-medium rounded-md py-2 disabled:opacity-50 transition-opacity"
            >
              {sending ? "Sending…" : "Send follow-up"}
            </button>
          )}
          <Link
            href={`/leads?search=${encodeURIComponent(lead.name)}`}
            className="text-center text-[11px] text-white/30 hover:text-white/60 transition-colors"
          >
            View in Leads →
          </Link>
        </div>
      </aside>
    </>
  );
}
