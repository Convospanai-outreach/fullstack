"use client";

import { Handle, Position } from "reactflow";
import { Bot, Cpu } from "lucide-react";

export function AgentNode({ data }: { data: any }) {
    return (
        <div className="bg-foreground/80 backdrop-blur-xl border border-primary/50 rounded-2xl p-4 w-64 shadow-2xl shadow-primary/20 group hover:border-primary transition-all">
            <Handle type="target" position={Position.Top} className="!bg-primary !w-3 !h-3 !-top-1.5" />

            <div className="flex items-start gap-4 mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary border border-primary/20 shadow-inner">
                    <Bot className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="font-bold text-foreground text-sm">{data.label}</h3>
                    <span className="text-[10px] uppercase tracking-wider text-primary font-bold">{data.role}</span>
                </div>
            </div>

            <div className="bg-foreground/5 rounded-lg p-2 flex items-center gap-2 border border-foreground/5">
                <Cpu className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-mono">{data.model}</span>
            </div>

            <Handle type="source" position={Position.Bottom} className="!bg-primary !w-3 !h-3 !-bottom-1.5" />
        </div>
    );
}
