
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle, RefreshCcw } from "lucide-react";
import { approveTask, rejectTask, getPendingApprovals } from "@/app/actions/agent";
import { toast } from "sonner"; // Assuming sonner is installed, or use standard alert

import { motion, AnimatePresence } from "framer-motion";

interface ApprovalQueueProps {
    teamId?: string;
    userId?: string;
}

export function ApprovalQueue({ teamId, userId }: ApprovalQueueProps) {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editedContent, setEditedContent] = useState<string>("");

    const loadData = async () => {
        setLoading(true);
        if (!teamId) {
            setRequests([]);
            setLoading(false);
            return;
        }
        try {
            const data = await getPendingApprovals(teamId);
            setRequests(data);
        } catch (e) {
            console.error("Failed to load approvals", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 15000);
        return () => clearInterval(interval);
    }, [teamId]);

    const handleApprove = async (request: any) => {
        if (!userId) {
            toast.error("Approval unavailable: user context is missing");
            return;
        }
        try {
            let revisedPayload = null;
            if (editingId === request.id) {
                // If we're editing, try to merge the edited content back into the payload
                // For MCP tool calls, we might edit 'args'. For simple drafts, we edit 'draft_content'.
                const payload = typeof request.payload === 'string' ? JSON.parse(request.payload) : request.payload;
                
                if (request.type === "MCP_TOOL_EXECUTION") {
                    revisedPayload = { args: JSON.parse(editedContent) };
                } else if (payload?.draft_content) {
                    revisedPayload = { draft_content: editedContent };
                } else {
                    revisedPayload = JSON.parse(editedContent);
                }
            }

            await approveTask(request.id, userId, revisedPayload);
            setRequests(prev => prev.filter(r => r.id !== request.id));
            setEditingId(null);
            toast.success("Action Approved & Dispatched");
        } catch (e) {
            toast.error("Approval Failed: Check JSON format if edited");
        }
    };

    const handleReject = async (id: string) => {
        if (!userId) {
            toast.error("Rejection unavailable: user context is missing");
            return;
        }
        try {
            await rejectTask(id, userId);
            setRequests(prev => prev.filter(r => r.id !== id));
            setEditingId(null);
            toast.success("Action Terminated");
        } catch (e) {
            toast.error("Rejection Failed");
        }
    };

    const startEditing = (req: any) => {
        setEditingId(req.id);
        const payload = typeof req.payload === 'string' ? JSON.parse(req.payload) : req.payload;
        
        if (req.type === "MCP_TOOL_EXECUTION") {
            setEditedContent(JSON.stringify(payload.args || payload, null, 2));
        } else {
            setEditedContent(payload.draft_content || payload.goal || JSON.stringify(payload, null, 2));
        }
    };

    return (
        <Card className="border-border rounded-[2.5rem] overflow-hidden shadow-sm relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/[0.04] blur-3xl rounded-full" />

            <CardHeader className="pb-6 pt-8 px-8 border-b border-border bg-muted/40">
                <CardTitle className="text-xl font-bold font-outfit flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400/50 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                        </div>
                        <span className="text-foreground tracking-tight">Governance Gate</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted rounded-lg ml-1" onClick={loadData}>
                            <RefreshCcw className={`w-4 h-4 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                    <Badge variant="outline" className="text-orange-700 border-orange-300 bg-orange-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                        {requests.length} Awaiting
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 max-h-[500px] overflow-y-auto pt-8 px-8 pb-8 thin-scrollbar relative z-10">
                <AnimatePresence mode="popLayout">
                    {!teamId ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-muted-foreground text-sm py-16 italic font-medium">
                            Approval queue needs team context before actions can load.
                        </motion.div>
                    ) : requests.length === 0 ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-muted-foreground text-sm py-16 italic font-medium">
                            All systems healthy. No actions pending.
                        </motion.div>
                    ) : (
                        requests.map((req, idx) => (
                            <motion.div
                                key={req.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ delay: idx * 0.1 }}
                                className="flex flex-col gap-4 p-5 rounded-2xl bg-card border border-border border-l-[3px] border-l-orange-500 transition-all group/item cursor-default"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 rounded-xl bg-orange-100 group-hover/item:scale-110 transition-transform">
                                            <AlertTriangle className="w-5 h-5 text-orange-700" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-700/70 block leading-none mb-1.5">{req.type}</span>
                                            <span className="text-base font-bold text-foreground font-outfit">Sovereign Intervention</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        {req.tier === "HARD_BLOCK" ? (
                                            <Badge variant="secondary" className="text-[10px] h-5 bg-red-100 text-red-700 border-red-200 px-2 font-black uppercase tracking-tighter">Hard Block</Badge>
                                        ) : (
                                            <Badge variant="secondary" className="text-[10px] h-5 bg-amber-100 text-amber-700 border-amber-200 px-2 font-black uppercase tracking-tighter">Queued · 24h</Badge>
                                        )}
                                        <Badge variant="secondary" className="text-[10px] h-5 bg-red-100 text-red-700 border-red-200 px-2 font-black uppercase tracking-tighter">{req.risk}</Badge>
                                        <button
                                            onClick={() => startEditing(req)}
                                            className="text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest"
                                        >
                                            {editingId === req.id ? 'Editing...' : '[ Edit Draft ]'}
                                        </button>
                                    </div>
                                </div>
                                <div className="p-4 rounded-2xl bg-muted border border-border">
                                    {editingId === req.id ? (
                                        <textarea
                                            value={editedContent}
                                            onChange={(e) => setEditedContent(e.target.value)}
                                            className="w-full bg-transparent text-xs text-foreground font-mono focus:outline-none min-h-[100px] leading-relaxed resize-none"
                                            autoFocus
                                            aria-label="Edit draft content"
                                            placeholder="Edit draft here..."
                                        />
                                    ) : (
                                        <p className="text-xs text-muted-foreground font-medium leading-relaxed line-clamp-3 italic">
                                            "{req.detail}"
                                        </p>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-2">
                                    <Button
                                        size="sm"
                                        className="w-full h-11 rounded-1.5xl font-black text-xs uppercase tracking-widest bg-orange-600 hover:bg-orange-500 text-white transition-all active:scale-95 border-none"
                                        onClick={() => handleApprove(req)}
                                    >
                                        <CheckCircle2 className="w-4 h-4 mr-2" /> {editingId === req.id ? 'Apply & Approve' : 'Approve'}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="w-full h-11 rounded-1.5xl font-black text-xs uppercase tracking-widest border-border hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-all active:scale-95 bg-card"
                                        onClick={() => handleReject(req.id)}
                                    >
                                        <XCircle className="w-4 h-4 mr-2" /> Reject
                                    </Button>
                                </div>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </CardContent>
        </Card>
    );
}
