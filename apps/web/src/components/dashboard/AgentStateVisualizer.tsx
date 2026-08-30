
'use client';

import React from 'react';
import { CheckCircle2, Circle, Loader2, ShieldCheck, Brain, Zap, Terminal, Activity } from 'lucide-react';

export type AgentState = 'PENDING' | 'PLANNING' | 'SANITIZING' | 'GENERATING' | 'CRITIQUING' | 'EXECUTING' | 'COMPLETED';

interface AgentStateVisualizerProps {
    currentState: AgentState;
    taskId?: string;
}

const STAGES: { id: AgentState; label: string; icon: any; color: string }[] = [
    { id: 'PENDING', label: 'Idle', icon: Circle, color: 'text-muted-foreground' },
    { id: 'PLANNING', label: 'Strategy', icon: Terminal, color: 'text-indigo-400' },
    { id: 'SANITIZING', label: 'Sovereign Mask', icon: ShieldCheck, color: 'text-emerald-400' },
    { id: 'GENERATING', label: 'Cortex Logic', icon: Brain, color: 'text-purple-400' },
    { id: 'CRITIQUING', label: 'Adversary', icon: Activity, color: 'text-amber-400' },
    { id: 'EXECUTING', label: 'Hardware Strike', icon: Zap, color: 'text-orange-400' },
    { id: 'COMPLETED', label: 'Success', icon: CheckCircle2, color: 'text-sky-400' },
];

export const AgentStateVisualizer: React.FC<AgentStateVisualizerProps> = ({ currentState, taskId }) => {
    const currentIndex = STAGES.findIndex(s => s.id === currentState);

    return (
        <div className="p-6 bg-card border border-border rounded-2xl glass-morphism overflow-hidden relative">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h3 className="text-foreground font-semibold text-lg flex items-center gap-2">
                        Live Agent DFA
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    </h3>
                    <p className="text-muted-foreground text-xs mt-1 font-mono">TASK_ID: {taskId || '0x000000'}</p>
                </div>
                <div className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] uppercase font-bold tracking-widest">
                    Operational
                </div>
            </div>

            <div className="relative flex justify-between">
                {/* Connector Lines */}
                <div className="absolute top-6 left-6 right-6 h-0.5 bg-muted -z-10" />
                <div
                    className="absolute top-6 left-6 h-0.5 bg-gradient-to-r from-indigo-500 to-sky-400 transition-all duration-700 -z-10"
                    style={{ width: `${(currentIndex / (STAGES.length - 1)) * 100}%` }}
                />

                {STAGES.map((stage, index) => {
                    const isCompleted = index < currentIndex;
                    const isActive = stage.id === currentState;
                    const Icon = stage.icon;

                    return (
                        <div key={stage.id} className="flex flex-col items-center gap-3 group relative">
                            {/* Node */}
                            <div className={`
                                w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300
                                ${isCompleted ? 'bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]' :
                                    isActive ? 'bg-muted border-2 border-indigo-500 scale-110 shadow-[0_0_20px_rgba(99,102,241,0.3)]' :
                                        'bg-muted border border-border opacity-60'}
                            `}>
                                {isActive && !isCompleted ? (
                                    <Loader2 className={`w-6 h-6 animate-spin ${stage.color}`} />
                                ) : (
                                    <Icon className={`w-6 h-6 ${isCompleted ? 'text-white' : stage.color}`} />
                                )}

                                {/* Hover Tooltip */}
                                <div className="absolute -top-8 bg-popover text-foreground text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 border border-border">
                                    {stage.label}
                                </div>
                            </div>

                            {/* Label */}
                            <div className="flex flex-col items-center text-center">
                                <span className={`text-[10px] font-bold tracking-tighter transition-colors ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                                    {stage.id}
                                </span>
                                {isActive && (
                                    <span className="text-[9px] text-indigo-400 animate-pulse mt-0.5 uppercase font-mono tracking-widest">
                                        Processing...
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Ambient Background Glow */}
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-500/5 rounded-full blur-[100px] -z-20" />
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-sky-500/5 rounded-full blur-[100px] -z-20" />
        </div>
    );
};
