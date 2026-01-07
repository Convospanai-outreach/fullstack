import SectionTitle from '../SectionTitle';
import { Bot, Search, PenTool, Calendar } from 'lucide-react';

export default function AgentsSection() {
    const agents = [
        {
            name: "Research Agent",
            role: "Analyst",
            icon: <Search className="w-10 h-10 text-cyan-400 mb-4" />,
            desc: "Scours the web for recent news, funding rounds, and hiring trends to find valid reasons to reach out."
        },
        {
            name: "Copywriter Agent",
            role: "Creative",
            icon: <PenTool className="w-10 h-10 text-pink-400 mb-4" />,
            desc: "Crafts hyper-personalized messages using NLP models tuned for high conversion and low spam rates."
        },
        {
            name: "SDR Agent",
            role: "Outreach",
            icon: <Bot className="w-10 h-10 text-blue-400 mb-4" />,
            desc: "Manages the entire conversation flow, handles objections, and ensures no lead is left behind."
        },
        {
            name: "Scheduler Agent",
            role: "Coordination",
            icon: <Calendar className="w-10 h-10 text-emerald-400 mb-4" />,
            desc: "Coordinates availability and books meetings directly on your calendar without the back-and-forth."
        }
    ];

    return (
        <section className="py-24">
            <SectionTitle title="Meet Your AI Workforce" />
            <p className="text-center text-gray-400 max-w-2xl mx-auto mb-16 -mt-8">
                Stop doing manual grunt work. Deploy specialized AI agents that work 24/7 to fill your pipeline.
            </p>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {agents.map((agent, index) => (
                        <div key={index} className="relative group">
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl blur-lg group-hover:blur-xl transition-all opacity-0 group-hover:opacity-100"></div>
                            <div className="bg-white/5 border border-white/10 p-8 rounded-xl h-full hover:border-blue-500/50 transition-colors relative z-10 flex flex-col items-center text-center">
                                {agent.icon}
                                <h3 className="text-xl font-bold text-white mb-1">{agent.name}</h3>
                                <span className="text-xs uppercase tracking-wider text-blue-400 font-semibold mb-4">{agent.role}</span>
                                <p className="text-gray-400 text-sm leading-relaxed">{agent.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
