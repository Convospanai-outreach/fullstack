"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";
import HeroScene from "@/components/marketing/HeroScene";
import EngineSection from "@/components/landing/EngineSection";
import AgentsSection from "@/components/landing/AgentsSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import TechStackSection from "@/components/landing/TechStackSection";
import FAQSection from "@/components/landing/FAQSection";
import {
    Zap
} from "lucide-react";

export default function Home() {
    return (
        <div className="min-h-screen bg-app text-white overflow-x-hidden relative selection:bg-brand-500/30">
            {/* 3D Background */}
            <HeroScene />

            {/* Background Gradients */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none opacity-50">
                <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-brand-600/20 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-brand-500/10 rounded-full blur-[120px] animate-pulse [animation-delay:2s]" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-32 pb-32">
                
                {/* HERO SECTION */}
                <section className="text-center pt-32 pb-20">
                    <div className="inline-flex items-center gap-2 mb-8 px-5 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm text-sm font-medium text-brand-300 animate-fade-in-up">
                        <Zap className="w-4 h-4 text-brand-400" />
                        Next-Gen Sovereign Growth Intelligence
                    </div>
                    
                    <h1 className="text-6xl md:text-8xl font-bold mb-8 tracking-tight leading-tight">
                        The First Sovereign <br />
                        <span className="bg-gradient-to-r from-brand-400 to-indigo-500 bg-clip-text text-transparent">Cyber-Physical Growth Engine</span>
                    </h1>
                    
                    <p className="text-xl md:text-2xl text-slate-400 mb-12 max-w-3xl mx-auto leading-relaxed">
                        Stop manually chasing leads. <span className="text-white font-medium">ConvoSpan Edge</span> combines local hardware sovereignty with cloud AI to identify and convert customers—without compromising data privacy.
                    </p>

                    <div className="flex flex-col sm:flex-row justify-center gap-6">
                        <Link href="/signup">
                            <Button variant="default" className="px-10 py-5 text-xl w-full sm:w-auto shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 transition-all bg-brand-500 hover:bg-brand-600">
                                Get Started for Free
                            </Button>
                        </Link>
                        <Link href="/pricing">
                            <Button variant="outline" className="px-10 py-5 text-xl w-full sm:w-auto border-white/10 hover:bg-white/5">
                                View Pricing
                            </Button>
                        </Link>
                    </div>

                    <div className="mt-20 pt-10 border-t border-white/5 max-w-5xl mx-auto">
                        <p className="text-sm text-slate-500 mb-8 uppercase tracking-widest font-semibold">Trusted by modern revenue teams</p>
                        <div className="flex flex-wrap justify-center gap-12 opacity-60 grayscale hover:grayscale-0 transition-all duration-700">
                             <span className="text-xl font-bold text-white flex items-center gap-2">TechFlow</span>
                             <span className="text-xl font-bold text-white flex items-center gap-2">Nebula.io</span>
                             <span className="text-xl font-bold text-white flex items-center gap-2">Vertex</span>
                             <span className="text-xl font-bold text-white flex items-center gap-2">Pulse</span>
                             <span className="text-xl font-bold text-white flex items-center gap-2">Aether</span>
                        </div>
                    </div>
                </section>

                {/* KEY BENEFITS */}
                <section id="how-it-works">
                    <EngineSection />
                </section>

                <AgentsSection />

                <FeaturesSection />

                {/* ROI / STATS SECTION */}
                <section className="bg-white/5 border border-white/10 rounded-3xl py-24 backdrop-blur-lg">
                    <div className="max-w-7xl mx-auto px-6 text-center">
                        <h2 className="text-4xl font-bold mb-16">Real Results, Real Fast</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                            <div className="p-6">
                                <div className="text-5xl font-bold text-brand-400 mb-4">3x</div>
                                <p className="text-xl text-slate-300 font-medium">More Meetings Booked</p>
                                <p className="text-sm text-slate-500 mt-2">vs. manual outreach</p>
                            </div>
                            <div className="p-6 border-x border-white/10">
                                <div className="text-5xl font-bold text-white mb-4">40%</div>
                                <p className="text-xl text-slate-300 font-medium">Time Saved Weekly</p>
                                <p className="text-sm text-slate-500 mt-2">on repetitive tasks</p>
                            </div>
                            <div className="p-6">
                                <div className="text-5xl font-bold text-brand-400 mb-4">&lt;1%</div>
                                <p className="text-xl text-slate-300 font-medium">Bounce Rate</p>
                                <p className="text-sm text-slate-500 mt-2">with verified intelligence</p>
                            </div>
                        </div>
                    </div>
                </section>

                <TechStackSection />

                {/* TESTIMONIALS */}
                <section>
                    <h2 className="text-4xl md:text-5xl font-bold text-center mb-16">Loved by Growth Teams</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            {
                                quote: "ConvoSpan completely transformed our outbound. We booked 3x more meetings in the first month.",
                                author: "Sarah J.",
                                role: "VP of Sales, TechFlow"
                            },
                            {
                                quote: "The AI personalization is scary good. People think I'm actually writing these messages manually.",
                                author: "Mike T.",
                                role: "Founder, StartScale"
                            },
                            {
                                quote: "Finally, a tool that doesn't get my accounts banned. The safety features are top-notch.",
                                author: "Elena R.",
                                role: "Growth Lead, DataCo"
                            }
                        ].map((t, i) => (
                            <GlassCard key={i} className="p-8 flex flex-col justify-between hover:bg-white/10 transition-colors">
                                <p className="text-lg text-slate-300 italic mb-6">"{t.quote}"</p>
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-sm font-bold text-white shadow-lg">
                                        {t.author.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="font-semibold text-white">{t.author}</div>
                                        <div className="text-sm text-slate-500">{t.role}</div>
                                    </div>
                                </div>
                            </GlassCard>
                        ))}
                    </div>
                </section>

                <FAQSection />

                {/* FINAL CTA */}
                <section className="relative rounded-3xl overflow-hidden py-24 bg-gradient-to-br from-brand-900/40 to-slate-900/40 border border-white/10">
                    <div className="absolute inset-0 bg-brand-500/5 blur-[100px] -z-10"></div>
                    <div className="relative z-10 px-6 text-center space-y-8">
                        <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight">Ready to replace busywork with results?</h2>
                        <p className="text-xl text-slate-300 max-w-2xl mx-auto">
                            Join high-growth teams using ConvoSpan to automate their entire outbound funnel on-shore.
                        </p>
                        <div className="flex flex-col sm:flex-row justify-center gap-4">
                            <Link href="/signup">
                                <Button className="px-12 py-6 text-xl bg-brand-500 hover:bg-brand-600 text-white font-bold h-auto">Get Started for Free</Button>
                            </Link>
                        </div>
                        <p className="text-sm text-slate-500">No credit card required • 14-day full-access trial</p>
                    </div>
                </section>
            </div>
        </div>
    );
}
