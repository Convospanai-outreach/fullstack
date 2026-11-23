"use client";

import { useEffect, useState } from 'react';
import { getEdgeNodeActivity } from '@/app/actions/hardware';

interface ActivityEntry {
    id: string;
    function: string;
    entityTypes: string[] | null;
    entityCount: number;
    sessionId: string | null;
    createdAt: string;
}

export default function ComplianceLog() {
    const [logs, setLogs] = useState<ActivityEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        getEdgeNodeActivity(50).then((data) => {
            if (!cancelled) {
                setLogs(data);
                setLoading(false);
            }
        });
        return () => { cancelled = true; };
    }, []);

    return (
        <div className="p-6 bg-background text-foreground rounded-lg border border-border mt-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span>🛡️</span> Edge Node Activity
            </h2>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-border text-muted-foreground text-sm">
                            <th className="p-3">Timestamp</th>
                            <th className="p-3">Function</th>
                            <th className="p-3">Entity Types Touched</th>
                            <th className="p-3">Count</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map((log) => (
                            <tr key={log.id} className="border-b border-border hover:bg-card/50">
                                <td className="p-3 text-sm font-mono text-muted-foreground">{new Date(log.createdAt).toLocaleTimeString()}</td>
                                <td className="p-3 text-sm">{log.function}</td>
                                <td className="p-3 text-sm text-warning font-mono">{(log.entityTypes || []).join(', ') || '-'}</td>
                                <td className="p-3 text-sm text-muted-foreground">{log.entityCount}</td>
                            </tr>
                        ))}
                        {!loading && logs.length === 0 && (
                            <tr>
                                <td colSpan={4} className="p-3 text-sm text-muted-foreground">No activity recorded yet.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
                * This log shows what the edge node did (function, entity types, counts) - never the underlying PII values.
                Decrypted PII never leaves the physical device; view it there directly if you need the original value.
            </p>
        </div>
    );
}
