
import SectionTitle from '../SectionTitle';
import GlassCard from '../GlassCard';
import { Target, Zap, Users, BarChart3, Shield } from 'lucide-react';

export default function FeaturesSection() {
    const features = [
        {
            title: "Sovereign Firewall",
            description: "Bank-grade security. Our local Micro-LLM (Phi-3) inspects every outgoing message, ensuring PII never leaves your device.",
            icon: <Zap className="w-6 h-6 text-yellow-400" />
        },
        {
            title: "Compliance Guardrails",
            description: "Built for DPDP & GDPR. The system mechanically redacts sensitive data before it touches the cloud.",
            icon: <Shield className="w-6 h-6 text-green-400" />
        },
        {
            title: "SafeRun™ Assisted Mode",
            description: "No more bans. Our local-first engine executes actions from your own IP, mimicking human behavior perfectly.",
            icon: <Shield className="w-6 h-6 text-blue-400" />
        },
        {
            title: "Smart ICP Builder",
            description: "Define your Ideal Customer Profile with AI-driven attributes and buying signals.",
            icon: <Users className="w-6 h-6 text-purple-400" />
        },
        {
            title: "Precision Targeting",
            description: "Pinpoint decision-makers with multi-source verification using our lead validation engine.",
            icon: <Target className="w-6 h-6 text-red-400" />
        },
        {
            title: "Deep Analytics",
            description: "Track open rates, replies, and conversions with real-time actionable insights.",
            icon: <BarChart3 className="w-6 h-6 text-indigo-400" />
        }
    ];

    return (
        <section className="py-24 relative z-10">
            <SectionTitle title="Everything You Need to Scale" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {features.map((feature, index) => (
                        <GlassCard key={index} title={feature.title} className="h-full">
                            <div className="mb-4">{feature.icon}</div>
                            <p className="text-gray-400 leading-relaxed">
                                {feature.description}
                            </p>
                        </GlassCard>
                    ))}
                </div>
            </div>
        </section>
    );
}
