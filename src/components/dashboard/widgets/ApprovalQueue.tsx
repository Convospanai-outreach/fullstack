
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle, RefreshCcw } from "lucide-react";
import { approveTask, rejectTask, getPendingApprovals } from "@/app/actions/agent";
import { toast } from "sonner"; // Assuming sonner is installed, or use standard alert

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
        // Poll every 10s for live updates
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
        <Card className="h-full">
            <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span>Governance Gate</span>
                        <Button variant="ghost" size="icon" className="h-4 w-4" onClick={loadData}>
                            <RefreshCcw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                    <Badge variant="outline" className="text-yellow-500 border-yellow-500/50">
                        {requests.length} Pending
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-h-[400px] overflow-y-auto">
                {requests.length === 0 ? (
                    <div className="text-center text-muted-foreground text-sm py-8">
                        No pending approvals.
                    </div>
                ) : (
                    requests.map(req => (
                        <div key={req.id} className="flex flex-col gap-2 p-3 rounded-md bg-muted/30 border border-border/50">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                                    <span className="text-sm font-semibold">{req.type}</span>
                                </div>
                                <Badge variant="secondary" className="text-xs">{req.risk}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground font-mono bg-background/50 p-1 rounded">
                                {req.detail}
                            </p>
                            <div className="flex gap-2 mt-1">
                                <Button size="sm" variant="default" className="w-full h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => handleApprove(req.id)}>
                                    <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
                                </Button>
                                <Button size="sm" variant="destructive" className="w-full h-7 text-xs" onClick={() => handleReject(req.id)}>
                                    <XCircle className="w-3 h-3 mr-1" /> Reject
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </CardContent>
        </Card>
    );
}
