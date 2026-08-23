"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    Activity,
    Trash2,
    Plus,
    Loader2,
    X,
    Cpu,
    CheckCircle2,
    AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getBrowserApiUrl } from "@/lib/api/browserBase";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";

const transitionCurve = { type: "tween", ease: [0.16, 1, 0.3, 1], duration: 0.6 } as const;

export default function WorkflowsPage() {
    const [workflows, setWorkflows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newWorkflowName, setNewWorkflowName] = useState("");
    const [creating, setCreating] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const router = useRouter();

    useEffect(() => {
        fetchWorkflows();
    }, []);

    const fetchWorkflows = async () => {
        try {
            const res = await fetch(getBrowserApiUrl('/workflows'));
            if (res.status === 401) {
                router.push('/login');
                return;
            }
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || "Failed to load automation engine state");
            }
            const data = await res.json();
            setWorkflows(Array.isArray(data) ? data : []);
            setError(null);
        } catch (e) {
            console.error(e);
            setError(e instanceof Error ? e.message : "Failed to load workflows");
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newWorkflowName.trim()) return;

        setCreating(true);
        try {
            const res = await fetch(getBrowserApiUrl('/workflows'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newWorkflowName.trim() })
            });
            if (res.status === 401) {
                router.push('/login');
                return;
            }
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || "Failed to compile new workflow structure");
            }
            const newWorkflow = await res.json();
            if (!newWorkflow?.id) throw new Error("Workflow database entry missed id");
            
            toast.success("Workflow structure generated");
            setIsCreateOpen(false);
            setNewWorkflowName("");
            router.push(`/workflows/${newWorkflow.id}`);
        } catch (e: any) {
            toast.error(e.message || "Failed to create workflow");
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Confirm complete deletion of this workflow?")) return;

        setDeletingId(id);
        try {
            const res = await fetch(getBrowserApiUrl(`/workflows/${id}`), { method: 'DELETE' });
            if (res.status === 401) {
                router.push('/login');
                return;
            }
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || "Deletion call rejected by server");
            }
            toast.success("Workflow configuration deleted");
            fetchWorkflows();
        } catch (err: any) {
            toast.error(err.message || "Failed to delete workflow");
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-12">
            {/* Header Block — Industrial Title */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/10 pb-6 gap-4">
                <div>
                    <h1 className="text-xl font-normal text-white font-outfit tracking-tight flex items-center gap-2">
                        <span className="text-zinc-600 font-mono text-sm">[03]</span>
                        Workflow Automation
                    </h1>
                    <p className="text-[11px] text-zinc-400 mt-1 max-w-xl font-sans leading-relaxed">
                        Design state-driven automation graphs, configure signal triggers, and monitor contact lifecycle automation.
                    </p>
                </div>

                <div>
                    <button
                        onClick={() => setIsCreateOpen(true)}
                        className="h-8 bg-zinc-100 hover:bg-white px-3 text-[11px] font-medium text-zinc-950 transition-colors flex items-center gap-2"
                        id="new-workflow-btn"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        New Workflow
                    </button>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="border-[0.5px] border-rose-500/20 bg-rose-500/5 text-rose-400 px-4 py-3 text-[11px] font-mono uppercase tracking-wide flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                    System State Error: {error}
                </div>
            )}

            {/* Grid Container */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[1px] bg-white/10 border-[0.5px] border-white/10 p-[1px]">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="relative h-44 bg-[#030303] overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                        </div>
                    ))}
                </div>
            ) : workflows.length === 0 ? (
                <div className="text-center py-20 border-[0.5px] border-dashed border-white/15 bg-white/2 flex flex-col items-center justify-center">
                    <Cpu className="w-10 h-10 text-zinc-600 mb-4 stroke-[1]" />
                    <h3 className="text-sm font-normal text-zinc-300 font-outfit uppercase tracking-wider">No Workflows Compiled</h3>
                    <p className="text-[11px] text-zinc-500 mt-1 max-w-sm font-sans">
                        No active automations exist. Create a new trigger workflow to start configuring sequences.
                    </p>
                    <button
                        onClick={() => setIsCreateOpen(true)}
                        className="mt-6 h-8 border border-white/10 px-4 text-[11px] font-medium text-zinc-300 hover:bg-white/5 transition-colors"
                    >
                        Configure First Workflow
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[1px] bg-white/10 border-[0.5px] border-white/10 p-[1px]">
                    <AnimatePresence mode="popLayout">
                        {workflows.map((wf, index) => {
                            const isDeleting = deletingId === wf.id;

                            return (
                                <motion.div
                                    key={wf.id}
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.98 }}
                                    transition={transitionCurve}
                                    onClick={() => router.push(`/workflows/${wf.id}`)}
                                    className="relative flex flex-col justify-between p-5 bg-[#030303] group hover:bg-[#070707] transition-colors duration-300 border-[0.5px] border-transparent hover:border-white/5 cursor-pointer"
                                >
                                    <div>
                                        {/* Status Header row */}
                                        <div className="flex justify-between items-center gap-2 mb-4">
                                            <span className="text-[8px] font-mono text-zinc-500 tracking-widest select-none">
                                                AUTOMATION 0{index + 1}
                                            </span>
                                            <span className={cn(
                                                "text-[9px] font-mono border-[0.5px] px-1.5 py-0.5 uppercase tracking-wider flex items-center gap-1",
                                                wf.isActive
                                                    ? "border-emerald-500/20 text-emerald-400 bg-emerald-500/5"
                                                    : "border-amber-500/20 text-amber-400 bg-amber-500/5"
                                            )}>
                                                {wf.isActive ? (
                                                    <>
                                                        <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                                                        ACTIVE
                                                    </>
                                                ) : (
                                                    "DRAFT STATE"
                                                )}
                                            </span>
                                        </div>

                                        {/* Name and Description */}
                                        <div className="space-y-1">
                                            <h3 className="text-[13px] font-medium text-white group-hover:text-zinc-200 transition-colors truncate">
                                                {wf.name}
                                            </h3>
                                            <p className="text-[11px] text-zinc-400 font-sans line-clamp-2 leading-relaxed min-h-[32px]">
                                                {wf.description || "No automation description compiled."}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Footer details */}
                                    <div className="mt-6 pt-4 border-t border-white/5 flex justify-between items-center text-[10px] font-mono text-zinc-500">
                                        <span>TRIGGER: {wf.triggerType ? wf.triggerType.toUpperCase() : "MANUAL"}</span>
                                        <span>SYSTEM CONFIG</span>
                                    </div>

                                    {/* Action overlays */}
                                    <button
                                        onClick={(e) => handleDelete(wf.id, e)}
                                        disabled={isDeleting}
                                        className="absolute top-4 right-4 text-zinc-500 hover:text-rose-400 p-1 opacity-0 group-hover:opacity-100 hover:bg-rose-500/5 border border-transparent hover:border-rose-500/10 transition-all rounded"
                                        title="Delete configuration"
                                    >
                                        {isDeleting ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                            <Trash2 className="w-3.5 h-3.5" />
                                        )}
                                    </button>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}

            {/* Create Dialog Modal */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="bg-[#030303] border border-white/10 text-white max-w-sm rounded-none p-5 sm:rounded-none">
                    <DialogHeader className="space-y-1">
                        <DialogTitle className="text-sm font-normal uppercase tracking-wider font-outfit text-zinc-200">
                            Create New Automation Graph
                        </DialogTitle>
                        <DialogDescription className="text-[11px] text-zinc-500 leading-normal">
                            Enter a unique identification label to establish a new state automation pipeline.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleCreate} className="space-y-4 pt-2">
                        <div className="space-y-1">
                            <input
                                type="text"
                                placeholder="AUTOMATION NAME (e.g. Lead Qualification Sync)"
                                className="w-full bg-[#060606] border border-white/10 px-3 py-2 text-[12.5px] font-mono placeholder:text-zinc-700 text-zinc-200 outline-none focus:border-zinc-500 transition-colors"
                                value={newWorkflowName}
                                onChange={(e) => setNewWorkflowName(e.target.value)}
                                required
                                disabled={creating}
                                id="new-workflow-name-input"
                            />
                        </div>

                        <DialogFooter className="flex gap-2 sm:space-x-0 pt-2 border-t border-white/5">
                            <button
                                type="button"
                                onClick={() => setIsCreateOpen(false)}
                                className="flex-1 h-8 text-[10px] font-mono uppercase tracking-wider border border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                                disabled={creating}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="flex-1 h-8 bg-zinc-100 hover:bg-white text-zinc-950 text-[10px] font-mono uppercase tracking-wider transition-colors flex items-center justify-center gap-1"
                                disabled={creating}
                            >
                                {creating ? (
                                    <>
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        Compiling...
                                    </>
                                ) : (
                                    "Initialize"
                                )}
                            </button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
