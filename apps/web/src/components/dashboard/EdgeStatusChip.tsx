"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserApiBase } from "@/lib/api/browserBase";
import { formatHeartbeatAge, type EdgeHeartbeat, type EdgeHeartbeatState } from "@/lib/edgeHeartbeat";

const DOT: Record<EdgeHeartbeatState, string> = {
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
};
const LABEL: Record<EdgeHeartbeatState, string> = {
    green: "Edge connected",
    amber: "Edge heartbeat stale",
    red: "Edge offline",
};

// Header chip driven by the node's stored heartbeat. Rendered only for workspaces that have paired a node.
export function EdgeStatusChip() {
    const [edge, setEdge] = useState<EdgeHeartbeat | null>(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const res = await fetch(getBrowserApiBase() + "/edge/details");
                if (res.ok && !cancelled) setEdge((await res.json()).data);
            } catch {
                /* leave the chip hidden */
            }
        };
        load();
        const timer = setInterval(load, 60_000);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, []);

    if (!edge?.configured || !edge.state) return null;
    const seen = formatHeartbeatAge(edge.lastSeenAt);
    return (
        <Link
            href="/edge"
            title={`${LABEL[edge.state]}. Last heartbeat ${seen}.`}
            className="hidden sm:flex items-center gap-1.5 px-2.5 h-8 rounded-md text-[11px] font-medium text-muted-foreground bg-muted border border-border hover:bg-accent transition-colors"
        >
            <span className={`w-2 h-2 rounded-full ${DOT[edge.state]}`} aria-hidden />
            <span>{LABEL[edge.state]}</span>
            <span className="text-muted-foreground/70">· {seen}</span>
        </Link>
    );
}
