
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle, RefreshCcw } from "lucide-react";
import { approveTask, rejectTask, getPendingApprovals } from "@/app/actions/agent";
import { toast } from "sonner"; // Assuming sonner is installed, or use standard alert

import { motion, AnimatePresence } from "framer-motion";

export function ApprovalQueue() {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await getPendingApprovals("team-convo-1"); // Hardcoded team for MVP
            setRequests(data);
        } catch (e) {
            console.error("Failed to load approvals", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 10000);
        return () => clearInterval(interval);
    }, []);

    const handleApprove = async (id: string) => {
        try {
            await approveTask(id, "admin-user");
            setRequests(prev => prev.filter(r => r.id !== id));
            toast.success("Task Approved");
        } catch (e) {
            toast.error("Approval Failed");
        }
    };

    const handleReject = async (id: string) => {
        try {
            await rejectTask(id, "admin-user");
            setRequests(prev => prev.filter(r => r.id !== id));
            toast.success("Task Rejected");
        } catch (e) {
            toast.error("Rejection Failed");
        }
    };

    return (
    return (
        <Card className="glass-premium border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl relative">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 blur-3xl rounded-full" />
            
            <CardHeader className="pb-6 pt-8 px-8 border-b border-white/5 bg-white/[0.02]">
                <CardTitle className="text-xl font-bold font-outfit flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400/50 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]"></span>
                        </div>
                        <span className="text-white tracking-tight">Governance Gate</span>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 hover:bg-white/5 rounded-lg ml-1" 
                            onClick={loadData}
                        >
                            <RefreshCcw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                    <Badge variant="outline" className="text-orange-400 border-orange-500/30 bg-orange-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                        {requests.length} Awaiting
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 max-h-[500px] overflow-y-auto pt-8 px-8 pb-8 thin-scrollbar relative z-10">
                <AnimatePresence mode="popLayout">
                    {requests.length === 0 ? (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center text-slate-500 text-sm py-16 italic font-medium"
                        >
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
                                className="flex flex-col gap-4 p-5 rounded-3xl bg-white/[0.03] border border-white/5 hover:border-orange-500/20 transition-all group/item shadow-lg"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 rounded-xl bg-orange-500/10 group-hover/item:scale-110 transition-transform">
                                            <AlertTriangle className="w-5 h-5 text-orange-400" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500/60 block leading-none mb-1.5">{req.type}</span>
                                            <span className="text-base font-bold text-white font-outfit">Sovereign Intervention</span>
                                        </div>
                                    </div>
                                    <Badge variant="secondary" className="text-[10px] h-5 bg-red-500/10 text-red-400 border-red-500/20 px-2 font-black uppercase tracking-tighter">{req.risk}</Badge>
                                </div>
                                <div className="p-4 rounded-2xl bg-black/30 border border-white/5">
                                    <p className="text-xs text-slate-400 font-medium leading-relaxed line-clamp-3 italic">
                                        "{req.detail}"
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-2">
                                    <Button 
                                        size="sm" 
                                        className="w-full h-11 rounded-1.5xl font-black text-xs uppercase tracking-widest bg-orange-600 hover:bg-orange-500 text-white shadow-xl shadow-orange-600/10 transition-all active:scale-95 border-none" 
                                        onClick={() => handleApprove(req.id)}
                                    >
                                        <CheckCircle2 className="w-4 h-4 mr-2" /> Approve
                                    </Button>
                                    <Button 
                                        size="sm" 
                                        variant="outline" 
                                        className="w-full h-11 rounded-1.5xl font-black text-xs uppercase tracking-widest border-white/5 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all active:scale-95 bg-white/5" 
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
    );
}
