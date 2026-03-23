"use client";

import { Handle, Position } from "reactflow";
import { Zap } from "lucide-react";

export function TriggerNode({ data }: { data: any }) {
    const Icon = data.icon || Zap;

    return (
        <div className="bg-black/80 backdrop-blur-xl border border-emerald-500/50 rounded-full px-6 py-3 min-w-[200px] shadow-2xl shadow-emerald-900/20 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                <Icon className="w-4 h-4" />
            </div>
            <div>
                <h3 className="font-bold text-white text-sm">{data.label}</h3>
                <span className="text-[9px] text-text-muted uppercase tracking-widest">{data.source}</span>
            </div>

            <Handle type="source" position={Position.Bottom} className="!bg-emerald-500 !w-3 !h-3 !-bottom-1.5" />
        </div>
    );
}
