"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Filter, Search } from "lucide-react";

interface AuditLog {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    createdAt: string;
    metadata: any;
    user?: {
        name: string;
        email: string;
        enterpriseRole: string;
    };
}

export default function AuditLogPage() {
    const { data: session } = useSession();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        action: "",
        entityType: "",
        startDate: "",
        endDate: ""
    });
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: "50",
                ...Object.fromEntries(
                    Object.entries(filters).filter(([_, v]) => v !== "")
                )
            });

            const res = await fetch(`/api/admin/audit?${params}`);
            if (res.ok) {
                const data = await res.json();
                setLogs(data.logs);
                setTotalPages(data.pagination.pages);
            }
        } catch (error) {
            console.error("Failed to fetch audit logs:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [page, filters]);

    const exportLogs = () => {
        // Convert to CSV and download
        const csv = [
            ["Timestamp", "Action", "Entity Type", "Entity ID", "User", "Role"],
            ...logs.map(log => [
                new Date(log.createdAt).toISOString(),
                log.action,
                log.entityType,
                log.entityId,
                log.user?.email || "System",
                log.user?.enterpriseRole || "SYSTEM"
            ])
        ].map(row => row.join(",")).join("\n");

        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `audit-logs-${Date.now()}.csv`;
        a.click();
    };

    const getActionColor = (action: string) => {
        if (action.includes("DELETE") || action.includes("REVOKED")) return "destructive";
        if (action.includes("CREATE") || action.includes("GRANTED")) return "default";
        if (action.includes("UPDATE") || action.includes("CHANGE")) return "secondary";
        return "outline";
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold">Audit Logs</h1>
                    <p className="text-muted-foreground">Complete activity trail for compliance</p>
                </div>
                <Button onClick={exportLogs} className="gap-2">
                    <Download className="w-4 h-4" />
                    Export CSV
                </Button>
            </div>

            {/* Filters */}
            <Card className="p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="text-sm font-medium mb-2 block">Action</label>
                        <select
                            className="w-full p-2 border rounded"
                            value={filters.action}
                            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                        >
                            <option value="">All Actions</option>
                            <option value="CONSENT_GRANTED">Consent Granted</option>
                            <option value="CONSENT_REVOKED">Consent Revoked</option>
                            <option value="CONVERSATION_STATE_CHANGE">State Change</option>
                            <option value="CAMPAIGN_APPROVED">Campaign Approved</option>
                            <option value="FEATURE_FLAG_TOGGLED">Feature Toggle</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-2 block">Entity Type</label>
                        <select
                            className="w-full p-2 border rounded"
                            value={filters.entityType}
                            onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}
                        >
                            <option value="">All Types</option>
                            <option value="Lead">Lead</option>
                            <option value="Campaign">Campaign</option>
                            <option value="FeatureFlag">Feature Flag</option>
                            <option value="User">User</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-2 block">Start Date</label>
                        <input
                            type="date"
                            className="w-full p-2 border rounded"
                            value={filters.startDate}
                            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-2 block">End Date</label>
                        <input
                            type="date"
                            className="w-full p-2 border rounded"
                            value={filters.endDate}
                            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                        />
                    </div>
                </div>
            </Card>

            {/* Logs Table */}
            <Card className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-muted">
                            <tr>
                                <th className="p-3 text-left text-sm font-semibold">Timestamp</th>
                                <th className="p-3 text-left text-sm font-semibold">Action</th>
                                <th className="p-3 text-left text-sm font-semibold">Entity</th>
                                <th className="p-3 text-left text-sm font-semibold">User</th>
                                <th className="p-3 text-left text-sm font-semibold">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                                        Loading audit logs...
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                                        No audit logs found
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-muted/50">
                                        <td className="p-3 text-sm">
                                            {new Date(log.createdAt).toLocaleString()}
                                        </td>
                                        <td className="p-3">
                                            <Badge variant={getActionColor(log.action)}>
                                                {log.action.replace(/_/g, " ")}
                                            </Badge>
                                        </td>
                                        <td className="p-3 text-sm">
                                            <div className="font-medium">{log.entityType}</div>
                                            <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                {log.entityId}
                                            </div>
                                        </td>
                                        <td className="p-3 text-sm">
                                            <div className="font-medium">
                                                {log.user?.name || "System"}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {log.user?.enterpriseRole || "SYSTEM"}
                                            </div>
                                        </td>
                                        <td className="p-3 text-sm text-muted-foreground max-w-[300px]">
                                            <details className="cursor-pointer">
                                                <summary>View metadata</summary>
                                                <pre className="text-xs mt-2 p-2 bg-muted rounded">
                                                    {JSON.stringify(log.metadata, null, 2)}
                                                </pre>
                                            </details>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-4 border-t flex justify-between items-center">
                        <div className="text-sm text-muted-foreground">
                            Page {page} of {totalPages}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page === 1}
                                onClick={() => setPage(page - 1)}
                            >
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page === totalPages}
                                onClick={() => setPage(page + 1)}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}
