import SectionTitle from '../SectionTitle';
import { Bot, Search, PenTool, Calendar } from 'lucide-react';

export default function AgentsSection() {
    const agents = [
        {
            name: "Sovereign Research Agent",
            role: "Analyst",
            icon: <Search className="w-10 h-10 text-primary mb-4" />,
            desc: "Scours the web for hiring trends and funding news. PII is redacted locally before any cloud analysis."
        },
        {
            name: "Compliance Copywriter",
            role: "Creative",
            icon: <PenTool className="w-10 h-10 text-chart-4 mb-4" />,
            desc: "Crafts personalized messages. Uses local 'Golden Records' to ensure no compliance policies are violated."
        },
        {
            name: "SDR Agent (Edge)",
            role: "Outreach",
            icon: <Bot className="w-10 h-10 text-primary mb-4" />,
            desc: "Drafts outreach messages for your review. Runs on local hardware to ensure data sovereignty."
        },
        {
            name: "Scheduler Agent",
            role: "Coordination",
            icon: <Calendar className="w-10 h-10 text-success mb-4" />,
            desc: "Coordinates availability and books meetings directly on your calendar without the back-and-forth."
        }
    ];

    return (
        <section className="py-24">
            <SectionTitle title="Meet Your AI Workforce" />
            <p className="text-center text-muted-foreground max-w-2xl mx-auto mb-16 -mt-8">
                Stop doing manual grunt work. Deploy specialized AI agents that work 24/7 to fill your pipeline.
            </p>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {agents.map((agent, index) => (
                        <div key={index} className="relative group">
                            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-primary/10 rounded-xl blur-lg group-hover:blur-xl transition-all opacity-0 group-hover:opacity-100"></div>
                            <div className="bg-foreground/5 border border-foreground/10 p-8 rounded-xl h-full hover:border-primary/50 transition-colors relative z-10 flex flex-col items-center text-center">
                                {agent.icon}
                                <h3 className="text-xl font-bold text-foreground mb-1">{agent.name}</h3>
                                <span className="text-xs uppercase tracking-wider text-primary font-semibold mb-4">{agent.role}</span>
                                <p className="text-muted-foreground text-sm leading-relaxed">{agent.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
