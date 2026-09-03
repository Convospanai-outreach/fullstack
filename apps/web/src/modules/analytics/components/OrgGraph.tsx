"use client";

import { useEffect, useState, useCallback } from 'react';
import ReactFlow, {
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    applyNodeChanges,
    applyEdgeChanges,
    type NodeChange,
    type EdgeChange
} from 'reactflow';
import 'reactflow/dist/style.css';
import { getBrowserApiBase } from "@/lib/api/browserBase";

export default function OrgGraph() {
    const [nodes, setNodes] = useNodesState([]);
    const [edges, setEdges] = useEdgesState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(getBrowserApiBase() + '/analytics/graph')
            .then(res => res.json())
            .then(data => {
                if (data.nodes) setNodes(data.nodes);
                if (data.edges) setEdges(data.edges);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch graph", err);
                setLoading(false);
            });
    }, [setNodes, setEdges]);

    const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)), [setNodes]);
    const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)), [setEdges]);

    if (loading) return <div className="h-[500px] flex items-center justify-center text-white/50">Loading Organization Map...</div>;

    return (
        <div className="h-[600px] w-full bg-slate-900 rounded-xl border border-white/10 overflow-hidden">
            <div className="absolute top-4 left-4 z-10 bg-black/50 p-2 rounded text-xs text-white">
                <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 bg-blue-600 rounded"></div> Team</div>
                <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 border border-gray-500 rounded"></div> User</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-purple-500 rounded"></div> Campaign</div>
            </div>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                fitView
            >
                <Background color="#aaa" gap={16} />
                <Controls />
            </ReactFlow>
        </div>
    );
}
