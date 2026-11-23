"use client";

import { Handle, Position } from "reactflow";
import { Zap } from "lucide-react";

export function TriggerNode({ data }: { data: any }) {
    const Icon = data.icon || Zap;

    return (
        <div className="bg-foreground/80 backdrop-blur-xl border border-success/50 rounded-full px-6 py-3 min-w-[200px] shadow-2xl shadow-success/20 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center text-success border border-success/20">
                <Icon className="w-4 h-4" />
            </div>
            <div>
                <h3 className="font-bold text-foreground text-sm">{data.label}</h3>
                <span className="text-[9px] text-muted-foreground uppercase tracking-widest">{data.source}</span>
            </div>

            <Handle type="source" position={Position.Bottom} className="!bg-success !w-3 !h-3 !-bottom-1.5" />
        </div>
    );
}
