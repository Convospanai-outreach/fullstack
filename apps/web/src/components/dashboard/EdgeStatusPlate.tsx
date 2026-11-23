"use client";

import Link from "next/link";
import { formatHeartbeatAge, type EdgeHeartbeatState } from "@/lib/edgeHeartbeat";
import { EDGE_DOT, EDGE_LABEL, useEdgeStatus } from "./useEdgeStatus";

const MEANING: Record<EdgeHeartbeatState, string> = {
  green: "Your node is running. Personal data stays on your device.",
  amber: "Your node has gone quiet. Check that it is running.",
  red: "Your node is not reachable. Personal data work is paused.",
};

// Sidebar plate above Settings: same data and thresholds as the header chip (useEdgeStatus).
// Hidden until the status loads, so a failed request never reads as "not paired".
export function EdgeStatusPlate({ onClick = () => {} }: { onClick?: () => void }) {
  const edge = useEdgeStatus();
  if (!edge) return null;

  const base = "glass-dark block p-3 mb-2.5 hover:bg-sidebar-foreground/10 transition-colors";

  if (!edge.configured || !edge.state) {
    return (
      <Link href="/edge" onClick={onClick} className={base}>
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-sidebar-foreground">
          <span className="h-[7px] w-[7px] rounded-full bg-[#C2A36B]" aria-hidden />
          Not paired
        </p>
        <p className="mt-0.5 text-[12px] leading-snug text-sidebar-muted">
          Pair a node to keep personal data on your own device
        </p>
      </Link>
    );
  }

  return (
    <Link href="/edge" onClick={onClick} className={base}>
      <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-sidebar-foreground">
        <span className={`h-2 w-2 rounded-full ${EDGE_DOT[edge.state]}`} aria-hidden />
        {EDGE_LABEL[edge.state]}
      </p>
      <p className="mt-0.5 text-[10.5px] text-sidebar-foreground/75">Last heartbeat {formatHeartbeatAge(edge.lastSeenAt)}</p>
      <p className="mt-0.5 text-[10.5px] leading-snug text-sidebar-foreground/75">{MEANING[edge.state]}</p>
    </Link>
  );
}
