"use client";

import { useState } from 'react';
import {
    ChevronDown,
    ChevronRight,
    Lightbulb,
    Cpu,
    Clock,
    TerminalSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Step {
    name: string;
    thought: string;
    input?: string;
    output?: string;
    duration: number;
    tokens: number;
}

interface TraceVisualizerProps {
    traces: Step[];
    model?: string;
    totalTokens?: number;
    totalCost?: number;
}

export function TraceVisualizer({ traces, model, totalTokens, totalCost }: TraceVisualizerProps) {
    const [expandedStep, setExpandedStep] = useState<number | null>(null);

    return (
        <div className="rounded-xl border border-foreground/10 bg-foreground/40 overflow-hidden font-sans">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-foreground/5 border-b border-foreground/5">
                <div className="flex items-center gap-2">
                    <TerminalSquare className="w-4 h-4 text-primary" />
                    <span className="text-sm font-bold text-foreground">Reasoning Trace</span>
                    {model && <span className="text-xs text-muted-foreground bg-foreground/5 px-2 py-0.5 rounded border border-foreground/5">{model}</span>}
                </div>
                <div className="flex items-center gap-4 text-xs">
                    {totalTokens && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                            <Cpu className="w-3 h-3" /> {totalTokens.toLocaleString()} tokens
                        </div>
                    )}
                    {totalCost && (
                        <div className="text-success font-mono">
                            ${totalCost.toFixed(4)}
                        </div>
                    )}
                </div>
            </div>

            {/* Steps Timeline */}
            <div className="p-4 space-y-2">
                {traces.map((step, idx) => (
                    <div key={idx} className="border border-foreground/5 rounded-lg overflow-hidden bg-foreground/[0.02]">
                        <button
                            onClick={() => setExpandedStep(expandedStep === idx ? null : idx)}
                            className="w-full flex items-center justify-between p-3 hover:bg-foreground/5 transition-colors text-left"
                        >
                            <div className="flex items-center gap-3">
                                {expandedStep === idx ? (
                                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                )}
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-foreground">{step.name}</span>
                                    <span className="text-[10px] text-muted-foreground line-clamp-1">{step.thought}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {step.duration}ms</span>
                            </div>
                        </button>

                        <AnimatePresence>
                            {expandedStep === idx && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="border-t border-foreground/5 bg-foreground/20"
                                >
                                    <div className="p-3 space-y-4">
                                        <div className="flex gap-3">
                                            <div className="mt-1"><Lightbulb className="w-4 h-4 text-warning/80" /></div>
                                            <div className="text-sm text-foreground/80 leading-relaxed italic border-l-2 border-warning/20 pl-3">
                                                {step.thought}
                                            </div>
                                        </div>

                                        {step.input && (
                                            <div className="space-y-1">
                                                <div className="text-[10px] font-bold text-muted-foreground uppercase">Input Context</div>
                                                <div className="bg-foreground/40 rounded p-2 text-xs font-mono text-muted-foreground overflow-x-auto border border-foreground/5">
                                                    {step.input}
                                                </div>
                                            </div>
                                        )}

                                        {step.output && (
                                            <div className="space-y-1">
                                                <div className="text-[10px] font-bold text-muted-foreground uppercase">Result</div>
                                                <div className="bg-foreground/40 rounded p-2 text-xs font-mono text-success/90 overflow-x-auto border border-foreground/5">
                                                    {step.output}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                ))}
            </div>
        </div>
    );
}
