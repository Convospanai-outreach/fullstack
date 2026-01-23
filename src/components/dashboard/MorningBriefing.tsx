"use client";

import { useState, useEffect } from "react";
import { Sparkles, Sun, CheckCircle2 } from "lucide-react";

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
        <div className="glass p-6 rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-purple-500/5 relative overflow-hidden mb-8">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <Sun className="w-24 h-24 text-blue-400" />
            </div>

            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-5 h-5 text-blue-400 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Daily AI Briefing</span>
                </div>

                <h2 className="text-2xl font-bold text-white mb-2">{greeting}</h2>
                <p className="text-gray-300 max-w-2xl leading-relaxed min-h-[3rem]">
                    {briefing}
                    <span className="inline-block w-1.5 h-4 bg-blue-400 ml-1 animate-pulse" />
                </p>

                <div className="mt-6 flex gap-4">
                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg text-sm text-blue-300 transition-colors">
                        <CheckCircle2 className="w-4 h-4" />
                        Review 5 Replies
                    </button>
                    <button className="text-sm text-gray-500 hover:text-white transition-colors">
                        Dismiss
                    </button>
                </div>
            </div>
        </div>
    );
}
