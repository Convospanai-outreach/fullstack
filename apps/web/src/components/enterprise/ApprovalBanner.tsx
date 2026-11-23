"use client";

import { Clock } from 'lucide-react';

export function ApprovalBanner() {
    return (
        <div className="bg-warning/10 border border-warning/30 p-4 rounded-xl flex items-center gap-3">
            <div className="bg-warning/20 p-2 rounded-lg">
                <Clock className="w-5 h-5 text-warning animate-pulse" />
            </div>
            <div>
                <p className="text-sm font-semibold text-warning">Awaiting Approval</p>
                <p className="text-xs text-warning/70">An administrator must review this action before execution.</p>
            </div>
        </div>
    );
}
