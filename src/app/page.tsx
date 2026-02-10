import GlowButton from "../components/GlowButton";
import EngineSection from "../components/landing/EngineSection";
import AgentsSection from "../components/landing/AgentsSection";
import FeaturesSection from "../components/landing/FeaturesSection";
import TechStackSection from "../components/landing/TechStackSection";
import FAQSection from "../components/landing/FAQSection";

export default function Home() {
    return (
        <div className="w-full bg-surface-app text-foreground">

            {/* HERO */}
            <section className="text-center pt-32 pb-20 relative px-4">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-brand-600/10 blur-[120px] -z-10 rounded-full"></div>

                {/* TRUST BADGE */}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-500/10 border border-brand-500/20 mb-8 backdrop-blur-sm animate-fade-in-up">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
                    </span>
                    <span className="text-sm font-medium text-brand-200">
                        We intentionally limited remote execution to reduce user risk—increasing safe installs by 400% in our pilot.
                    </span>
                </div>

                <h1 className="text-5xl md:text-7xl font-extrabold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60 max-w-5xl mx-auto leading-tight tracking-tight mb-8">
                    The First Sovereign <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-indigo-500">Cyber-Physical Growth Engine</span>
                </h1>

                <p className="text-xl text-muted-foreground mt-6 max-w-2xl mx-auto leading-relaxed">
                    Stop manually chasing leads. <span className="text-foreground font-medium">ConvoSpan Edge</span> combines local hardware sovereignty with cloud AI to identify and convert customers—without compromising data privacy.
                </p>

                <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6">
                    <GlowButton href="/signup" size="lg">Start Your Growth Engine</GlowButton>
                    <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-semibold uppercase tracking-wider">
                        See how it works
                    </a>
                </div>

                <div className="mt-20 pt-10 border-t border-border max-w-5xl mx-auto">
                    <p className="text-sm text-muted-foreground mb-8 uppercase tracking-widest font-semibold">Trusted by modern revenue teams</p>
                    <div className="flex flex-wrap justify-center gap-12 opacity-60 grayscale hover:grayscale-0 transition-all duration-700">
                        {/* Simple Text Logos for visual weight */}
                        <span className="text-xl font-bold text-foreground flex items-center gap-2"><div className="w-6 h-6 bg-brand-500 rounded-md"></div> TechFlow</span>
                        <span className="text-xl font-bold text-foreground flex items-center gap-2"><div className="w-6 h-6 bg-purple-500 rounded-full"></div> Nebula.io</span>
                        <span className="text-xl font-bold text-foreground flex items-center gap-2"><div className="w-6 h-6 bg-emerald-500 rounded-tr-lg"></div> Vertex</span>
                        <span className="text-xl font-bold text-foreground flex items-center gap-2"><div className="w-6 h-6 bg-orange-500 rounded-sm rotate-45"></div> Pulse</span>
                        <span className="text-xl font-bold text-foreground flex items-center gap-2"><div className="w-6 h-6 bg-indigo-500 rounded-full"></div> Aether</span>
                    </div>
                </div>
            </section>

            <div id="how-it-works">
                <EngineSection />
            </div>

            <AgentsSection />

            <FeaturesSection />

            <TechStackSection />

            <FAQSection />

            {/* FINAL CTA */}
            <section className="py-32 text-center relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-600/10 blur-[100px] -z-10 rounded-full"></div>
                <h2 className="text-4xl font-bold text-foreground mb-6">Ready to replace busywork with results?</h2>
                <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
                    Join high-growth teams using ConvoSpan to automate their entire outbound funnel.
                </p>
                <GlowButton href="/signup" size="lg">Get Started for Free</GlowButton>
                <p className="mt-6 text-sm text-muted-foreground">No credit card required • 14-day free trial</p>
            </section>

        </div>
    );
}
