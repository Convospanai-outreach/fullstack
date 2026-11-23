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

    const isTemplate = (option.description || "").startsWith("Template:");

    return (
        <GlassCard className={`p-6 space-y-4 border ${selected ? "border-primary/60" : "border-foreground/10"}`}>
            <div>
                <div className="flex items-center gap-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-primary">{option.framework}</p>
                    {isTemplate ? (
                        <span className="rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
                            Template
                        </span>
                    ) : null}
                </div>
                <h3 className="mt-2 text-xl font-bold text-foreground">{option.title}</h3>
                <p className="mt-2 text-sm text-foreground/80">{(option.description || "Generated wireframe option").replace(/^Template:\s*/, "")}</p>
            </div>

            <div className="rounded-lg border border-foreground/10 bg-background/50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Section Flow</p>
                <ul className="mt-3 space-y-1 text-sm text-foreground">
                    {sections.map((section, index) => (
                        <li key={`${option.id}-${index}`}>{index + 1}. {section.heading || section.type}</li>
                    ))}
                </ul>
            </div>

            <Button
                onClick={() => onSelect(option.id)}
                disabled={selecting}
                className={selected ? "bg-primary hover:bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-secondary"}
            >
                {selecting ? "Selecting..." : selected ? "Selected" : "Select & Open Editor"}
            </Button>
        </GlassCard>
    );
}
