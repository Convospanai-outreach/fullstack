import { GlassCard } from "@/components/ui/GlassCard";

export function WorkflowControls() {
    const tools = [
        { name: "Trigger", icon: "⚡" },
        { name: "Action", icon: "⚙️" },
        { name: "Condition", icon: "❓" },
        { name: "Delay", icon: "⏱️" },
    ];

    return (
        <GlassCard className="h-full">
            <h3 className="text-lg font-bold gradient-text mb-4">Toolbox</h3>
            <div className="grid grid-cols-2 gap-3">
                {tools.map((tool) => (
                    <div
                        key={tool.name}
                        className="bg-foreground/5 hover:bg-foreground/10 p-3 rounded-lg cursor-grab active:cursor-grabbing border border-transparent hover:border-foreground/20 transition text-center"
                    >
                        <div className="text-2xl mb-1">{tool.icon}</div>
                        <div className="text-xs text-foreground/80">{tool.name}</div>
                    </div>
                ))}
            </div>

            <div className="mt-8">
                <h3 className="text-lg font-bold gradient-text mb-4">Templates</h3>
                <div className="space-y-2">
                    <button className="w-full text-left text-sm text-foreground/80 hover:text-foreground hover:bg-foreground/5 p-2 rounded transition">
                        LinkedIn Outreach
                    </button>
                    <button className="w-full text-left text-sm text-foreground/80 hover:text-foreground hover:bg-foreground/5 p-2 rounded transition">
                        Lead Qualification
                    </button>
                    <button className="w-full text-left text-sm text-foreground/80 hover:text-foreground hover:bg-foreground/5 p-2 rounded transition">
                        Webinar Follow-up
                    </button>
                </div>
            </div>
        </GlassCard>
    );
}
