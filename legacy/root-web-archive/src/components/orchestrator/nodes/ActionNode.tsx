"use client";

import { Handle, Position } from "reactflow";
import { Mail, Linkedin, Webhook } from "lucide-react";

export function ActionNode({ data }: { data: any }) {
    const icons: any = { MAIL: Mail, LINKEDIN: Linkedin, WEBHOOK: Webhook };
    const Icon = icons[data.type] || Webhook;

    return (
        <div className="bg-black/80 backdrop-blur-xl border border-purple-500/50 rounded-2xl p-3 w-48 shadow-2xl shadow-purple-900/20">
            <Handle type="target" position={Position.Top} className="!bg-purple-500 !w-3 !h-3 !-top-1.5" />

            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400">
                    <Icon className="w-4 h-4" />
                </div>
                <div>
                    <h3 className="font-bold text-white text-xs">{data.label}</h3>
                </div>
            </div>
        </div>
    );
}
