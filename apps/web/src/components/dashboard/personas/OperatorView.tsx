
"use client";

import { SovereignConsole } from "@/components/dashboard/SovereignConsole";
import { MorningBriefing } from "@/components/dashboard/MorningBriefing";
import { DashboardWelcome } from "@/components/dashboard/DashboardWelcome";
import { NudgeBar } from "@/components/dashboard/NudgeBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Play, Pause, RefreshCw, Zap, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { ApprovalQueue } from "@/components/dashboard/widgets/ApprovalQueue";
import { motion } from "framer-motion";
import { getBrowserApiBase } from "@/lib/api/browserBase";

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
        <Button
            variant="outline"
            className="w-full justify-start gap-4 py-8 px-6 bg-card hover:bg-accent border-border hover:border-primary/30 transition-all hover:translate-x-1 group/btn rounded-2xl"
            onClick={handleClick}
            disabled={loading}
        >
            <div className="p-2.5 rounded-xl bg-muted group-hover/btn:scale-110 transition-transform">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : icon}
            </div>
            <span className="font-bold text-foreground font-outfit">{label}</span>
        </Button>
    );
}

export default function OperatorView() {
    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.15
            }
        }
    };

    const item = {
        hidden: { opacity: 0, y: 30 },
        show: { opacity: 1, y: 0 }
    };

    return (
        <motion.div 
            variants={container}
            initial="hidden"
            animate="show"
            className="max-w-[1700px] mx-auto p-4 md:p-10 space-y-12 min-h-screen"
        >
            <motion.div variants={item}>
                <DashboardWelcome />
            </motion.div>

            {/* Top Row: Mission Briefing & Quick Nudges */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-12 items-start">
                <motion.div variants={item} className="xl:col-span-3">
                    <MorningBriefing />
                </motion.div>
                
                <motion.div 
                    variants={item}
                    className="space-y-6"
                >
                    <div className="flex items-center gap-3 mb-4 px-2">
                        <div className="h-6 w-1 bg-indigo-500 rounded-full" />
                        <span className="text-xs font-black uppercase tracking-[0.25em] text-muted-foreground">Live Intel</span>
                    </div>
                    <NudgeBar />
                    <NudgeBar />
                </motion.div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                {/* Main Technical Hub */}
                <motion.div variants={item} className="lg:col-span-8 space-y-12">
                    <SovereignConsole />
                </motion.div>

                {/* Side Controls & Governance */}
                <motion.div variants={item} className="lg:col-span-4 space-y-12">
                    {/* Governance Gate / Live Action Queue */}
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-orange-500/10 to-purple-600/10 rounded-[2.5rem] blur-2xl opacity-0 group-hover:opacity-100 transition duration-1000"></div>
                        <div className="relative">
                            <ApprovalQueue />
                        </div>
                    </div>

                    {/* Quick Controls */}
                    <Card className="border-border rounded-[2rem] overflow-hidden shadow-sm">
                        <CardHeader className="border-b border-border bg-muted/40 p-8">
                            <CardTitle className="flex items-center gap-3 text-xl font-bold font-outfit">
                                <div className="p-2 rounded-xl bg-emerald-100">
                                    <Terminal className="w-5 h-5 text-emerald-700" />
                                </div>
                                Mission Command
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 p-8">
                            <ActionButton
                                endpoint={getBrowserApiBase() + "/admin/actions/start-scrapers"}
                                label="Trigger Data Ingestion"
                                icon={<Play className="w-5 h-5 text-emerald-600" />}
                            />
                            <ActionButton
                                endpoint={getBrowserApiBase() + "/admin/actions/pause-outreach"}
                                label="Halt Active Campaigns"
                                icon={<Pause className="w-5 h-5 text-orange-600" />}
                            />
                            <ActionButton
                                endpoint={getBrowserApiBase() + "/admin/actions/sync-crm"}
                                label="Sync External Records"
                                icon={<RefreshCw className="w-5 h-5 text-indigo-600" />}
                            />

                            <div className="mt-10 p-6 rounded-2xl bg-muted border border-border relative overflow-hidden group/health">
                                <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover/health:opacity-100 transition-opacity" />
                                <div className="relative z-10">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <Zap className="w-4 h-4 text-indigo-600" />
                                            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">System Integrity</span>
                                        </div>
                                        <span className="text-xs font-bold text-indigo-600">94%</span>
                                    </div>
                                    <div className="h-2 w-full bg-border rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: "94%" }}
                                            transition={{ delay: 1, duration: 1.5 }}
                                            className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400"
                                        />
                                    </div>
                                    <p className="text-[10px] font-medium text-muted-foreground mt-4 flex items-center gap-2">
                                        <div className="w-1 h-1 rounded-full bg-emerald-500" />
                                        12 Edge Nodes online and healthy.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </motion.div>
    );
}
