"use client";

import { Handle, Position } from "reactflow";
import { Mail, Linkedin, Webhook } from "lucide-react";

export function ActionNode({ data }: { data: any }) {
    const icons: any = { MAIL: Mail, LINKEDIN: Linkedin, WEBHOOK: Webhook };
    const Icon = icons[data.type] || Webhook;

    return (
        <div className="bg-foreground/80 backdrop-blur-xl border border-primary/50 rounded-2xl p-3 w-48 shadow-2xl shadow-primary/20">
            <Handle type="target" position={Position.Top} className="!bg-primary !w-3 !h-3 !-top-1.5" />

            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                    <Icon className="w-4 h-4" />
                </div>
                <div>
                    <h3 className="font-bold text-foreground text-xs">{data.label}</h3>
                </div>
            </div>
        </div>
    );
}
