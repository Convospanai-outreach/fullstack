"use client";

import { useState, useEffect } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getBrowserApiBase } from "@/lib/api/browserBase";

interface AuditLog {
    id: string;
    action: string;
    resource: string;
    resourceId: string | null;
    details: any;
    ipAddress: string | null;
    createdAt: string;
    user?: {
        name: string | null;
    };
}

export function AuditLogTable({ apiUrl = getBrowserApiBase() + "/settings/audit" }: { apiUrl?: string }) {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("ALL");

    const fetchLogs = () => {
        setLoading(true);
        fetch(apiUrl)
            .then((res) => res.json())
            .then((data) => {
                const logsData = data.logs || data.activities || (Array.isArray(data) ? data : []);
                setLogs(logsData);
                setLoading(false);
            })
            .catch((err) => {
                console.error(err);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchLogs();
    }, [filter]);

    return (
        <GlassCard>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold gradient-text">System Activity Logs</h3>
                <div className="flex gap-2">
                    <select
                        className="bg-white/5 border border-white/10 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-blue-500"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    >
                        <option value="ALL">All Actions</option>
                        <option value="LIKE">Likes</option>
                        <option value="COMMENT">Comments</option>
                        <option value="CONNECT">Connections</option>
                        <option value="SCRAPE">Scrapes</option>
                        <option value="INMAIL">InMails</option>
                    </select>
                    <Button variant="outline" onClick={fetchLogs} className="py-2 px-4 text-sm">
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-300">
                    <thead className="text-xs uppercase bg-white/5 text-gray-400">
                        <tr>
                            <th className="px-4 py-3 rounded-tl-lg">Time</th>
                            <th className="px-4 py-3">User</th>
                            <th className="px-4 py-3">Action</th>
                            <th className="px-4 py-3">Resource</th>
                            <th className="px-4 py-3 rounded-tr-lg">Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-white/40">Loading logs...</td>
                            </tr>
                        ) : logs.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-white/40">No audit logs found.</td>
                            </tr>
                        ) : (
                            logs.map((log) => (
                                <tr key={log.id} className="border-b border-white/5 hover:bg-white/5 transition">
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        {new Date(log.createdAt).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3">
                                        {log.user?.name || "System"}
                                    </td>
                                    <td className="px-4 py-3">
                                        <Badge variant="default">{log.action}</Badge>
                                    </td>
                                    <td className="px-4 py-3">
                                        {log.resource}
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-white/60 truncate max-w-xs">
                                        {JSON.stringify(log.details)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </GlassCard>
    );
}
