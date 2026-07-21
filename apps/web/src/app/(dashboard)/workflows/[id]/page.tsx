"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import WorkflowEditor from '@/modules/workflow/components/WorkflowEditor';
import { ReactFlowProvider } from 'reactflow';

export default function WorkflowEditorPage() {
    const { id } = useParams();
    const [workflow, setWorkflow] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        fetch(`${(process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy")}/workflows/${id}`)
            .then(res => res.json())
            .then(data => {
                setWorkflow(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, [id]);

    if (loading) return <div className="p-8 text-white/60">Loading workflow...</div>;
    if (!workflow || workflow.error) return <div className="p-8 text-red-400">Workflow not found</div>;

    return (
        <div className="h-[calc(100vh-64px)] flex flex-col">
            <div className="px-8 py-4 border-b border-white/10 bg-slate-900/50 backdrop-blur-md flex justify-between items-center z-10">
                <div>
                    <h1 className="text-xl font-bold text-white">{workflow.name}</h1>
                    <p className="text-xs text-brand-gray-400">{workflow.description || "Draft Workflow"}</p>
                </div>
                <div className="flex gap-2">
                    {/* Actions handled inside Editor currently */}
                </div>
            </div>

            <div className="flex-1 bg-slate-950 p-4">
                <ReactFlowProvider>
                    <WorkflowEditor
                        workflowId={id as string}
                        initialNodes={workflow.nodes || []}
                        initialEdges={workflow.edges || []}
                    />
                </ReactFlowProvider>
            </div>
        </div>
    );
}
