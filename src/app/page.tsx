import GlowButton from "../components/GlowButton";
import EngineSection from "../components/landing/EngineSection";
import AgentsSection from "../components/landing/AgentsSection";
import FeaturesSection from "../components/landing/FeaturesSection";
import TechStackSection from "../components/landing/TechStackSection";
import FAQSection from "../components/landing/FAQSection";

export default function Home() {
    return (
        <div className="w-full">

            {/* HERO */}
            <section className="text-center pt-32 pb-20 relative px-4">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-purple-600/20 blur-[120px] -z-10 rounded-full"></div>

                <h1 className="text-5xl md:text-7xl font-extrabold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60 max-w-5xl mx-auto leading-tight tracking-tight mb-8">
                    The First AI-Native <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">Growth Operating System</span>
                </h1>

                <p className="text-xl text-gray-400 mt-6 max-w-2xl mx-auto leading-relaxed">
                    Stop manually chasing leads. <span className="text-white font-medium">ConvoSpan</span> deploys autonomous AI agents to identify, research, and convert your ideal customers 24/7.
                </p>

                <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6">
                    <GlowButton href="/signup" size="lg">Start Your Growth Engine</GlowButton>
                    <a href="#how-it-works" className="text-gray-400 hover:text-white transition-colors text-sm font-semibold uppercase tracking-wider">
                        See how it works
                    </a>
                </div>

                <div className="mt-20 pt-10 border-t border-white/5 max-w-5xl mx-auto">
                    <p className="text-sm text-gray-500 mb-8 uppercase tracking-widest font-semibold">Trusted by modern revenue teams</p>
                    <div className="flex flex-wrap justify-center gap-12 opacity-40 grayscale hover:grayscale-0 transition-all duration-700">
                        {/* Simple Text Logos for visual weight */}
                        <span className="text-xl font-bold text-white flex items-center gap-2"><div className="w-6 h-6 bg-blue-500 rounded-md"></div> TechFlow</span>
                        <span className="text-xl font-bold text-white flex items-center gap-2"><div className="w-6 h-6 bg-purple-500 rounded-full"></div> Nebula.io</span>
                        <span className="text-xl font-bold text-white flex items-center gap-2"><div className="w-6 h-6 bg-green-500 rounded-tr-lg"></div> Vertex</span>
                        <span className="text-xl font-bold text-white flex items-center gap-2"><div className="w-6 h-6 bg-orange-500 rounded-sm rotate-45"></div> Pulse</span>
                        <span className="text-xl font-bold text-white flex items-center gap-2"><div className="w-6 h-6 bg-indigo-500 rounded-full"></div> Aether</span>
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
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 blur-[100px] -z-10 rounded-full"></div>
                <h2 className="text-4xl font-bold text-white mb-6">Ready to replace busywork with results?</h2>
                <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
                    Join high-growth teams using ConvoSpan to automate their entire outbound funnel.
                </p>
                <GlowButton href="/signup" size="lg">Get Started for Free</GlowButton>
                <p className="mt-6 text-sm text-gray-500">No credit card required • 14-day free trial</p>
            </section>

        </div>
    );
}
