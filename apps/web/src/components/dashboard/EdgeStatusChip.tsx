"use client";

import Link from "next/link";
import { formatHeartbeatAge } from "@/lib/edgeHeartbeat";
import { EDGE_DOT, EDGE_LABEL, useEdgeStatus } from "./useEdgeStatus";

// Header chip driven by the node's stored heartbeat. Rendered only for workspaces that have paired a node.
export function EdgeStatusChip() {
    const edge = useEdgeStatus();

    if (!edge?.configured || !edge.state) return null;
    const seen = formatHeartbeatAge(edge.lastSeenAt);
    return (
        <Link
            href="/edge"
            title={`${EDGE_LABEL[edge.state]}. Last heartbeat ${seen}.`}
            className="hidden sm:flex items-center gap-1.5 px-2.5 h-8 rounded-md text-[11px] font-medium text-muted-foreground bg-muted border border-border hover:bg-accent transition-colors"
        >
            <span className={`w-2 h-2 rounded-full ${EDGE_DOT[edge.state]}`} aria-hidden />
            <span>{EDGE_LABEL[edge.state]}</span>
            <span className="text-muted-foreground/70">· {seen}</span>
        </Link>
    );
}
