"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { formatDistanceToNow } from "date-fns";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AuditLogViewer() {
    const { data: logs, error } = useSWR("/api/audit-logs?limit=50", fetcher, { refreshInterval: 5000 });

    if (error) return <div className="text-red-400">Failed to load logs</div>;
    if (!logs) return <div className="text-gray-400 animate-pulse">Loading audit trail...</div>;

    return (
        <div className="glass border border-white/10 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                <h3 className="text-lg font-semibold text-white">System Activity</h3>
                <span className="text-xs text-gray-400">Live Updates</span>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-400">
                    <thead className="bg-white/5 text-gray-200 uppercase text-xs">
                        <tr>
                            <th className="px-6 py-3">Time</th>
                            <th className="px-6 py-3">Action</th>
                            <th className="px-6 py-3">User</th>
                            <th className="px-6 py-3">Details</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {logs.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center italic text-gray-500">
                                    No activity recorded yet.
                                </td>
                            </tr>
                        ) : (
                            logs.map((log: any) => {
                                const meta = log.meta || {};
                                return (
                                    <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-gray-300">
                                                {new Date(log.createdAt).toLocaleTimeString()}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-mono font-medium ${log.action.includes("ERROR") ? "bg-red-500/20 text-red-400" :
                                                    log.action.includes("LOGIN") ? "bg-blue-500/20 text-blue-400" :
                                                        log.action.includes("PAYMENT") ? "bg-green-500/20 text-green-400" :
                                                            "bg-purple-500/20 text-purple-400"
                                                }`}>
                                                {log.action.replace("AUDIT: ", "")}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-white">
                                            {meta.userId ? (
                                                <span className="font-mono text-xs">{meta.userId.substring(0, 8)}...</span>
                                            ) : (
                                                "System"
                                            )}
                                        </td>
                                        <td className="px-6 py-4 w-1/3">
                                            <pre className="text-xs text-gray-500 overflow-x-auto max-w-xs scrollbar-none">
                                                {JSON.stringify(meta.details || (({ userId: _, ...rest }) => rest)(meta), null, 2)}
                                            </pre>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
