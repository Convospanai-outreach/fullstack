
"use client";

import { SovereignConsole } from "@/components/dashboard/SovereignConsole";
import { MorningBriefing } from "@/components/dashboard/MorningBriefing";
import { DashboardWelcome } from "@/components/dashboard/DashboardWelcome";
import { NudgeBar } from "@/components/dashboard/NudgeBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Play, Pause, RefreshCw, Zap, Rocket, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { ApprovalQueue } from "@/components/dashboard/widgets/ApprovalQueue";
import { motion } from "framer-motion";

function ActionButton({ endpoint, label, icon }: { endpoint: string, label: string, icon: React.ReactNode }) {
    const [loading, setLoading] = useState(false);

    const handleClick = async () => {
        setLoading(true);
        try {
            const res = await fetch(endpoint, { method: "POST" });
            if (!res.ok) throw new Error("Action failed");
            const data = await res.json();
            toast.success(data.message || `${label} initiated`);
        } catch (e) {
            toast.error(`Failed to ${label.toLowerCase()}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button variant="outline" className="w-full justify-start gap-3 py-6 px-4 hover:bg-white/5 border-white/10 transition-all hover:translate-x-1" onClick={handleClick} disabled={loading}>
            <div className="p-2 rounded-lg bg-white/5">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
            </div>
            <span className="font-medium">{label}</span>
        </Button>
    );
}

export default function OperatorView() {
    return (
        <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-8 min-h-screen">
            {/* Welcome Section */}
            <DashboardWelcome />

            {/* Top Row: Mission Briefing & Quick Nudges */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 items-start">
                <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="xl:col-span-3"
                >
                    <MorningBriefing />
                </motion.div>
                
                <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="space-y-4"
                >
                    <div className="flex items-center gap-2 mb-2 px-1">
                        <Rocket className="w-4 h-4 text-indigo-400" />
                        <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">Contextual Nudges</span>
                    </div>
                    <NudgeBar />
                    <NudgeBar /> {/* Second instance for layout demo, or real contextual ones later */}
                </motion.div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Main Technical Hub */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="lg:col-span-8 space-y-8"
                >
                    <SovereignConsole />
                </motion.div>

                {/* Side Controls & Governance */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="lg:col-span-4 space-y-8"
                >
                    {/* Governance Gate / Live Action Queue */}
                    <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-purple-600 rounded-3xl blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
                        <div className="relative">
                            <ApprovalQueue />
                        </div>
                    </div>

                    {/* Quick Controls */}
                    <Card className="glass border-white/10 overflow-hidden">
                        <CardHeader className="border-b border-white/5 bg-white/5">
                            <CardTitle className="flex items-center gap-2">
                                <Terminal className="w-4 h-4 text-emerald-400" />
                                Operator Command Center
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-6">
                            <ActionButton
                                endpoint="/api/admin/actions/start-scrapers"
                                label="Trigger Data Ingestion"
                                icon={<Play className="w-4 h-4 text-emerald-400" />}
                            />
                            <ActionButton
                                endpoint="/api/admin/actions/pause-outreach"
                                label="Halt Active Campaigns"
                                icon={<Pause className="w-4 h-4 text-orange-400" />}
                            />
                            <ActionButton
                                endpoint="/api/admin/actions/sync-crm"
                                label="Sync External Records"
                                icon={<RefreshCw className="w-4 h-4 text-indigo-400" />}
                            />
                            
                            <div className="mt-6 p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                                <div className="flex items-center gap-2 mb-2">
                                    <Zap className="w-4 h-4 text-indigo-400" />
                                    <span className="text-xs font-bold text-indigo-300">System Health</span>
                                </div>
                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                    <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: "94%" }}
                                        className="h-full bg-indigo-500"
                                    />
                                </div>
                                <p className="text-[10px] text-gray-500 mt-2">All edge nodes report 99.9% uptime.</p>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    );
}
