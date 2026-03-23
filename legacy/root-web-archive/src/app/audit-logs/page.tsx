"use client";

import { SectionHeader } from "@/components/ui/SectionHeader";
import { AuditLogTable } from "@/components/audit/AuditLogTable";

export default function AuditLogsPage() {
    return (
        <div className="p-8 space-y-8">
            <SectionHeader
                title="Audit Logs"
                subtitle="Monitor system activity and automation history"
            />
            <AuditLogTable />
        </div>
    );
}
