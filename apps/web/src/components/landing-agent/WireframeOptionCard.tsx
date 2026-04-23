"use client";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";
import type { WireframeOption } from "@/modules/landing-agent/types";

interface Props {
    option: WireframeOption;
    selected?: boolean;
    onSelect: (id: string) => void;
    selecting?: boolean;
}

export default function WireframeOptionCard({ option, selected, onSelect, selecting }: Props) {
    const sections = Array.isArray(option.structure) ? option.structure : [];

    return (
        <GlassCard className={`p-6 space-y-4 border ${selected ? "border-cyan-400/60" : "border-white/10"}`}>
            <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">{option.framework}</p>
                <h3 className="mt-2 text-xl font-bold text-white">{option.title}</h3>
                <p className="mt-2 text-sm text-slate-300">{option.description || "Generated wireframe option"}</p>
            </div>

            <div className="rounded-lg border border-white/10 bg-slate-900/50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Section Flow</p>
                <ul className="mt-3 space-y-1 text-sm text-slate-200">
                    {sections.map((section, index) => (
                        <li key={`${option.id}-${index}`}>{index + 1}. {section.heading || section.type}</li>
                    ))}
                </ul>
            </div>

            <Button
                onClick={() => onSelect(option.id)}
                disabled={selecting}
                className={selected ? "bg-cyan-600 hover:bg-cyan-500 text-white" : "bg-white text-slate-900 hover:bg-slate-200"}
            >
                {selecting ? "Selecting..." : selected ? "Selected" : "Select & Open Editor"}
            </Button>
        </GlassCard>
    );
}
