import { Shield, Users, HeartHandshake, Rocket, Globe, Zap, Target, Brain } from "lucide-react";
import Link from "next/link";

export const metadata = {
    title: "About ConvoSpan - AI-Managed Growth Operations",
    description: "Learn how ConvoSpan helps B2B service companies turn buyer signals into qualified meetings with managed workflows and human approval."
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
                        Building the Buyer-Signal-to-Meeting{" "}
                        <span className="bg-gradient-to-r from-indigo-400 to-purple-500 bg-clip-text text-transparent">Growth Autopilot</span>
                    </h1>
                    <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
                        ConvoSpan was born from a simple frustration: B2B service companies see buying signals every week, but too few turn into approved outreach, timely follow-ups, and qualified meetings.
                    </p>
                </section>

                {/* Mission */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                    <div className="space-y-6">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-medium">
                            <Target className="w-4 h-4" />
                            Our Mission
                        </div>
                        <h2 className="text-4xl font-bold">Managed by AI. Approved by Humans.</h2>
                        <p className="text-lg text-gray-400 leading-relaxed">
                            We believe the best sales conversations happen when service teams enter each meeting with clear context, qualified intent, and approved messaging. ConvoSpan manages signal detection, lead enrichment, campaigns, and follow-ups so humans stay focused on decisions and relationships.
                        </p>
                        <p className="text-lg text-gray-400 leading-relaxed">
                            ConvoSpan does not replace salespeople. It <span className="text-white font-semibold">supports</span> them with vertical playbooks, human review controls, and meeting-ready handoffs.
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        {[
                            { stat: "Signals", label: "Detected and prioritized", icon: Users },
                            { stat: "Leads", label: "Enriched and qualified", icon: Zap },
                            { stat: "Approvals", label: "Human-controlled", icon: Shield },
                            { stat: "Meetings", label: "Tracked to pipeline", icon: Globe }
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
                            Our core values guide how we run managed growth workflows for service businesses.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-indigo-500/20 transition-all group">
                            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                                <Brain className="w-6 h-6 text-indigo-400" />
                            </div>
                            <h3 className="text-xl font-bold mb-3">Signals First</h3>
                            <p className="text-gray-400 leading-relaxed">
                                Every campaign starts with buyer context, fit, and timing so outreach supports pipeline workflow tracking.
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
                            <h3 className="text-xl font-bold mb-3">Outcome Obsessed</h3>
                            <p className="text-gray-400 leading-relaxed">
                                We focus on qualified leads, booked meetings, follow-up quality, and the operating rhythm needed to improve conversion.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Team */}
                <section className="space-y-12">
                    <div className="text-center space-y-4">
                        <h2 className="text-4xl font-bold">Built by Engineers Who Sold</h2>
                        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                            Our founding team comes from the intersection of AI workflows and enterprise growth operations. We have lived the gap between signal, outreach, follow-up, and meeting conversion.
                        </p>
                    </div>

                    <div className="p-12 rounded-3xl bg-gradient-to-br from-indigo-900/20 to-purple-900/20 border border-white/5 text-center">
                        <Rocket className="w-10 h-10 text-indigo-400 mx-auto mb-6" />
                        <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
                            "We started ConvoSpan because too many promising buyer signals were lost between research, outreach, follow-up, and scheduling. Today, ConvoSpan turns that gap into a managed workflow."
                        </p>
                        <p className="mt-6 text-sm text-gray-500">— ConvoSpan Founding Team</p>
                    </div>
                </section>

                {/* CTA */}
                <section className="text-center space-y-8 py-16 rounded-3xl bg-gradient-to-r from-indigo-900/30 to-purple-900/30 border border-white/5">
                    <h2 className="text-4xl font-bold">Ready to Start a Guided Growth Pilot?</h2>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                        Turn buyer signals into approved outreach, managed follow-ups, and qualified meetings for your service business.
                    </p>
                    <div className="flex justify-center gap-4">
                        <Link href="/signup">
                            <button className="px-10 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl text-lg font-bold transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30">
                                Start Guided Growth Pilot
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
