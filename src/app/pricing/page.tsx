"use client";
import SectionTitle from "../../components/SectionTitle";
import GlassCard from "../../components/GlassCard";
import { toast } from "sonner";

export default function PricingPage() {


    return (
        <div>
            <SectionTitle title="Pricing Plans" />
            <div className="section grid grid-cols-1 md:grid-cols-3 gap-8 pt-0">
                <GlassCard title="Starter">
                    <h3 className="text-2xl font-bold text-white mb-2">$49/mo</h3>
                    <p className="mb-4 text-gray-400">Perfect for solo founders.</p>
                    <a
                        href="/dashboard"
                        className="block w-full text-center py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white font-medium transition"
                    >
                        Sign in to Upgrade
                    </a>
                </GlassCard>
                <GlassCard title="Growth">
                    <h3 className="text-2xl font-bold text-white mb-2">$99/mo</h3>
                    <p className="mb-4 text-gray-400">For scaling sales teams.</p>
                    <a
                        href="/dashboard"
                        className="block w-full text-center py-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg text-white font-bold hover:opacity-90 transition"
                    >
                        Sign in to Upgrade
                    </a>
                </GlassCard>
                <GlassCard title="Enterprise">
                    <h3 className="text-2xl font-bold text-white mb-2">Custom</h3>
                    <p className="mb-4 text-gray-400">Unlimited agents and workflows.</p>
                    <button className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white font-medium transition">
                        Contact Sales
                    </button>
                </GlassCard>
            </div>
        </div>
    );
}
