
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
        <div className="mb-6">
            <motion.div 
                key={nudge.id}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass-premium border border-white/5 rounded-2xl p-4 pl-6 flex items-center justify-between shadow-2xl overflow-hidden group relative"
            >
                {/* Refined Progress Bar */}
                <motion.div 
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 8, ease: "linear" }}
                    className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-indigo-500/0 via-indigo-500/40 to-indigo-500/0"
                />

                <div className="flex items-center gap-5">
                    <div className="flex flex-col items-center">
                        <div className={`p-2.5 rounded-xl bg-white/5 ${nudge.color} shadow-lg shadow-current/10 border border-white/5`}>
                            <nudge.icon className="w-5 h-5 transition-transform group-hover:scale-110" />
                        </div>
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">System Nudge</span>
                            <div className="w-1 h-1 rounded-full bg-slate-700" />
                            <span className="text-[10px] font-bold text-slate-500">{currentNudgeIndex + 1}/{nudges.length}</span>
                        </div>
                        <p className="text-sm text-slate-200 font-medium leading-relaxed max-w-lg">
                            {nudge.text}
                        </p>
                    </div>
                </div>

                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="hover:bg-indigo-500 hover:text-white transition-all group-hover:px-6 rounded-xl font-bold font-outfit text-xs px-4 py-5"
                >
                    {nudge.actionLabel}
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
            </motion.div>
        </div>
    );
}
