
import SectionTitle from '../SectionTitle';
import GlassCard from '../GlassCard';
import { Target, Zap, Users, BarChart3, Mail, MessageSquare } from 'lucide-react';

export default function FeaturesSection() {
    const features = [
        {
            title: "Multi-Channel Outreach",
            description: "Seamlessly connect via Email, LinkedIn, and Twitter from a single dashboard.",
            icon: <MessageSquare className="w-6 h-6 text-purple-400" />
        },
        {
            title: "Smart ICP Builder",
            description: "Define your Ideal Customer Profile with AI-driven attributes and buying signals.",
            icon: <Users className="w-6 h-6 text-blue-400" />
        },
        {
            title: "Precision Targeting",
            description: "Pinpoint decision-makers with 99% accuracy using our proprietary data engine.",
            icon: <Target className="w-6 h-6 text-red-400" />
        },
        {
            title: "Automated Follow-ups",
            description: "Never drop the ball. Intelligent sequences ensure timely and relevant follow-ups.",
            icon: <Zap className="w-6 h-6 text-yellow-400" />
        },
        {
            title: "Unified Inbox",
            description: "Manage all conversations in one place. AI drafts responses for you.",
            icon: <Mail className="w-6 h-6 text-green-400" />
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
