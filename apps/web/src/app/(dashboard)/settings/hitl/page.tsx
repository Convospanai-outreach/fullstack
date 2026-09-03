"use client";

import { useEffect, useState } from 'react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { toast } from 'sonner';
import {
    CheckCircle,
    XCircle,
    AlertCircle,
    Clock,
    Terminal
} from 'lucide-react';
import { getBrowserApiBase } from "@/lib/api/browserBase";

interface ApprovalRequest {
    id: string;
    type: string;
    payload: any;
    status: string;
    createdAt: string;
}

export default function HITLPage() {
    const [requests, setRequests] = useState<ApprovalRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        try {
            const res = await fetch(getBrowserApiBase() + "/settings/approvals");
            const data = await res.json();
            setRequests(data);
        } catch (err) {
            toast.error("Failed to load approval queue");
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
        setProcessingId(id);
        try {
            const res = await fetch(`${getBrowserApiBase()}/approvals/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ decision })
            });

            if (res.ok) {
                toast.success(`Request ${decision.toLowerCase()}`);
                fetchRequests();
            } else {
                toast.error("Failed to process request");
            }
        } catch (err) {
            toast.error("Action failed");
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) return <div className="p-8 text-foreground">Loading interception queue...</div>;

    const pending = requests.filter(r => r.status === 'PENDING');

    return (
        <div className="space-y-8 max-w-6xl">
            <SectionHeader
                title="HITL Intercepts"
                subtitle="Review and approve AI-generated actions before they impact your business."
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricCard
                    title="Pending Review"
                    value={pending.length}
                    icon={<Clock className="w-5 h-5 text-amber-400" />}
                    subtitle="Requires immediate action"
                />
                <MetricCard
                    title="Avg Response Time"
                    value="12m"
                    icon={<AlertCircle className="w-5 h-5 text-blue-400" />}
                    subtitle="Human response latency"
                />
                <MetricCard
                    title="Safe Deployments"
                    value="142"
                    icon={<CheckCircle className="w-5 h-5 text-emerald-400" />}
                    subtitle="Reviewed this month"
                />
            </div>

            <GlassCard className="p-8 space-y-6">
                <div className="flex items-center gap-3 border-b border-border pb-6">
                    <Terminal className="w-6 h-6 text-purple-400" />
                    <h3 className="text-xl font-bold text-foreground">Interception Queue</h3>
                </div>

                {pending.length === 0 ? (
                    <div className="py-12 text-center space-y-4">
                        <div className="flex justify-center">
                            <CheckCircle className="w-12 h-12 text-emerald-500/20" />
                        </div>
                        <p className="text-muted-foreground text-sm">All caught up! No actions require human review.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {pending.map((req) => (
                            <div key={req.id} className="p-6 bg-card rounded-2xl border border-border hover:border-primary/30 transition-all group">
                                <div className="flex flex-col md:flex-row justify-between gap-6">
                                    <div className="space-y-4 flex-1">
                                        <div className="flex items-center gap-3">
                                            <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded text-[10px] font-bold uppercase tracking-wider">
                                                {req.type.replace('_', ' ')}
                                            </span>
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Clock className="w-3 h-3" /> {new Date(req.createdAt).toLocaleString()}
                                            </span>
                                        </div>

                                        <div className="space-y-2">
                                            <h4 className="text-foreground font-bold text-lg">
                                                Review action for <span className="text-blue-400">Run ID: {req.payload.runId?.substring(0, 8)}</span>
                                            </h4>
                                            <div className="p-4 bg-muted rounded-xl border border-border font-mono text-[11px] text-muted-foreground overflow-x-auto">
                                                <pre className="whitespace-pre-wrap">
                                                    {JSON.stringify(req.payload, null, 2)}
                                                </pre>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-row md:flex-col justify-end gap-3 self-end md:self-center">
                                        <button
                                            onClick={() => handleAction(req.id, 'REJECTED')}
                                            disabled={processingId === req.id}
                                            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-bold rounded-lg border border-red-500/20 transition-all flex items-center gap-2"
                                        >
                                            <XCircle className="w-4 h-4" /> Reject
                                        </button>
                                        <button
                                            onClick={() => handleAction(req.id, 'APPROVED')}
                                            disabled={processingId === req.id}
                                            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                                        >
                                            <CheckCircle className="w-4 h-4" /> Approve Action
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </GlassCard>
        </div>
    );
}

function MetricCard({ title, value, icon, subtitle }: any) {
    return (
        <GlassCard className="p-6 space-y-2">
            <div className="flex justify-between items-center text-muted-foreground">
                <span className="text-xs font-bold uppercase tracking-wider">{title}</span>
                {icon}
            </div>
            <div className="text-3xl font-black text-foreground">{value}</div>
            <div className="text-[10px] text-muted-foreground">{subtitle}</div>
        </GlassCard>
    );
}
