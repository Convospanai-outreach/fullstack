"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function WorkflowsPage() {
    const [workflows, setWorkflows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        fetchWorkflows();
    }, []);

    const fetchWorkflows = async () => {
        try {
            const res = await fetch('/api/workflows');
            const data = await res.json();
            setWorkflows(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        const name = prompt("Enter Workflow Name:");
        if (!name) return;

        try {
            const res = await fetch('/api/workflows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            const newWorkflow = await res.json();
            router.push(`/workflows/${newWorkflow.id}`);
        } catch (e) {
            toast.error("Failed to create workflow");
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Are you sure?")) return;

        await fetch(`/api/workflows/${id}`, { method: 'DELETE' });
        fetchWorkflows();
        toast.success("Workflow deleted");
    };

    if (loading) return <div className="p-8">Loading workflows...</div>;

    return (
        <div className="p-8 space-y-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center">
                <SectionHeader title="Workflow Automation" subtitle="Design and manage outreach flows" />
                <button
                    onClick={handleCreate}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
                >
                    + New Workflow
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {workflows.map(wf => (
                    <GlassCard
                        key={wf.id}
                        className="p-6 cursor-pointer hover:border-blue-500/50 transition-colors group relative"
                        onClick={() => router.push(`/workflows/${wf.id}`)}
                    >
                        <h3 className="text-lg font-bold text-white mb-2">{wf.name}</h3>
                        <p className="text-sm text-gray-400 mb-4">{wf.description || "No description"}</p>

                        <div className="flex justify-between items-center text-xs text-gray-500">
                            <span>{wf.triggerType} Trigger</span>
                            <span className={wf.isActive ? "text-green-400" : "text-yellow-400"}>
                                {wf.isActive ? "Active" : "Draft"}
                            </span>
                        </div>

                        <button
                            onClick={(e) => handleDelete(wf.id, e)}
                            className="absolute top-4 right-4 text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-900/20 p-1 rounded"
                            title="Delete workflow"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </GlassCard>
                ))}

                {workflows.length === 0 && (
                    <div className="col-span-full text-center py-12 text-gray-500 bg-white/5 rounded-2xl border border-dashed border-white/10">
                        No workflows found. Create one to get started.
                    </div>
                )}
            </div>
        </div>
    );
}
