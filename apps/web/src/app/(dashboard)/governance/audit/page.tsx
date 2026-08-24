"use client";

import { useEffect, useState } from "react";
import GovernanceLayout from "@/components/governance/GovernanceLayout";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/Skeleton";
import {
    Search,
    Download,
    Filter,
    User as LucideUser,
    Globe,
    Box,
    LayoutDashboard
} from "lucide-react";
import { getBrowserApiBase } from "@/lib/api/browserBase";

interface AuditLogRow {
    id: string;
    action: string;
    entity: string;
    entityId: string | null;
    createdAt: string;
    ipAddress: string | null;
    user?: {
        name: string | null;
        email: string;
    };
}

export default function AuditLogsPage() {
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState<AuditLogRow[]>([]);
    const [search, setSearch] = useState("");

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const res = await fetch(getBrowserApiBase() + "/governance/audit");
                const data = await res.json();
                if (data.success) {
                    setLogs(data.logs);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, []);

    const filteredLogs = logs.filter(log =>
        log.action.toLowerCase().includes(search.toLowerCase()) ||
        log.entity.toLowerCase().includes(search.toLowerCase()) ||
        log.user?.email.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <GovernanceLayout>
            <div className="flex justify-between items-center mb-6">
                <div className="relative w-96 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-accent-blue transition-colors" />
                    <input
                        type="text"
                        placeholder="Search by action, resource, or actor..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-white/5 border border-white/5 rounded-xl pl-12 pr-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent-blue focus:bg-white/10 transition-all font-medium"
                    />
                </div>

                <div className="flex gap-3">
                    <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass border border-white/10 text-white text-sm font-semibold hover:bg-white/5 transition">
                        <Filter className="w-4 h-4 text-text-muted" />
                        Filters
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent-blue text-white text-sm font-semibold hover:bg-accent-blue/90 transition shadow-glow">
                        <Download className="w-4 h-4" />
                        Export CSV
                    </button>
                </div>
            </div>

            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/5 text-[10px] uppercase font-bold tracking-widest text-text-muted">
                                <th className="px-6 py-4">Event</th>
                                <th className="px-6 py-4">Resource</th>
                                <th className="px-6 py-4">Actor</th>
                                <th className="px-6 py-4">Timestamp</th>
                                <th className="px-6 py-4">Source</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.03]">
                            {loading ? (
                                Array.from({ length: 8 }).map((_, i) => (
                                    <tr key={i}>
                                        <td colSpan={5} className="px-6 py-4">
                                            <Skeleton className="h-4 w-full" />
                                        </td>
                                    </tr>
                                ))
                            ) : filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center text-text-secondary">
                                        No matching audit logs found.
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-accent-blue/10 p-2 rounded-lg text-accent-blue group-hover:scale-110 transition-transform">
                                                    <LayoutDashboard className="w-4 h-4" />
                                                </div>
                                                <span className="text-sm font-bold text-white tracking-tight">{log.action.replace(/_/g, " ")}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-2">
                                                <Box className="w-3.5 h-3.5 text-text-muted" />
                                                <span className="text-sm text-text-secondary">{log.entity}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-2">
                                                <LucideUser className="w-3.5 h-3.5 text-text-muted" />
                                                <div className="text-xs">
                                                    <p className="text-white font-medium">{log.user?.name || "System"}</p>
                                                    <p className="text-text-muted">{log.user?.email || "contact.us@craftmyfunnel.live"}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="text-xs text-text-secondary font-mono">
                                                {new Date(log.createdAt).toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-2">
                                                <Globe className="w-3.5 h-3.5 text-text-muted" />
                                                <span className="text-xs font-mono text-text-secondary">{log.ipAddress || "127.0.0.1"}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </GovernanceLayout>
    );
}
