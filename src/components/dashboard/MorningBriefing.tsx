"use client";

import { useState, useEffect } from "react";
import { Sun, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export function MorningBriefing() {
    const [greeting, setGreeting] = useState("");
    const [briefing, setBriefing] = useState("");

    useEffect(() => {
        let typingInterval: NodeJS.Timeout;
        
        const hour = new Date().getHours();
        const timeGreeting = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";
        setGreeting(`${timeGreeting}, Growth Leader`);

        const fetchBriefing = async () => {
            try {
                const res = await fetch(process.env.NEXT_PUBLIC_API_URL + '/dashboard/briefing');
                const data = await res.json();
                
                const fullText = data.narrative || `Your AI agents have been busy. ${data.activeCampaigns} campaigns are currently active with a ${data.improvement}% higher engagement rate than yesterday. Suggested focus: Review the '${data.campaignName}' outreach - ${data.pendingApprovals} replies need your approval.`;
                
                let i = 0;
                setBriefing(""); // Clear before typing
                typingInterval = setInterval(() => {
                    if (i < fullText.length) {
                        setBriefing(prev => prev + fullText.charAt(i));
                        i++;
                    } else {
                    }
                }, 20);
            } catch (err) {
                setBriefing("System intelligence is calibrating. Your campaigns are running normally.");
            }
        };

        fetchBriefing();
        return () => {
            if (typingInterval) clearInterval(typingInterval);
        };
    }, []);

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-premium p-10 rounded-[3rem] group relative overflow-hidden"
        >
            {/* Animated Gradient Background */}
            <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none">
                <motion.div 
                    animate={{ 
                        scale: [1, 1.2, 1],
                        rotate: [0, 90, 0],
                        x: [-20, 20, -20],
                        y: [-20, 20, -20]
                    }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute -top-[20%] -right-[10%] w-[60%] h-[60%] bg-indigo-500/20 rounded-full blur-[120px]" 
                />
                <motion.div 
                    animate={{ 
                        scale: [1.2, 1, 1.2],
                        rotate: [90, 0, 90],
                        x: [20, -20, 20],
                        y: [20, -20, 20]
                    }}
                    transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                    className="absolute -bottom-[20%] -left-[10%] w-[60%] h-[60%] bg-purple-500/10 rounded-full blur-[120px]" 
                />
            </div>

            <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="flex h-3 w-3 rounded-full bg-emerald-500 animate-[pulse_2s_infinite]" />
                        <span className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]">AI Sync Active</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-white/5 border border-white/5 opacity-40 group-hover:opacity-100 transition-opacity">
                        <Sun className="w-6 h-6 text-indigo-300" />
                    </div>
                </div>

                <h2 className="text-5xl font-black text-white mb-6 tracking-tight font-outfit leading-tight">
                    {greeting}
                </h2>
                
                <div className="relative">
                    <p className="text-slate-300 max-w-2xl leading-relaxed text-xl font-medium min-h-[5rem]">
                        {briefing}
                        <motion.span 
                            animate={{ opacity: [1, 0, 1] }}
                            transition={{ repeat: Infinity, duration: 1 }}
                            className="inline-block w-2 h-6 bg-indigo-500 ml-2 translate-y-1 rounded-sm" 
                        />
                    </p>
                </div>

                <div className="mt-12 flex items-center gap-8">
                    <Button className="bg-indigo-600 hover:bg-indigo-500 text-white hover:scale-105 hover:shadow-2xl hover:shadow-indigo-500/20 px-8 py-7 rounded-[1.5rem] font-bold transition-all active:scale-95 flex items-center gap-3 border-none ring-1 ring-white/10">
                        <CheckCircle2 className="w-5 h-5" />
                        Execute Recommendations
                    </Button>
                    <button className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 hover:text-white transition-all transform hover:translate-x-1">
                        Dismiss Intelligence
                    </button>
                </div>
            </div>
        </motion.div>
    );
}
