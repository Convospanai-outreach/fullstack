import { GlassCard } from "@/components/ui/GlassCard";

interface WorkflowNodeProps {
    title: string;
    type: "trigger" | "action" | "condition";
    x: number;
    y: number;
}

export function WorkflowNode({ title, type, x, y }: WorkflowNodeProps) {
    const typeColors = {
        trigger: "border-l-4 border-primary/30",
        action: "border-l-4 border-primary/30",
        condition: "border-l-4 border-warning/30",
    };

    return (
        <div
            className="absolute cursor-move"
            style={{ left: x, top: y }}
        >
            <GlassCard className={`w-64 p-4 ${typeColors[type]} hover:bg-foreground/10 transition`}>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs uppercase text-muted-foreground tracking-wider">{type}</span>
                    <button className="text-muted-foreground hover:text-foreground">•••</button>
                </div>
                <h4 className="font-bold text-foreground">{title}</h4>
            </GlassCard>

            {/* Connection Points */}
            <div className="absolute top-1/2 -left-2 w-4 h-4 bg-secondary rounded-full border-2 border-border hover:border-border cursor-pointer"></div>
            <div className="absolute top-1/2 -right-2 w-4 h-4 bg-secondary rounded-full border-2 border-border hover:border-border cursor-pointer"></div>
        </div>
    );
}
