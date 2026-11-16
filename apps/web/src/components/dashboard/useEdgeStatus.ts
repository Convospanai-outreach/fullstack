"use client";

import useSWR from "swr";
import { getBrowserApiBase } from "@/lib/api/browserBase";
import type { EdgeHeartbeat } from "@/lib/edgeHeartbeat";

// One fetch of the node's stored heartbeat, shared (same SWR key) by the header chip and the
// sidebar plate. Returns undefined until loaded or if the request fails, so callers stay hidden.
export const EDGE_STATUS_KEY = "edge-status";

async function fetchEdge(): Promise<EdgeHeartbeat> {
    const res = await fetch(getBrowserApiBase() + "/edge/details");
    if (!res.ok) throw new Error(`edge ${res.status}`);
    return (await res.json()).data;
}

export function useEdgeStatus(): EdgeHeartbeat | undefined {
    const { data } = useSWR<EdgeHeartbeat>(EDGE_STATUS_KEY, fetchEdge, { refreshInterval: 60_000 });
    return data;
}

export const EDGE_DOT = {
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
} as const;
export const EDGE_LABEL = {
    green: "Edge connected",
    amber: "Edge heartbeat stale",
    red: "Edge offline",
} as const;
