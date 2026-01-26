"use client";

import { useState } from "react";
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    ReactFlowProvider,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    Edge,
    Node
} from "reactflow";
import "reactflow/dist/style.css";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
    Play,
    Save,
    Plus,
    Bot,
    Database
} from "lucide-react";
import { toast } from "sonner";
import { AgentNode } from "@/components/orchestrator/nodes/AgentNode";
import { TriggerNode } from "@/components/orchestrator/nodes/TriggerNode";
import { ActionNode } from "@/components/orchestrator/nodes/ActionNode";

const nodeTypes = {
    agent: AgentNode,
    trigger: TriggerNode,
    action: ActionNode,
};

const initialNodes: Node[] = [
    {
        id: '1',
        type: 'trigger',
        position: { x: 250, y: 50 },
        data: { label: 'New Lead Detected', source: 'HubSpot', icon: Database }
    },
    {
        id: '2',
        type: 'agent',
        position: { x: 250, y: 200 },
        data: { label: 'Enrichment Agent', model: 'GPT-4', role: 'Researcher' }
    },
    {
        id: '3',
        type: 'agent',
        position: { x: 250, y: 400 },
        data: { label: 'Outreach Drafter', model: 'Claude-3', role: 'Copywriter' }
    },
];

const initialEdges: Edge[] = [
    { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: '#4f46e5' } },
    { id: 'e2-3', source: '2', target: '3', animated: true, style: { stroke: '#4f46e5' } },
];

export default function AgentBuilderPage() {
    const [nodes, _, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [isRunning, setIsRunning] = useState(false);

    const onConnect = (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#4f46e5' } }, eds));

    const handleRunSimulation = async () => {
        setIsRunning(true);
        toast.message("Initializing Agent Swarm...", {
            description: "Spinning up secure containers for 2 agents."
        });

        await new Promise(r => setTimeout(r, 2000));
        toast.success("Workflow Executed Successfully", {
            description: "Processed 1 sample lead through the pipeline."
        });
        setIsRunning(false);
    };

    return (
        <ReactFlowProvider>
            <AppShell>
                <div className="h-[calc(100vh-140px)] flex flex-col bg-black/20 rounded-2xl border border-white/10 overflow-hidden relative group">

                    {/* Toolbar */}
                    <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-center pointer-events-none px-2">
                        <div className="bg-black/60 backdrop-blur-md p-1.5 rounded-xl border border-white/10 pointer-events-auto flex gap-1 shadow-2xl">
                            <Button variant="ghost" className="gap-2 text-white h-8">
                                <Plus className="w-4 h-4" />
                                Add Node
                            </Button>
                            <div className="w-px bg-white/10 mx-1" />
                            <Button variant="ghost" className="gap-2 text-text-secondary hover:text-white h-8">
                                <Bot className="w-4 h-4" />
                                Templates
                            </Button>
                        </div>

                        <div className="bg-black/60 backdrop-blur-md p-1.5 rounded-xl border border-white/10 pointer-events-auto flex gap-2 shadow-2xl">
                            <Button
                                variant="outline"
                                onClick={() => toast.success("Workflow Saved")}
                                className="h-8 border-white/10 hover:bg-white/5"
                            >
                                <Save className="w-4 h-4 mr-2" />
                                Save
                            </Button>
                            <Button
                                onClick={handleRunSimulation}
                                loading={isRunning}
                                className="h-8 bg-accent-blue hover:bg-blue-600 text-white border-none shadow-glow"
                            >
                                <Play className="w-4 h-4 mr-2 fill-current" />
                                Run Test
                            </Button>
                        </div>
                    </div>

                    {/* Canvas */}
                    <div className="flex-1 w-full h-full bg-[#0a0a0a]">
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={onConnect}
                            nodeTypes={nodeTypes}
                            fitView
                            snapToGrid
                            proOptions={{ hideAttribution: true }}
                            className="bg-dots-pattern"
                        >
                            <Background color="#333" gap={20} size={1} />
                            <Controls className="bg-black/50 border-white/10 text-white" />
                            <MiniMap
                                style={{ background: '#111', border: '1px solid #333' }}
                                nodeColor={() => '#4f46e5'}
                                maskColor="rgba(0, 0, 0, 0.7)"
                            />
                        </ReactFlow>
                    </div>
                </div>
            </AppShell>
        </ReactFlowProvider>
    );
}
