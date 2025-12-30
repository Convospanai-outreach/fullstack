import { GlassCard } from "@/components/ui/GlassCard";

interface WorkflowNodeProps {
    title: string;
    type: "trigger" | "action" | "condition";
    x: number;
    y: number;
}

export function WorkflowNode({ title, type, x, y }: WorkflowNodeProps) {
    const typeColors = {
        trigger: "border-l-4 border-blue-500",
        action: "border-l-4 border-purple-500",
        condition: "border-l-4 border-yellow-500",
    };

    return (
        <div
            className="absolute cursor-move"
            style={{ left: x, top: y }}
        >
            <GlassCard className={`w-64 p-4 ${typeColors[type]} hover:bg-white/10 transition`}>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs uppercase text-gray-400 tracking-wider">{type}</span>
                    <button className="text-gray-500 hover:text-white">•••</button>
                </div>
                <h4 className="font-bold text-white">{title}</h4>
            </GlassCard>

            {/* Connection Points */}
            <div className="absolute top-1/2 -left-2 w-4 h-4 bg-gray-700 rounded-full border-2 border-gray-500 hover:border-white cursor-pointer"></div>
            <div className="absolute top-1/2 -right-2 w-4 h-4 bg-gray-700 rounded-full border-2 border-gray-500 hover:border-white cursor-pointer"></div>
        </div>
    );
}
