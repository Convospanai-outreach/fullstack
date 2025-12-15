
"use client";

import { useEffect, useState } from "react";
import ActivityFeed, { ActivityItem } from "@/components/shared/ActivityFeed";
import { toast } from "sonner";

export default function AdminAuditPage() {
    const [logs, setLogs] = useState<ActivityItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const res = await fetch("/api/admin/audit");
                if (res.status === 403) {
                    throw new Error("Access Denied: Admin only");
                }
                const data = await res.json();
                if (data.success) {
                    setLogs(data.logs);
                } else {
                    throw new Error(data.error);
                }
            } catch (error: any) {
                toast.error(error.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchLogs();
    }, []);

    if (isLoading) return <div className="p-8 text-center text-gray-500">Loading system logs...</div>;

    return (
        <div className="max-w-5xl mx-auto py-8 px-4">
            <h1 className="text-2xl font-bold mb-2">System Audit Logs</h1>
            <p className="text-gray-400 mb-8">View global system events and critical actions.</p>

            <ActivityFeed items={logs} title="Recent System Events" />
        </div>
    );
}
