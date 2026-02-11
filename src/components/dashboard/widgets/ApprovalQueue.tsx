
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
        <Card className="glass border-orange-500/20 shadow-xl shadow-orange-500/5">
            <CardHeader className="pb-3 border-b border-white/5 bg-gradient-to-r from-orange-500/10 to-transparent">
                <CardTitle className="text-base font-bold flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                        </div>
                        <span className="text-white">Governance Gate</span>
                        <Button variant="ghost" size="icon" className="h-4 w-4 hover:bg-white/10" onClick={loadData}>
                            <RefreshCcw className={`w-3 h-3 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                    <Badge variant="outline" className="text-orange-400 border-orange-400/30 bg-orange-400/5 px-2 py-0 text-[10px] font-black uppercase">
                        {requests.length} Critical Awaiting
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-h-[450px] overflow-y-auto pt-4 thin-scrollbar">
                <AnimatePresence mode="popLayout">
                    {requests.length === 0 ? (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center text-gray-500 text-sm py-12 italic"
                        >
                            All systems go. No pending interventions.
                        </motion.div>
                    ) : (
                        requests.map((req, idx) => (
                            <motion.div 
                                key={req.id}
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, x: -100 }}
                                transition={{ delay: idx * 0.05 }}
                                className="flex flex-col gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-orange-500/30 transition-all group"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 rounded-lg bg-orange-500/20">
                                            <AlertTriangle className="w-4 h-4 text-orange-400" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-orange-500/80 block leading-none mb-1">{req.type}</span>
                                            <span className="text-sm font-bold text-white">Manual Review Required</span>
                                        </div>
                                    </div>
                                    <Badge variant="secondary" className="text-[10px] bg-red-500/10 text-red-400 border-red-500/20">{req.risk}</Badge>
                                </div>
                                <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                                    <p className="text-xs text-gray-400 font-mono leading-relaxed line-clamp-3">
                                        {req.detail}
                                    </p>
                                </div>
                                <div className="flex gap-2 mt-1">
                                    <Button size="sm" className="w-full h-9 rounded-xl font-bold bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-600/20 transition-all active:scale-95" onClick={() => handleApprove(req.id)}>
                                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Approve
                                    </Button>
                                    <Button size="sm" variant="outline" className="w-full h-9 rounded-xl font-bold border-white/10 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all active:scale-95" onClick={() => handleReject(req.id)}>
                                        <XCircle className="w-3.5 h-3.5 mr-1.5" /> Reject
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
