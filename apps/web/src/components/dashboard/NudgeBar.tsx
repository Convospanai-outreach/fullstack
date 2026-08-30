
"use client";

import { motion } from "framer-motion";
import { Lightbulb, ArrowRight, Zap, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

interface Nudge {
    id: string;
    text: string;
    actionLabel: string;
    icon: any;
    border: string;
    bg: string;
    iconBg: string;
    iconText: string;
}

export function NudgeBar() {
    const nudges: Nudge[] = [
        {
            id: 'approvals',
            text: "You have 5 agent actions awaiting your approval in the Governance Gate.",
            actionLabel: "Review Now",
            icon: Zap,
            border: "border-amber-500",
            bg: "bg-amber-50/60",
            iconBg: "bg-amber-100",
            iconText: "text-amber-700"
        },
        {
            id: 'linkedin',
            text: "Your LinkedIn session is expiring in 2 hours. Refresh now to prevent downtime.",
            actionLabel: "Refresh",
            icon: Bell,
            border: "border-blue-500",
            bg: "bg-blue-50/60",
            iconBg: "bg-blue-100",
            iconText: "text-blue-700"
        },
        {
            id: 'campaign',
            text: "A campaign is paused due to high friction. Review the Phi-3 verdict.",
            actionLabel: "View Details",
            icon: Lightbulb,
            border: "border-purple-500",
            bg: "bg-purple-50/60",
            iconBg: "bg-purple-100",
            iconText: "text-purple-700"
        }
    ];

    const [currentNudgeIndex, setCurrentNudgeIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentNudgeIndex((prev) => (prev + 1) % nudges.length);
        }, 8000);
        return () => clearInterval(interval);
    }, [nudges.length]);

    const nudge = nudges[currentNudgeIndex];
    if (!nudge) return null;

    return (
        <div className="mb-6">
            <motion.div
                key={nudge.id}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`${nudge.bg} border-l-[3px] ${nudge.border} rounded-2xl rounded-l-md p-4 pl-6 flex items-center justify-between overflow-hidden group relative`}
            >
                {/* Refined Progress Bar */}
                <motion.div
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 8, ease: "linear" }}
                    className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent"
                />

                <div className="flex items-center gap-5">
                    <div className="flex flex-col items-center">
                        <div className={`p-2.5 rounded-xl ${nudge.iconBg} ${nudge.iconText}`}>
                            <nudge.icon className="w-5 h-5 transition-transform group-hover:scale-110" />
                        </div>
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">System Nudge</span>
                            <div className="w-1 h-1 rounded-full bg-border" />
                            <span className="text-[10px] font-bold text-muted-foreground">{currentNudgeIndex + 1}/{nudges.length}</span>
                        </div>
                        <p className="text-sm text-foreground font-medium leading-relaxed max-w-lg">
                            {nudge.text}
                        </p>
                    </div>
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    className="bg-background hover:bg-primary hover:text-white transition-all group-hover:px-6 rounded-xl font-bold font-outfit text-xs px-4 py-5"
                >
                    {nudge.actionLabel}
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
            </motion.div>
        </div>
    );
}
