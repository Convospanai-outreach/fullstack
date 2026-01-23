import SectionTitle from '../SectionTitle';
import GlassCard from '../GlassCard';
import { Cpu, Network, Lock } from 'lucide-react';

export default function EngineSection() {
    return (
        <section className="py-24 bg-black/40">
            <SectionTitle title="Powered by the Cortex Engine" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

                    <div className="space-y-8">
                        <div>
                            <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                                <Cpu className="text-blue-500 w-8 h-8" />
                                Sovereign Intelligence
                            </h3>
                            <p className="text-gray-400 text-lg">
                                Our proprietary Cortex Engine runs locally on your edge node.
                                It processes millions of data points without exposing your strategy to the cloud.
                            </p>
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                                <Network className="text-purple-500 w-8 h-8" />
                                Knowledge Graph
                            </h3>
                            <p className="text-gray-400 text-lg">
                                We map relationships between people, companies, and technologies to uncover hidden buying intent.
                            </p>
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                                <Lock className="text-green-500 w-8 h-8" />
                                Enterprise Security
                            </h3>
                            <p className="text-gray-400 text-lg">
                                SOC-2 compliant infrastructure ensures your data and strategies remain completely private and secure.
                            </p>
                        </div>
                    </div>

                    <div className="relative">
                        {/* Visual representation of the engine */}
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-3xl -z-10 rounded-full"></div>
                        <GlassCard title="Live Interaction Stream">
                            <div className="space-y-4 font-mono text-sm">
                                <div className="flex items-center gap-3 text-green-400">
                                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                    <span>[Cortex] Analyzing 2,400 new signals...</span>
                                </div>
                                <div className="flex items-center gap-3 text-blue-400">
                                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                    <span>[Lead] Match found: CTO @ Fintech, raised Series B</span>
                                </div>
                                <div className="flex items-center gap-3 text-purple-400">
                                    <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                                    <span>[Agent] Drafting personalized intro email...</span>
                                </div>
                                <div className="flex items-center gap-3 text-orange-400">
                                    <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                                    <span>[System] Email scheduled for optimal open time (10:30 AM)</span>
                                </div>
                                <div className="pt-4 border-t border-white/10 text-center text-xs text-gray-500 uppercase tracking-widest">
                                    System Status: Operational
                                </div>
                            </div>
                        </GlassCard>
                    </div>

                </div>
            </div>
        </section>
    );
}
