"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getBrowserApiBase } from "@/lib/api/browserBase";

const API_URL = getBrowserApiBase();

type ApprovalRequest = {
    id: string;
    actionType: string;
    entityType: string;
    entityId: string;
    status: string;
    payload?: any;
    requester?: { name?: string | null; email?: string | null } | null;
    createdAt: string;
};

export function ApprovalGate() {
    const [requests, setRequests] = useState<ApprovalRequest[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingId, setLoadingId] = useState<string | null>(null);

    const refreshRequests = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/approvals`);
            if (!res.ok) {
                throw new Error("Failed to load approvals");
            }
            const data = await res.json();
            setRequests(data?.requests || []);
        } catch (e) {
            console.error("Failed to fetch approvals", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshRequests();
    }, []);

    const handleAction = async (id: string, action: "APPROVE" | "REJECT") => {
        setLoadingId(id);
        try {
            const reason = action === "REJECT" ? window.prompt("Reason for rejection? (optional)") : undefined;
            const res = await fetch(`${API_URL}/approvals/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, reason })
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({}));
                throw new Error(error?.error || "Failed to process approval");
            }
            toast.success(action === "APPROVE" ? "Approved" : "Rejected");
            setRequests((prev) => prev.filter((r) => r.id !== id));
        } catch (e: any) {
            toast.error(e?.message || "Failed to process action");
        } finally {
            setLoadingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8 text-muted-foreground border border-dashed rounded-lg">
                Loading approvals...
            </div>
        );
    }

    if (requests.length === 0) {
        return (
            <div className="flex items-center justify-center p-8 text-muted-foreground border border-dashed rounded-lg">
                No pending approvals
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                </span>
                Pending Actions ({requests.length})
            </h3>

            <div className="grid gap-4">
                {requests.map((request) => {
                    const payloadText = request.payload ? JSON.stringify(request.payload, null, 2) : "No payload";
                    return (
                        <Card key={request.id} className="border-l-4 border-l-orange-500">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <span className="capitalize">{request.actionType.replace(/_/g, " ")}</span>
                                    </div>
                                    <Badge variant="outline" className="text-xs">{request.status}</Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pb-2 space-y-2">
                                <div className="text-xs text-muted-foreground">Entity: {request.entityType} / {request.entityId}</div>
                                <div className="text-xs text-muted-foreground">Requested by: {request.requester?.name || request.requester?.email || "Unknown"}</div>
                                <pre className="p-3 bg-muted rounded text-xs font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">{payloadText}</pre>
                            </CardContent>
                            <CardFooter className="justify-end gap-2 pt-2">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleAction(request.id, "REJECT")}
                                    disabled={loadingId === request.id}
                                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                                >
                                    {loadingId === request.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4 mr-1" />}
                                    Reject
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => handleAction(request.id, "APPROVE")}
                                    disabled={loadingId === request.id}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                    {loadingId === request.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                                    Approve & Execute
                                </Button>
                            </CardFooter>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
