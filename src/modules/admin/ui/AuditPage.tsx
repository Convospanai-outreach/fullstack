"use client";


import { SectionHeader } from "@/components/ui/SectionHeader";
import { AuditLogTable } from "@/components/audit/AuditLogTable";

export default function AuditPage() {
    return (
        <main className="p-8 min-h-screen bg-black relative overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 max-w-6xl mx-auto">
                <SectionHeader title="System Audit Logs" subtitle="Track user activity and security events" />

                <div className="mt-8">
                    <AuditLogTable apiUrl="/api/audit" />
                </div>
            </div>
        </main>
    );
}
