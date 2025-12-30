"use client";

import React from "react";
import { Lock, ShieldAlert } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface PolicyGuardProps {
    children: React.ReactNode;
    enabled?: boolean; // If false, the guard is active (action allowed)
    restriction?: "blocked" | "approval_required" | "none";
    reason?: string | null;
    policyName?: string;
}

export function PolicyGuard({
    children,
    enabled = true,
    restriction = "none",
    reason,
    policyName,
}: PolicyGuardProps) {
    if (restriction === "none" && enabled) {
        return <>{children}</>;
    }

    const isBlocked = restriction === "blocked";
    const isApproval = restriction === "approval_required";

    // If no restriction specified but enabled is false, treat as blocked generic
    if (!enabled && restriction === "none") {
        // Fallback for simple boolean usage
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="opacity-50 cursor-not-allowed grayscale">
                            {children}
                        </div>
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 border-slate-800 text-white">
                        <div className="flex items-center gap-2">
                            <Lock className="w-4 h-4 text-gray-400" />
                            <p>{reason || "Action disabled by policy"}</p>
                        </div>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        )
    }

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className={`relative ${isBlocked ? "opacity-50 cursor-not-allowed grayscale pointer-events-none" : ""}`}>
                        {children}
                        {isApproval && (
                            <div className="absolute -top-2 -right-2 bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded-full border border-amber-200 font-medium flex items-center gap-1">
                                Needs Approval
                            </div>
                        )}
                    </div>
                </TooltipTrigger>
                <TooltipContent className="bg-slate-900 border-slate-800 text-white max-w-xs">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 font-semibold text-sm">
                            {isBlocked ? <ShieldAlert className="w-4 h-4 text-red-500" /> : <Lock className="w-4 h-4 text-amber-500" />}
                            <span>{isBlocked ? "Action Blocked" : "Approval Required"}</span>
                        </div>
                        <p className="text-xs text-slate-300">
                            {reason || (isBlocked ? "This action violates organization policy." : "This action requires manager approval.")}
                        </p>
                        {policyName && (
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Policy: {policyName}</p>
                        )}
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
