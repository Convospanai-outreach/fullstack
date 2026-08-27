"use client";

import { ApprovalGate } from "@/components/governance/ApprovalGate";
import { SectionHeader } from "@/components/ui/SectionHeader";

export default function ApprovalsPage() {
    return (
        <div className="space-y-6 p-6 max-w-7xl mx-auto">
            <SectionHeader title="Approval Queue" subtitle="Review actions before they execute" />

            <ApprovalGate />
        </div>
    );
}
