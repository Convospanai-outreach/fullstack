import { Shield, Users, HeartHandshake, Rocket, Globe, Zap, Target, Brain } from "lucide-react";
import Link from "next/link";

export const metadata = {
    title: "About ConvoSpan — The AI-Powered Outreach Engine",
    description: "Learn about ConvoSpan's mission to empower sales teams with intelligent, autonomous outreach agents that book meetings while you sleep."
};

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-slate-950 text-white overflow-hidden">
            {/* Background */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="max-w-6xl mx-auto px-6 py-24 relative z-10 space-y-32">

                {/* Hero */}
                <section className="text-center space-y-6 animate-reveal">
                    <p className="text-sm uppercase tracking-widest text-indigo-400 font-semibold">Our Story</p>
                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-tight">
                        Building the Future of{" "}
                        <span className="bg-gradient-to-r from-indigo-400 to-purple-500 bg-clip-text text-transparent">Intelligent Outreach</span>
                    </h1>
                    <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
                        ConvoSpan was born from a simple frustration: sales teams spend 70% of their time on repetitive tasks instead of building relationships. We set out to change that — permanently.
                    </p>
                </section>

                {/* Mission */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                    <div className="space-y-6">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-medium">
                            <Target className="w-4 h-4" />
                            Our Mission
                        </div>
                        <h2 className="text-4xl font-bold">Automate the Grind. Amplify the Human.</h2>
                        <p className="text-lg text-gray-400 leading-relaxed">
                            We believe that the best sales conversations happen when reps are prepared, informed, and focused. ConvoSpan's AI agents handle prospecting, sequencing, and follow-ups autonomously — so your team can focus on what they do best: closing deals and building lasting partnerships.
                        </p>
                        <p className="text-lg text-gray-400 leading-relaxed">
                            Our platform doesn't replace salespeople. It <span className="text-white font-semibold">supercharges</span> them — turning every rep into a top performer by handling the 80% of work that doesn't require a human touch.
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        {[
                            { stat: "10K+", label: "Active Users", icon: Users },
                            { stat: "2.5M+", label: "Messages Sent", icon: Zap },
                            { stat: "99.9%", label: "Uptime SLA", icon: Shield },
                            { stat: "150+", label: "Countries Served", icon: Globe }
                        ].map((item, i) => (
                            <div key={i} className="p-6 rounded-2xl bg-white/[0.03] border border-white/5 text-center hover:border-indigo-500/20 transition-colors">
                                <item.icon className="w-6 h-6 mx-auto mb-3 text-indigo-400" />
                                <div className="text-3xl font-black text-white">{item.stat}</div>
                                <div className="text-sm text-gray-500 mt-1">{item.label}</div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Values */}
                <section className="space-y-12">
                    <div className="text-center space-y-4">
                        <h2 className="text-4xl font-bold">What Drives Us</h2>
                        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                            Our core values guide every decision — from the algorithms we build to the customers we serve.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-indigo-500/20 transition-all group">
                            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                                <Brain className="w-6 h-6 text-indigo-400" />
                            </div>
                            <h3 className="text-xl font-bold mb-3">Intelligence First</h3>
                            <p className="text-gray-400 leading-relaxed">
                                Every message, every sequence, every decision is backed by AI that learns from millions of successful outreach conversations. We don't guess — we optimize.
                            </p>
                        </div>
                        <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-purple-500/20 transition-all group">
                            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                                <Shield className="w-6 h-6 text-purple-400" />
                            </div>
                            <h3 className="text-xl font-bold mb-3">Privacy by Design</h3>
                            <p className="text-gray-400 leading-relaxed">
                                Enterprise-grade encryption, SOC2 compliance, and DPDP Act adherence are not add-ons — they're built into our architecture from day one. Your data never leaves the boundaries you set.
                            </p>
                        </div>
                        <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-emerald-500/20 transition-all group">
                            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                                <HeartHandshake className="w-6 h-6 text-emerald-400" />
                            </div>
                            <h3 className="text-xl font-bold mb-3">Customer Obsessed</h3>
                            <p className="text-gray-400 leading-relaxed">
                                We ship what our users need. Every feature is shaped by direct customer feedback, and our dedicated success managers ensure you see ROI within your first week.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Team */}
                <section className="space-y-12">
                    <div className="text-center space-y-4">
                        <h2 className="text-4xl font-bold">Built by Engineers Who Sold</h2>
                        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                            Our founding team comes from the intersection of AI research and enterprise sales. We've lived the pain and built the cure.
                        </p>
                    </div>

                    <div className="p-12 rounded-3xl bg-gradient-to-br from-indigo-900/20 to-purple-900/20 border border-white/5 text-center">
                        <Rocket className="w-10 h-10 text-indigo-400 mx-auto mb-6" />
                        <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
                            "We started ConvoSpan because we were tired of spending 4 hours a day on LinkedIn just to book 2 meetings. Today, our platform books those meetings autonomously — while our users sleep, travel, or focus on selling."
                        </p>
                        <p className="mt-6 text-sm text-gray-500">— ConvoSpan Founding Team</p>
                    </div>
                </section>

                {/* CTA */}
                <section className="text-center space-y-8 py-16 rounded-3xl bg-gradient-to-r from-indigo-900/30 to-purple-900/30 border border-white/5">
                    <h2 className="text-4xl font-bold">Ready to Transform Your Outreach?</h2>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                        Join thousands of growth teams already using ConvoSpan to book more meetings with less effort.
                    </p>
                    <div className="flex justify-center gap-4">
                        <Link href="/signup">
                            <button className="px-10 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl text-lg font-bold transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30">
                                Start Free Trial
                            </button>
                        </Link>
                        <Link href="/contact">
                            <button className="px-10 py-4 border border-white/10 hover:border-white/20 rounded-xl text-lg font-bold transition-all hover:bg-white/5">
                                Talk to Sales
                            </button>
                        </Link>
                    </div>
                </section>

            </div>
        </div>
    );
}
