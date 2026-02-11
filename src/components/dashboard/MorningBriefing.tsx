"use client";

import { useState, useEffect } from "react";
import { Sun, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export function MorningBriefing() {
    const [greeting, setGreeting] = useState("");
    const [briefing, setBriefing] = useState("");

    // Simulate typing effect
    useEffect(() => {
        const hour = new Date().getHours();
        const timeGreeting = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";
        setGreeting(`${timeGreeting}, Growth Leader`);

        const fullText = "Your AI agents have been busy. 3 campaigns are currently active with a 12% higher engagement rate than yesterday. Suggested focus: Review the 'Enterprise' outreach - 5 replies need your approval.";
        let i = 0;
        const typing = setInterval(() => {
            if (i < fullText.length) {
                setBriefing(prev => prev + fullText.charAt(i));
                i++;
            } else {
                clearInterval(typing);
            }
        }, 30); // Speed of typing

        return () => clearInterval(typing);
    }, []);

    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass p-8 rounded-[2.5rem] border border-white/5 bg-gradient-to-br from-indigo-500/10 via-transparent to-purple-500/5 relative overflow-hidden mb-8 group"
        >
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity duration-1000">
                <Sun className="w-32 h-32 text-indigo-400" />
            </div>

            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                    <div className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Daily Intelligence Brief</span>
                </div>

                <h2 className="text-3xl font-black text-white mb-3 tracking-tight">{greeting}</h2>
                <p className="text-gray-400 max-w-2xl leading-relaxed text-lg font-medium min-h-[4rem]">
                    {briefing}
                    <motion.span 
                        animate={{ opacity: [1, 0] }}
                        transition={{ repeat: Infinity, duration: 0.8 }}
                        className="inline-block w-1.5 h-5 bg-indigo-500 ml-1 translate-y-0.5" 
                    />
                </p>

                <div className="mt-8 flex items-center gap-6">
                    <Button className="bg-white text-black hover:bg-gray-200 px-6 py-6 rounded-2xl font-bold shadow-xl shadow-white/5 transition-all active:scale-95 leading-none">
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Execute Recommendations
                    </Button>
                    <button className="text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-white transition-colors">
                        Dismiss Intelligence
                    </button>
                </div>
            </div>
        </motion.div>
    );
}
