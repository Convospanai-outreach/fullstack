"use client";

import { ApprovalGate } from "@/components/governance/ApprovalGate";

export default function ApprovalsPage() {
    return (
        <div className="space-y-6 p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Approval Queue</h1>
                    <p className="text-gray-400">Review actions before they execute</p>
                </div>
            </div>

            <ApprovalGate />
        </div>
    );
}
