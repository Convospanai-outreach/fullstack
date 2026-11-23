"use client";

import { useCallback, useState } from 'react';
import ReactFlow, {
    addEdge,
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    Connection,
    Node,
    Panel
} from 'reactflow';
import 'reactflow/dist/style.css';
import { toast } from 'sonner';
import { Bot, Mail, Clock, Split } from 'lucide-react';

import { AiNode, DelayNode, ConditionNode, ActionNode } from './nodes/CustomNodes';
import { WorkflowNode, WorkflowEdge } from '../types';
import { Edge } from 'reactflow';
import { getBrowserApiBase } from "@/lib/api/browserBase";

const nodeTypes = {
    ai: AiNode,
    delay: DelayNode,
    condition: ConditionNode,
    action: ActionNode,
};

interface WorkflowEditorProps {
    initialNodes?: WorkflowNode[];
    initialEdges?: WorkflowEdge[];
    workflowId: string;
    onSave?: (nodes: Node[], edges: Edge[]) => void;
}

export default function WorkflowEditor({ initialNodes = [], initialEdges = [], workflowId, onSave }: WorkflowEditorProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes as unknown as Node[]);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges as unknown as Edge[]);

    const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

    const [suggesting, setSuggesting] = useState(false);

    // Resilience: Detect Cyclic Dependencies (DFS)
    const detectCycles = (nodes: Node[], edges: Edge[]) => {
        const adjacency = new Map<string, string[]>();
        edges.forEach(edge => {
            const current = adjacency.get(edge.source) || [];
            current.push(edge.target);
            adjacency.set(edge.source, current);
        });

        const visited = new Set<string>();
        const recursionStack = new Set<string>();

        const hasCycle = (nodeId: string): boolean => {
            if (!visited.has(nodeId)) {
                visited.add(nodeId);
                recursionStack.add(nodeId);

                const neighbors = adjacency.get(nodeId) || [];
                for (const neighbor of neighbors) {
                    if (!visited.has(neighbor) && hasCycle(neighbor)) return true;
                    if (recursionStack.has(neighbor)) return true;
                }
            }
            recursionStack.delete(nodeId);
            return false;
        };

        for (const node of nodes) {
            if (hasCycle(node.id)) return true;
        }
        return false;
    };

    const handleSave = async () => {
        if (detectCycles(nodes, edges)) {
            toast.error("Infinite loop detected! Please fix cyclic dependencies.");
            return;
        }

        if (onSave) {
            onSave(nodes, edges);
        } else {
            try {
                const res = await fetch(`${getBrowserApiBase()}/workflows/${workflowId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nodes, edges })
                });
                if (res.ok) toast.success('Workflow saved');
                else toast.error('Failed to save');
            } catch (e) {
                toast.error('Error saving workflow');
            }
        }
    };

    const addNode = (type: string, label: string, extraData: any = {}) => {
        const id = `${type}-${Date.now()}`;
        const newNode: Node = {
            id,
            type,
            position: { x: Math.random() * 400 + 50, y: Math.random() * 400 + 50 }, // Randomize slightly for visibility
            data: { label, ...extraData },
        };
        setNodes((nds) => nds.concat(newNode));
        return newNode;
    };

    const handleAiSuggest = () => {
        setSuggesting(true);
        setTimeout(() => {
            // Heuristic: suggest a Wait node if last was Action, or Condition if last was Wait
            const lastNode = nodes[nodes.length - 1];
            let suggestion: any = { type: 'delay', label: 'Wait 2 Days', data: { delay: '2d' } };

            if (lastNode?.type === 'action') {
                suggestion = { type: 'condition', label: 'Opened Email?', data: { type: 'OPENED' } };
            } else if (lastNode?.type === 'condition') {
                suggestion = { type: 'ai', label: 'Follow-up Draft', data: { tone: 'urgent' } };
            }

            const newNode = addNode(suggestion.type, suggestion.label, suggestion.data);

            // Auto-connect if there was a previous node
            if (lastNode) {
                setEdges((eds) => addEdge({
                    source: lastNode.id,
                    target: newNode.id,
                    sourceHandle: null,
                    targetHandle: null
                }, eds));
            }

            toast.success(`AI Suggested: ${suggestion.label}`);
            setSuggesting(false);
        }, 800);
    };

    return (
        <div className="h-[750px] w-full border border-foreground/10 rounded-2xl bg-background overflow-hidden shadow-2xl shadow-primary/20 relative">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
                className="bg-dots"
            >
                <Controls />
                <MiniMap
                    style={{ background: 'hsl(var(--background))' }}
                    maskColor="rgba(0, 0, 0, 0.7)"
                    nodeColor={(n: any) => {
                        if (n.type === 'ai') return 'hsl(var(--chart-1))';
                        if (n.type === 'condition') return 'hsl(var(--warning))';
                        if (n.type === 'action') return 'hsl(var(--chart-2))';
                        return 'hsl(var(--muted-foreground))';
                    }}
                />
                <Background gap={20} size={1} color="hsl(var(--border))" />

                <Panel position="top-left" className="bg-background/90 backdrop-blur-md p-4 rounded-2xl border border-foreground/10 flex flex-col gap-3 shadow-xl max-h-[80%] overflow-y-auto">
                    <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Nodes Palette</h3>

                    <button onClick={() => addNode('ai', 'AI Outreach Draft', { tone: 'professional' })} className="flex items-center gap-2 px-3 py-2 bg-primary/20 text-primary border border-primary/30 text-xs rounded-xl hover:bg-primary/30 transition">
                        <Bot className="w-4 h-4" /> AI Persona Step
                    </button>

                    <button onClick={() => addNode('action', 'Send Email', { actionType: 'EMAIL' })} className="flex items-center gap-2 px-3 py-2 bg-primary/20 text-primary border border-primary/30 text-xs rounded-xl hover:bg-primary/30 transition">
                        <Mail className="w-4 h-4" /> Email Action
                    </button>

                    <button onClick={() => addNode('delay', 'Wait', { delay: '1 day' })} className="flex items-center gap-2 px-3 py-2 bg-secondary/20 text-foreground/80 border border-border/30 text-xs rounded-xl hover:bg-secondary/30 transition">
                        <Clock className="w-4 h-4" /> Time Delay
                    </button>

                    <button onClick={() => addNode('condition', 'Has Replied?', { type: 'REPLIED' })} className="flex items-center gap-2 px-3 py-2 bg-warning/20 text-warning border border-warning/30 text-xs rounded-xl hover:bg-warning/30 transition">
                        <Split className="w-4 h-4" /> Logic Split
                    </button>

                    <div className="h-[1px] bg-foreground/10 my-1"></div>

                    <button
                        onClick={handleAiSuggest}
                        disabled={suggesting}
                        className="flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-chart-4 to-chart-4/60 text-primary-foreground text-xs font-bold rounded-xl hover:opacity-90 shadow-lg shadow-chart-4/20 transition disabled:opacity-50"
                    >
                        {suggesting ? <span className="animate-spin">✨</span> : "✨"} AI Magic Suggest
                    </button>

                    <button onClick={handleSave} className="flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:bg-primary shadow-lg shadow-primary/40 transition">
                        Save Workflow
                    </button>
                </Panel>
            </ReactFlow>
        </div>
    );
}
