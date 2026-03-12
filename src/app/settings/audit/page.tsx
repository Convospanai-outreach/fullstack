"use client";

import { useEffect, useState } from 'react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { Loader2, User } from 'lucide-react';

import { TraceVisualizer } from '@/components/governance/TraceVisualizer';
import { ChevronDown, Brain } from 'lucide-react';

export default function AuditLogPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
    const [traces, setTraces] = useState<Record<string, any[]>>({});
    const [loadingTraces, setLoadingTraces] = useState<Record<string, boolean>>({});

    useEffect(() => {
        fetch(process.env['NEXT_PUBLIC_API_URL'] + "/settings/audit")
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
                const res = await fetch(`${process.env['NEXT_PUBLIC_API_URL']}/traces/${entityId}`);
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
                <table className="w-full text-left bg-slate-900/50">
                    <thead className="text-xs uppercase bg-white/5 text-gray-400 border-b border-white/10">
                        <tr>
                            <th className="px-6 py-4">User</th>
                            <th className="px-6 py-4">Action</th>
                            <th className="px-6 py-4">Resource</th>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">IP</th>
                            <th className="px-6 py-4"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {logs.map((log) => (
                            <>
                                <tr key={log.id} className="hover:bg-white/5 transition-colors cursor-pointer" onClick={() => log.entity === 'WorkflowRun' && toggleRow(log.id, log.entityId, log.entity)}>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                                                <User className="w-4 h-4" />
                                            </div>
                                            <div className="text-sm font-medium text-white">
                                                {log.user?.name || "System"}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 rounded text-xs font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-300">
                                        {log.entity} <span className="text-gray-600">#{log.entityId?.substring(0, 6) || "-"}</span>
                                        {log.metadata && (
                                            <div className="text-[10px] text-gray-500 mt-1 truncate max-w-xs italic">
                                                {JSON.stringify(log.metadata).substring(0, 50)}...
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-400">
                                        {new Date(log.createdAt).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-xs text-mono text-gray-500">
                                        {log.ipAddress || "-"}
                                    </td>
                                    <td className="px-6 py-4">
                                        {log.entity === 'WorkflowRun' && (
                                            <button className="p-1 hover:bg-white/10 rounded">
                                                {expandedRows[log.id] ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <Brain className="w-4 h-4 text-purple-400" />}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                                {expandedRows[log.id] && (
                                    <tr className="bg-black/20">
                                        <td colSpan={6} className="p-4 pl-12">
                                            {loadingTraces[log.id] ? (
                                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                                    <Loader2 className="w-3 h-3 animate-spin" /> Fetching reasoning traces...
                                                </div>
                                            ) : traces[log.id] && (traces[log.id]?.length ?? 0) > 0 ? (
                                                <TraceVisualizer traces={traces[log.id] as any[]} />
                                            ) : (
                                                <div className="text-xs text-gray-500 italic">No AI traces found for this activity.</div>
                                            )}
                                        </td>
                                    </tr>
                                )}
                            </>
                        ))}
                        {logs.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
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
