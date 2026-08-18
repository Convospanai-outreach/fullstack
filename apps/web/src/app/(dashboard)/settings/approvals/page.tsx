"use client";

import { useEffect, useState } from 'react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { toast } from 'sonner';
import {
    CheckCircle,
    XCircle,
    Clock,
    User,
    FileText
} from 'lucide-react';

export default function ApprovalsPage() {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        try {
            const res = await fetch((process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy") + "/settings/approvals");
            const data = await res.json();
            setRequests(data);
        } catch (err) {
            toast.error("Failed to load approval requests");
        } finally {
            setLoading(false);
        }
    };

    const handleResolve = async (id: string, status: "APPROVED" | "REJECTED") => {
        try {
            const res = await fetch((process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy") + "/settings/approvals", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, status })
            });

            if (res.ok) {
                toast.success(`Request ${status.toLowerCase()} successfully`);
                fetchRequests();
            } else {
                const data = await res.json();
                toast.error(data.error || "Failed to resolve request");
            }
        } catch (err) {
            toast.error("Error resolving request");
        }
    };

    if (loading) return <div className="p-8 text-white">Loading approvals...</div>;

    const pending = requests.filter(r => r.status === "PENDING");
    const resolved = requests.filter(r => r.status !== "PENDING");

    return (
        <div className="space-y-8 max-w-6xl">
            <SectionHeader
                title="Approval Inbox"
                subtitle="Review and authorize sensitive operations before they execute."
            />

            <div className="space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-yellow-500" />
                    Pending Requests ({pending.length})
                </h3>

                <div className="grid gap-4">
                    {pending.map((req) => (
                        <ApprovalCard
                            key={req.id}
                            request={req}
                            onResolve={handleResolve}
                            isPending
                        />
                    ))}
                    {pending.length === 0 && (
                        <div className="p-12 text-center text-gray-500 bg-slate-900/40 rounded-2xl border border-dashed border-white/10">
                            No pending approval requests.
                        </div>
                    )}
                </div>
            </div>

            {resolved.length > 0 && (
                <div className="space-y-4 pt-8 border-t border-white/10">
                    <h3 className="text-lg font-bold text-gray-400">Resolution History</h3>
                    <div className="grid gap-4 opacity-70">
                        {resolved.map((req) => (
                            <ApprovalCard
                                key={req.id}
                                request={req}
                                isPending={false}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function ApprovalCard({ request, onResolve, isPending }: {
    request: any,
    onResolve?: (id: string, status: "APPROVED" | "REJECTED") => void,
    isPending: boolean
}) {
    return (
        <GlassCard className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex gap-4">
                    <div className={`p-3 rounded-xl h-fit ${request.type === 'CAMPAIGN_RUN' ? 'bg-blue-500/20 text-blue-400' :
                        request.type === 'PLAYBOOK_PUBLISH' ? 'bg-purple-500/20 text-purple-400' :
                            'bg-yellow-500/20 text-yellow-400'
                        }`}>
                        <FileText className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono uppercase tracking-wider text-gray-500">
                                {request.type.replace(/_/g, ' ')}
                            </span>
                            {!isPending && (
                                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${request.status === 'APPROVED'
                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                    : 'bg-red-500/20 text-red-400 border-red-500/30'
                                    }`}>
                                    {request.status}
                                </span>
                            )}
                        </div>
                        <h4 className="text-lg font-bold text-white mb-2">
                            {request.type === 'CAMPAIGN_RUN' ? 'Execute Campaign Workflow' :
                                request.type === 'PLAYBOOK_PUBLISH' ? 'Publish Playbook to Team' :
                                    'High Volume Action Request'}
                        </h4>
                        <div className="flex items-center gap-4 text-sm text-gray-400">
                            <div className="flex items-center gap-1.5">
                                <User className="w-4 h-4" />
                                <span>Requester: {request.requesterId}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Clock className="w-4 h-4" />
                                <span>{new Date(request.createdAt).toLocaleDateString()}</span>
                            </div>
                        </div>

                        {request.payload && (
                            <div className="mt-4 p-3 bg-slate-950/50 rounded-lg text-xs font-mono text-gray-500 overflow-hidden">
                                <pre>{JSON.stringify(request.payload, null, 2)}</pre>
                            </div>
                        )}
                    </div>
                </div>

                {isPending && onResolve && (
                    <div className="flex gap-3 shrink-0">
                        <button
                            onClick={() => onResolve(request.id, "REJECTED")}
                            className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-all border border-red-500/20"
                        >
                            <XCircle className="w-6 h-6" />
                        </button>
                        <button
                            onClick={() => onResolve(request.id, "APPROVED")}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
                        >
                            <CheckCircle className="w-5 h-5" />
                            Approve
                        </button>
                    </div>
                )}
            </div>
        </GlassCard>
    );
}
