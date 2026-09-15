"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import ReactFlow, {
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    applyNodeChanges,
    applyEdgeChanges,
    type NodeChange,
    type EdgeChange,
    type Connection,
    type Node,
    type Edge,
    type NodeMouseHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { getBrowserApiBase } from "@/lib/api/browserBase";

type AccountLead = {
    id: string;
    fullName: string | null;
    jobTitle: string | null;
    company: string | null;
    domain: string | null;
    reportsToId: string | null;
    pipelineState: string | null;
    pipelineStateChangedAt: string | null;
};

// Mirrors the stage progression in apps/api/src/lib/crm/leadStageTransitions.ts's
// PIPELINE_STAGES - a node's color is a live readout of where that person actually
// is in outreach, not a static org-chart label.
const STAGE_COLORS: Record<string, string> = {
    COLD: "#334155",
    WARM: "#a16207",
    HOT: "#c2410c",
    COORDINATING: "#1d4ed8",
    MEETING_CONFIRMED: "#7e22ce",
    COMPLETED: "#15803d",
    CLOSED_WON: "#15803d",
    CLOSED_LOST: "#64748b",
};
const STAGE_LABELS: Record<string, string> = {
    COLD: "Cold", WARM: "Warm", HOT: "Hot", COORDINATING: "Coordinating",
    MEETING_CONFIRMED: "Meeting Confirmed", COMPLETED: "Completed",
    CLOSED_WON: "Closed Won", CLOSED_LOST: "Closed Lost",
};

function toNodesAndEdges(leads: AccountLead[]): { nodes: Node[]; edges: Edge[] } {
    const nodes: Node[] = leads.map((lead, i) => {
        const stage = lead.pipelineState || "COLD";
        return {
            id: lead.id,
            position: { x: (i % 4) * 220, y: Math.floor(i / 4) * 140 },
            data: { label: `${lead.fullName || "Unnamed"}${lead.jobTitle ? `\n${lead.jobTitle}` : ""}\n${STAGE_LABELS[stage] || stage}` },
            style: {
                whiteSpace: "pre-line",
                textAlign: "center" as const,
                background: STAGE_COLORS[stage] || STAGE_COLORS["COLD"],
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.2)",
                cursor: "pointer",
            },
        };
    });
    const edges: Edge[] = leads
        .filter((lead) => lead.reportsToId)
        .map((lead) => ({
            id: `${lead.id}->${lead.reportsToId}`,
            source: lead.id,
            target: lead.reportsToId as string,
        }));
    return { nodes, edges };
}

// On-demand account org chart - built for one account at a time (via ?domain=
// or ?company= query param), not a background job over every lead. Reuses
// OrgGraph.tsx's reactflow scaffolding but adds onConnect so a user can
// manually draw reporting-line edges, persisting each via PATCH
// /leads/org-chart (rejects a cross-account edge server-side).
export default function OrgChart({ domain, company }: { domain?: string | null; company?: string | null }) {
    const router = useRouter();
    const [nodes, setNodes] = useNodesState([]);
    const [edges, setEdges] = useEdgesState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const query = useMemo(() => {
        const params = new URLSearchParams();
        if (domain) params.set("domain", domain);
        else if (company) params.set("company", company);
        return params.toString();
    }, [domain, company]);

    const load = useCallback(() => {
        if (!query) return;
        setLoading(true);
        fetch(`${getBrowserApiBase()}/leads/org-chart?${query}`, { cache: "no-store" })
            .then(async (res) => {
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || "Failed to load account leads");
                const { nodes: n, edges: e } = toNodesAndEdges(data.leads || []);
                setNodes(n);
                setEdges(e);
                setError(null);
            })
            .catch((err) => setError(err?.message || "Failed to load account leads"))
            .finally(() => setLoading(false));
    }, [query, setNodes, setEdges]);

    useEffect(() => { load(); }, [load]);

    const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)), [setNodes]);
    const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)), [setEdges]);
    const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
        router.push(`/leads/${node.id}`);
    }, [router]);

    const onConnect = useCallback(async (connection: Connection) => {
        if (!connection.source || !connection.target) return;
        try {
            const res = await fetch(`${getBrowserApiBase()}/leads/org-chart`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ leadId: connection.source, reportsToId: connection.target }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "Could not save that reporting line");
            load();
        } catch (err: any) {
            setError(err?.message || "Could not save that reporting line");
        }
    }, [load]);

    if (loading) return <div className="h-[500px] flex items-center justify-center text-white/50">Loading account map...</div>;

    return (
        <div className="space-y-2">
            {error && (
                <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{error}</div>
            )}
            <div className="h-[600px] w-full bg-slate-900 rounded-xl border border-white/10 overflow-hidden relative">
                {nodes.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-white/50 text-sm px-6 text-center">
                        No other leads found for this account yet.
                    </div>
                ) : (
                    <>
                        <div className="absolute top-4 left-4 z-10 bg-black/60 p-2 rounded text-xs text-white space-y-1">
                            {Object.entries(STAGE_LABELS).map(([stage, label]) => (
                                <div key={stage} className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded" style={{ background: STAGE_COLORS[stage] }} />
                                    {label}
                                </div>
                            ))}
                        </div>
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={onConnect}
                            onNodeClick={onNodeClick}
                            fitView
                        >
                            <Background color="#aaa" gap={16} />
                            <Controls />
                        </ReactFlow>
                    </>
                )}
            </div>
        </div>
    );
}
