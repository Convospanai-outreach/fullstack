
"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Sparkles, 
    ShieldCheck, 
    Target, 
    ArrowRight, 
    X,
    Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function DashboardWelcome() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const hasSeenWelcome = localStorage.getItem("convo_welcome_seen");
        if (!hasSeenWelcome) {
            setIsVisible(true);
        }
    }, []);

    const dismissWelcome = () => {
        setIsVisible(false);
        localStorage.setItem("convo_welcome_seen", "true");
    };

    if (!isVisible) return null;

    return (
        <AnimatePresence>
            <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative overflow-hidden glass rounded-3xl border border-white/10 p-8 mb-8 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent shadow-2xl"
            >
                {/* Background Blobs */}
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl" />
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />

                <div className="relative z-10">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="bg-indigo-500 p-2.5 rounded-xl shadow-lg shadow-indigo-500/30">
                                <Sparkles className="w-6 h-6 text-white" />
                            </div>
                            <h1 className="text-3xl font-black text-white tracking-tight">
                                Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">ConvoSpan</span>
                            </h1>
                        </div>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="rounded-full hover:bg-white/10" 
                            onClick={dismissWelcome}
                        >
                            <X className="w-5 h-5 text-gray-400" />
                        </Button>
                    </div>

                    <p className="text-lg text-gray-300 max-w-3xl mb-10 leading-relaxed">
                        The world's first <span className="text-white font-semibold">Sovereign Growth Platform</span>. 
                        Your AI agents work locally to protect your data while maximizing your outreach impact. 
                        Here's how to navigate your new command center:
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                        <div className="group p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-indigo-500/30 transition-all duration-300">
                            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center mb-4 group-hover:bg-indigo-500/30 transition-colors">
                                <Cpu className="w-5 h-5 text-indigo-400" />
                            </div>
                            <h3 className="text-white font-bold mb-2">Sovereign Core</h3>
                            <p className="text-sm text-gray-400">Monitor local Phi-3 inference and PII masking status in the console below.</p>
                        </div>

                        <div className="group p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-purple-500/30 transition-all duration-300">
                            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center mb-4 group-hover:bg-purple-500/30 transition-colors">
                                <ShieldCheck className="w-5 h-5 text-purple-400" />
                            </div>
                            <h3 className="text-white font-bold mb-2">Governance Gate</h3>
                            <p className="text-sm text-gray-400">Review and approve high-risk agent actions before they hit the wire.</p>
                        </div>

                        <div className="group p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-emerald-500/30 transition-all duration-300">
                            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-4 group-hover:bg-emerald-500/30 transition-colors">
                                <Target className="w-5 h-5 text-emerald-400" />
                            </div>
                            <h3 className="text-white font-bold mb-2">Bulls-Eye RAG</h3>
                            <p className="text-sm text-gray-400">Semantic signal detection that autonomously finds high-value leads.</p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
                        <Button 
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-6 rounded-xl text-lg font-bold shadow-xl shadow-indigo-600/20 transition-all hover:scale-[1.02]"
                            onClick={dismissWelcome}
                        >
                            Let's Get Started
                            <ArrowRight className="w-5 h-5 ml-2" />
                        </Button>
                        <Button variant="ghost" className="text-gray-400 hover:text-white px-8 py-6 rounded-xl text-lg hover:bg-white/5 transition-all">
                            View Documentation
                        </Button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
