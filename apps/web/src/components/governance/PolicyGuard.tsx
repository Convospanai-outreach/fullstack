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
                    <TooltipContent className="bg-background border-border text-foreground">
                        <div className="flex items-center gap-2">
                            <Lock className="w-4 h-4 text-muted-foreground" />
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
                            <div className="absolute -top-2 -right-2 bg-warning/10 text-warning text-[10px] px-1.5 py-0.5 rounded-full border border-warning/30 font-medium flex items-center gap-1">
                                Needs Approval
                            </div>
                        )}
                    </div>
                </TooltipTrigger>
                <TooltipContent className="bg-background border-border text-foreground max-w-xs">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 font-semibold text-sm">
                            {isBlocked ? <ShieldAlert className="w-4 h-4 text-destructive" /> : <Lock className="w-4 h-4 text-warning" />}
                            <span>{isBlocked ? "Action Blocked" : "Approval Required"}</span>
                        </div>
                        <p className="text-xs text-foreground/80">
                            {reason || (isBlocked ? "This action violates organization policy." : "This action requires manager approval.")}
                        </p>
                        {policyName && (
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Policy: {policyName}</p>
                        )}
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
