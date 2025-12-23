import GlowButton from "../components/GlowButton";
import GlassCard from "../components/GlassCard";
import SectionTitle from "../components/SectionTitle";

export default function Home() {
    return (
        <div className="w-full">

            {/* HERO */}
            <section className="text-center pt-32 pb-20">
                <h1 className="text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-b from-purple-400 to-blue-500 max-w-4xl mx-auto leading-tight">
                    You’ve built something incredible. <br /> You’ve worked hard to get noticed. <br /> And you know there’s a faster way to grow.
                </h1>
                <p className="text-xl text-gray-300 mt-6 max-w-2xl mx-auto">
                    ConvoSpan turns your outreach into unstoppable momentum — connecting you with the right people, automatically.
                </p>

                <div className="mt-10">
                    <GlowButton href="/signup">Yes, I’m Ready to Grow</GlowButton>
                </div>

                <div className="mt-16 pt-8 border-t border-white/5">
                    <p className="text-sm text-gray-400 mb-6 uppercase tracking-wider font-semibold">Trusted by modern sales teams</p>
                    <div className="flex flex-wrap justify-center gap-8 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                        {/* Simple Text Logos for visual weight without external assets */}
                        <span className="text-xl font-bold text-white flex items-center gap-2"><div className="w-6 h-6 bg-blue-500 rounded-md"></div> TechFlow</span>
                        <span className="text-xl font-bold text-white flex items-center gap-2"><div className="w-6 h-6 bg-purple-500 rounded-full"></div> Nebula.io</span>
                        <span className="text-xl font-bold text-white flex items-center gap-2"><div className="w-6 h-6 bg-green-500 rounded-tr-lg"></div> Vertex</span>
                        <span className="text-xl font-bold text-white flex items-center gap-2"><div className="w-6 h-6 bg-orange-500 rounded-sm rotate-45"></div> Pulse</span>
                    </div>
                </div>
            </section>

            {/* FEATURE EXAMPLE CARDS */}
            <section className="section grid grid-cols-1 md:grid-cols-3 gap-8">
                <GlassCard title="AI Outreach">
                    Personalized, automated messaging & follow-ups.
                </GlassCard>

                <GlassCard title="ICP Builder">
                    Analyze personas, industries, sentiment & buying signals.
                </GlassCard>

                <GlassCard title="LinkedIn Automation">
                    Comment, like, message, and connect automatically.
                </GlassCard>
            </section>

            {/* WHY COVOSPAN */}
            <SectionTitle title="Why Growth Teams Choose CovoSpan" />

            <section className="section grid grid-cols-1 md:grid-cols-2 gap-10">
                <GlassCard title="Faster Pipeline">
                    Enrich, qualify, and engage leads at 5x speed.
                </GlassCard>

                <GlassCard title="Always-On Agents">
                    Your AI works 24x7 — never missing a lead.
                </GlassCard>
            </section>

        </div>
    );
}
