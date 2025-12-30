"use client";

import { Clock } from 'lucide-react';

export function ApprovalBanner() {
    return (
        <div className="bg-orange-500/10 border border-orange-500/30 p-4 rounded-xl flex items-center gap-3">
            <div className="bg-orange-500/20 p-2 rounded-lg">
                <Clock className="w-5 h-5 text-orange-400 animate-pulse" />
            </div>
            <div>
                <p className="text-sm font-semibold text-orange-200">Awaiting Approval</p>
                <p className="text-xs text-orange-300/70">An administrator must review this action before execution.</p>
            </div>
        </div>
    );
}
