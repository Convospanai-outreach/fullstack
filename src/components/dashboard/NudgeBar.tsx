
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
    color: string;
}

export function NudgeBar() {
    const nudges: Nudge[] = [
        {
            id: 'approvals',
            text: "You have 5 agent actions awaiting your approval in the Governance Gate.",
            actionLabel: "Review Now",
            icon: Zap,
            color: "text-amber-400"
        },
        {
            id: 'linkedin',
            text: "Your LinkedIn session is expiring in 2 hours. Refresh now to prevent downtime.",
            actionLabel: "Refresh",
            icon: Bell,
            color: "text-blue-400"
        },
        {
            id: 'campaign',
            text: "A campaign is paused due to high friction. Review the Phi-3 verdict.",
            actionLabel: "View Details",
            icon: Lightbulb,
            color: "text-purple-400"
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
        <div className="mb-4">
            <motion.div 
                key={nudge.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="glass border border-white/10 rounded-2xl p-3 px-5 flex items-center justify-between shadow-lg overflow-hidden group relative"
            >
                {/* Progress bar for cycle */}
                <motion.div 
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 8, ease: "linear" }}
                    className="absolute bottom-0 left-0 h-0.5 bg-indigo-500/30"
                />

                <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg bg-white/5 ${nudge.color}`}>
                        <nudge.icon className="w-4 h-4" />
                    </div>
                    <p className="text-sm text-gray-300">
                        {nudge.text}
                    </p>
                </div>

                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="hover:bg-indigo-500 hover:text-white transition-all group-hover:scale-105"
                >
                    {nudge.actionLabel}
                    <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
            </motion.div>
        </div>
    );
}
