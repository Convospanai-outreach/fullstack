import SectionTitle from '../SectionTitle';
import GlassCard from '../GlassCard';
import { Cpu, Network, Lock } from 'lucide-react';

export default function EngineSection() {
    return (
        <section className="py-24 bg-foreground/40">
            <SectionTitle title="Powered by the Cortex Engine" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

                    <div className="space-y-8">
                        <div>
                            <h3 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-3">
                                <Cpu className="text-primary w-8 h-8" />
                                Sovereign Intelligence
                            </h3>
                            <p className="text-muted-foreground text-lg">
                                Our proprietary <strong>Micro-LLM (Phi-3)</strong> runs locally on your edge node.
                                It acts as a <span className="text-primary">Sovereign Firewall</span>, filtering every Cloud AI draft through your local safety policies before it ever leaves the building.
                            </p>
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-3">
                                <Network className="text-primary w-8 h-8" />
                                Knowledge Graph
                            </h3>
                            <p className="text-muted-foreground text-lg">
                                We map relationships between people, companies, and technologies to uncover hidden buying intent.
                            </p>
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-3">
                                <Lock className="text-success w-8 h-8" />
                                Enterprise Security
                            </h3>
                            <p className="text-muted-foreground text-lg">
                                Enterprise-grade encryption and tenant isolation ensure your data and strategies remain completely private. The <strong>Privacy-First Architecture</strong> guarantees no PII is ever trained into the global model.
                            </p>
                        </div>
                    </div>

                    <div className="relative">
                        {/* Visual representation of the engine */}
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/20 blur-3xl -z-10 rounded-full"></div>
                        <GlassCard title="Live Interaction Stream">
                            <div className="space-y-4 font-mono text-sm">
                                <div className="flex items-center gap-3 text-success">
                                    <span className="w-2 h-2 bg-success rounded-full animate-pulse"></span>
                                    <span>[Cortex] Analyzing 2,400 new signals...</span>
                                </div>
                                <div className="flex items-center gap-3 text-primary">
                                    <span className="w-2 h-2 bg-primary rounded-full"></span>
                                    <span>[Lead] Match found: CTO @ Fintech, raised Series B</span>
                                </div>
                                <div className="flex items-center gap-3 text-primary">
                                    <span className="w-2 h-2 bg-primary rounded-full"></span>
                                    <span>[Cloud] Drafting personalized intro email...</span>
                                </div>
                                <div className="flex items-center gap-3 text-warning">
                                    <span className="w-2 h-2 bg-warning rounded-full"></span>
                                    <span>[Micro-LLM] Verifying safety policy (Phi-3)... PASS</span>
                                </div>
                                <div className="flex items-center gap-3 text-warning">
                                    <span className="w-2 h-2 bg-warning rounded-full"></span>
                                    <span>[System] Email scheduled for optimal open time (10:30 AM)</span>
                                </div>
                                <div className="pt-4 border-t border-foreground/10 text-center text-xs text-muted-foreground uppercase tracking-widest">
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
