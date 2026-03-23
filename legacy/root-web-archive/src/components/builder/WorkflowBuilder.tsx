"use client";

import { useCallback } from 'react';
import ReactFlow, {
    addEdge,
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    Node,
    Edge,
    Connection
} from 'reactflow';
import 'reactflow/dist/style.css';

const initialNodes: Node[] = [
    { id: '1', position: { x: 250, y: 5 }, data: { label: 'Start: Lead Detected' }, type: 'input' },
    { id: '2', position: { x: 250, y: 100 }, data: { label: 'Action: Hardware Check' } },
];

const initialEdges: Edge[] = [
    { id: 'e1-2', source: '1', target: '2' }
];

const TEMPLATES = {
    "auto-reply": {
        nodes: [
            { id: '1', position: { x: 250, y: 50 }, data: { label: 'Input: Lead Email' }, type: 'input' },
            { id: '2', position: { x: 250, y: 150 }, data: { label: 'Action: Mask PII' } },
            { id: '3', position: { x: 250, y: 250 }, data: { label: 'AI: Draft Reply' } },
            { id: '4', position: { x: 250, y: 350 }, data: { label: 'Review: Pending' }, type: 'output' },
        ],
        edges: [
            { id: 'e1', source: '1', target: '2' },
            { id: 'e2', source: '2', target: '3' },
            { id: 'e3', source: '3', target: '4' },
        ]
    },
    "contract": {
        nodes: [
            { id: '1', position: { x: 250, y: 50 }, data: { label: 'Input: Contract PDF' }, type: 'input' },
            { id: '2', position: { x: 250, y: 150 }, data: { label: 'Action: OCR & Parse' } },
            { id: '3', position: { x: 150, y: 300 }, data: { label: 'Check: Risk > High?' } },
            { id: '4', position: { x: 400, y: 300 }, data: { label: 'Action: Summarize' } },
        ],
        edges: [
            { id: 'e1', source: '1', target: '2' },
            { id: 'e2', source: '2', target: '3' },
            { id: 'e3', source: '2', target: '4' },
        ]
    },
    "tax": {
        nodes: [
            { id: '1', position: { x: 250, y: 50 }, data: { label: 'Trigger: Quarterly' }, type: 'input' },
            { id: '2', position: { x: 250, y: 150 }, data: { label: 'Action: Fetch Invoices' } },
            { id: '3', position: { x: 250, y: 250 }, data: { label: 'Action: Calculate GST' } },
        ],
        edges: [
            { id: 'e1', source: '1', target: '2' },
            { id: 'e2', source: '2', target: '3' },
        ]
    }
};

export default function WorkflowBuilder() {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    const loadTemplate = (key: keyof typeof TEMPLATES) => {
        const template = TEMPLATES[key];
        setNodes(template.nodes);
        setEdges(template.edges);
    };

    const saveWorkflow = async () => {
        // In a real implementation we would get the full flow instance object
        // const flow = reactFlowInstance.toObject();
        const flow = { nodes, edges };
        console.log("Saving to Edge Node...", flow);

        try {
            // Using dynamic import or direct call if HardwareService was available in client.
            // For now, we mock the alert to show intent as per requirement.
            // await HardwareService.saveWorkflow(flow);
            alert("Workflow Saved to Local Edge Node (Sovereign Storage)!");
        } catch (e) {
            alert("Failed to save to Edge Node.");
        }
    };

    const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

    const addNode = (label: string) => {
        const newNode: Node = {
            id: `${nodes.length + 1}`,
            position: { x: Math.random() * 400, y: Math.random() * 400 },
            data: { label: label },
        };
        setNodes((nds) => nds.concat(newNode));
    };

    return (
        <div className="h-[600px] w-full border border-gray-700 rounded-lg overflow-hidden bg-gray-900 text-white flex flex-col">
            <div className="p-4 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
                <div className="flex gap-2">
                    <button onClick={() => addNode("New Action")} className="px-3 py-1.5 bg-blue-600 rounded hover:bg-blue-500 text-sm">
                        + Action
                    </button>
                    <button onClick={() => addNode("Condition")} className="px-3 py-1.5 bg-purple-600 rounded hover:bg-purple-500 text-sm">
                        + Condition
                    </button>
                    <select
                        className="px-3 py-1.5 bg-gray-700 rounded text-sm outline-none"
                        onChange={(e) => loadTemplate(e.target.value as any)}
                        defaultValue=""
                    >
                        <option value="" disabled>Load Template...</option>
                        <option value="auto-reply">Auto-Reply to Leads</option>
                        <option value="contract">Contract Review</option>
                        <option value="tax">Tax Filing Query</option>
                    </select>
                </div>
                <button onClick={saveWorkflow} className="px-4 py-1.5 bg-green-600 rounded hover:bg-green-500 text-sm font-semibold">
                    Save to Edge Node
                </button>
            </div>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                fitView
            >
                <Controls />
                <MiniMap />
                <Background gap={12} size={1} />
            </ReactFlow>
        </div>
    );
}
