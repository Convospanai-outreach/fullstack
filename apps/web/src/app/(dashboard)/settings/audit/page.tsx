"use client";

import { useEffect, useState } from 'react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { Loader2, User } from 'lucide-react';

import { TraceVisualizer } from '@/components/governance/TraceVisualizer';
import { ChevronDown, Brain } from 'lucide-react';
import { getBrowserApiBase } from "@/lib/api/browserBase";

export default function AuditLogPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
    const [traces, setTraces] = useState<Record<string, any[]>>({});
    const [loadingTraces, setLoadingTraces] = useState<Record<string, boolean>>({});

    useEffect(() => {
        fetch(getBrowserApiBase() + "/settings/audit")
            .then(res => res.json())
            .then(data => {
                setLogs(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    const toggleRow = async (logId: string, entityId: string | undefined, entityType: string) => {
        if (!entityId) return;
        const isExpanded = !!expandedRows[logId];

        setExpandedRows(prev => ({ ...prev, [logId]: !isExpanded }));

        if (!isExpanded && entityType === 'WorkflowRun' && !traces[logId]) {
            setLoadingTraces(prev => ({ ...prev, [logId]: true }));
            try {
                const res = await fetch(`${getBrowserApiBase()}/traces/${entityId}`);
                if (res.ok) {
                    const data = await res.json();
                    setTraces(prev => ({ ...prev, [logId]: data }));
                }
            } catch (err) {
                console.error("Failed to load traces", err);
            } finally {
                setLoadingTraces(prev => ({ ...prev, [logId]: false }));
            }
        }
    };

    if (loading) return <div className="p-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;

    return (
        <div className="space-y-8 max-w-6xl mr-auto">
            <SectionHeader
                title="Audit Logs"
                subtitle="Track all activities and changes within your workspace"
            />

            <GlassCard className="overflow-hidden">
                <table className="w-full text-left bg-muted">
                    <thead className="text-xs uppercase bg-muted text-muted-foreground border-b border-border">
                        <tr>
                            <th className="px-6 py-4">User</th>
                            <th className="px-6 py-4">Action</th>
                            <th className="px-6 py-4">Resource</th>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">IP</th>
                            <th className="px-6 py-4"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {logs.map((log) => (
                            <>
                                <tr key={log.id} className="hover:bg-muted transition-colors cursor-pointer" onClick={() => log.entity === 'WorkflowRun' && toggleRow(log.id, log.entityId, log.entity)}>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                                                <User className="w-4 h-4" />
                                            </div>
                                            <div className="text-sm font-medium text-foreground">
                                                {log.user?.name || "System"}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 rounded text-xs font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-foreground">
                                        {log.entity} <span className="text-muted-foreground">#{log.entityId?.substring(0, 6) || "-"}</span>
                                        {log.metadata && (
                                            <div className="text-[10px] text-muted-foreground mt-1 truncate max-w-xs italic">
                                                {JSON.stringify(log.metadata).substring(0, 50)}...
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-muted-foreground">
                                        {new Date(log.createdAt).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-xs text-mono text-muted-foreground">
                                        {log.ipAddress || "-"}
                                    </td>
                                    <td className="px-6 py-4">
                                        {log.entity === 'WorkflowRun' && (
                                            <button className="p-1 hover:bg-muted rounded">
                                                {expandedRows[log.id] ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <Brain className="w-4 h-4 text-purple-400" />}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                                {expandedRows[log.id] && (
                                    <tr className="bg-muted">
                                        <td colSpan={6} className="p-4 pl-12">
                                            {loadingTraces[log.id] ? (
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <Loader2 className="w-3 h-3 animate-spin" /> Fetching reasoning traces...
                                                </div>
                                            ) : traces[log.id] && (traces[log.id]?.length ?? 0) > 0 ? (
                                                <TraceVisualizer traces={traces[log.id] as any[]} />
                                            ) : (
                                                <div className="text-xs text-muted-foreground italic">No AI traces found for this activity.</div>
                                            )}
                                        </td>
                                    </tr>
                                )}
                            </>
                        ))}
                        {logs.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                    No audit logs found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </GlassCard>
        </div>
    );
}
