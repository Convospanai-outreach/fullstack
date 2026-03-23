"use client";

import { Handle, Position } from "reactflow";
import { Bot, Cpu } from "lucide-react";

export function AgentNode({ data }: { data: any }) {
    return (
        <div className="bg-black/80 backdrop-blur-xl border border-accent-blue/50 rounded-2xl p-4 w-64 shadow-2xl shadow-blue-900/20 group hover:border-accent-blue transition-all">
            <Handle type="target" position={Position.Top} className="!bg-accent-blue !w-3 !h-3 !-top-1.5" />

            <div className="flex items-start gap-4 mb-3">
                <div className="w-10 h-10 rounded-xl bg-accent-blue/20 flex items-center justify-center text-accent-blue border border-accent-blue/20 shadow-inner">
                    <Bot className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="font-bold text-white text-sm">{data.label}</h3>
                    <span className="text-[10px] uppercase tracking-wider text-accent-blue font-bold">{data.role}</span>
                </div>
            </div>

            <div className="bg-white/5 rounded-lg p-2 flex items-center gap-2 border border-white/5">
                <Cpu className="w-3.5 h-3.5 text-text-muted" />
                <span className="text-xs text-text-secondary font-mono">{data.model}</span>
            </div>

            <Handle type="source" position={Position.Bottom} className="!bg-accent-blue !w-3 !h-3 !-bottom-1.5" />
        </div>
    );
}
