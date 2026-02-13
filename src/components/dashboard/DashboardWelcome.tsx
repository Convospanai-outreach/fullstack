
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
                initial={{ opacity: 0, y: -40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative glass-premium rounded-[2.5rem] p-12 mb-12 group transition-all duration-700"
            >
                {/* Refined Background Blobs */}
                <div className="absolute -top-32 -right-32 w-80 h-80 bg-indigo-500/15 rounded-full blur-[100px] group-hover:bg-indigo-500/25 transition-colors duration-1000" />
                <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-purple-500/10 rounded-full blur-[100px] group-hover:bg-purple-500/20 transition-colors duration-1000" />

                {/* Light Sweep Effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.03] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-[1500ms]" />
                </div>

                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-10">
                        <motion.div 
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="flex items-center gap-4"
                        >
                            <div className="bg-indigo-600 p-3 rounded-2xl shadow-[0_0_25px_rgba(79,70,229,0.3)]">
                                <Sparkles className="w-7 h-7 text-white" />
                            </div>
                            <h1 className="text-4xl font-black text-white tracking-tight font-outfit">
                                Welcome to <span className="text-glow text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-300">ConvoSpan</span>
                            </h1>
                        </motion.div>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="rounded-full hover:bg-white/10 w-10 h-10 transition-transform hover:rotate-90" 
                            onClick={dismissWelcome}
                        >
                            <X className="w-6 h-6 text-slate-500 hover:text-white" />
                        </Button>
                    </div>

                    <motion.p 
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="text-xl text-slate-400 max-w-4xl mb-12 leading-relaxed font-medium"
                    >
                        Master the art of <span className="text-white">Sovereign Growth</span>. 
                        Your local AI agents are synchronized and ready to amplify your impact without compromising your data privacy. 
                        Your command center is online.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                        {[
                            { icon: Cpu, color: "text-indigo-400", bg: "bg-indigo-500/10", title: "Sovereign Core", desc: "Local SLM execution with zero-leak PII masking protocols." },
                            { icon: ShieldCheck, color: "text-purple-400", bg: "bg-purple-500/10", title: "Governance Gate", desc: "Human-in-the-loop validation for all high-risk agent behaviors." },
                            { icon: Target, color: "text-emerald-400", bg: "bg-emerald-500/10", title: "Bulls-Eye RAG", desc: "Autonomous signal detection tuned for high-conversion outcomes." }
                        ].map((feature, idx) => (
                            <motion.div 
                                key={idx}
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.4 + (idx * 0.1) }}
                                className="group/card p-6 rounded-3xl bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/[0.08] transition-all duration-300 shadow-xl"
                            >
                                <div className={`w-12 h-12 rounded-xl ${feature.bg} flex items-center justify-center mb-5 group-hover/card:scale-110 transition-transform duration-500 shadow-lg`}>
                                    <feature.icon className={`w-6 h-6 ${feature.color}`} />
                                </div>
                                <h3 className="text-lg text-white font-bold mb-3 font-outfit">{feature.title}</h3>
                                <p className="text-sm text-slate-400 leading-relaxed font-medium">{feature.desc}</p>
                            </motion.div>
                        ))}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-6">
                        <Button 
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-8 rounded-[1.5rem] text-lg font-bold shadow-[0_0_30px_rgba(79,70,229,0.2)] transition-all hover:scale-[1.03] active:scale-95 border-none"
                            onClick={dismissWelcome}
                        >
                            Enter Command Center
                            <ArrowRight className="w-6 h-6 ml-2 group-hover:translate-x-1 transition-transform" />
                        </Button>
                        <Button variant="ghost" className="text-slate-400 hover:text-white px-10 py-8 rounded-[1.5rem] text-lg hover:bg-white/5 transition-all font-bold">
                            View Sovereignty Docs
                        </Button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
