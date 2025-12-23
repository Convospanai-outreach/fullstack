"use client";
import SectionTitle from "../../components/SectionTitle";
import GlassCard from "../../components/GlassCard";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

// Placeholder IDs - User to replace with env vars or real IDs
const PRICE_IDS = {
    STARTER: "price_starter_placeholder",
    GROWTH: "price_growth_placeholder"
};

export default function PricingPage() {
    const { data: session } = useSession();
    const router = useRouter();

    const handleCheckout = async (priceId: string) => {
        if (!session) {
            router.push("/signup");
            return;
        }

        try {
            toast.loading("Starting checkout...");
            const response = await fetch("/api/billing/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ priceId }),
            });

            if (!response.ok) throw new Error("Checkout failed");

            const data = await response.json();
            window.location.href = data.url;
        } catch (error) {
            toast.error("Failed to start checkout. Please try again.");
            console.error(error);
        }
    };

    return (
        <div>
            <SectionTitle title="Pricing Plans" />
            <div className="section grid grid-cols-1 md:grid-cols-3 gap-8 pt-12 items-start">
                <GlassCard title="Starter" className="border-white/10">
                    <h3 className="text-3xl font-bold text-white mb-2">$49<span className="text-lg text-gray-500 font-normal">/mo</span></h3>
                    <p className="mb-6 text-gray-400 text-sm">You’re just beginning — but your vision is already bigger than your tools.</p>
                    <ul className="space-y-3 mb-8 text-sm text-gray-300">
                        <li className="flex gap-2">✓ 500 Credits / mo</li>
                        <li className="flex gap-2">✓ Basic Enrichment</li>
                        <li className="flex gap-2">✓ Email Support</li>
                    </ul>
                    <button
                        onClick={() => handleCheckout(PRICE_IDS.STARTER)}
                        className="block w-full text-center py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white font-medium transition"
                    >
                        {session ? "Upgrade Now" : "Start Free"}
                    </button>
                </GlassCard>

                <div className="relative transform md:-translate-y-4">
                    <div className="absolute inset-0 bg-gradient-to-b from-purple-600 to-blue-600 rounded-2xl blur-lg opacity-40"></div>
                    <GlassCard title="Growth" className="relative border-purple-500/50 bg-black/40 backdrop-blur-xl">
                        <div className="absolute top-0 right-0 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">
                            MOST POPULAR
                        </div>
                        <h3 className="text-3xl font-bold text-white mb-2">$99<span className="text-lg text-gray-500 font-normal">/mo</span></h3>
                        <p className="mb-6 text-purple-200 text-sm">You’re scaling fast — and it’s time your systems caught up.</p>
                        <ul className="space-y-3 mb-8 text-sm text-white">
                            <li className="flex gap-2 text-purple-300"><span className="text-purple-400">✦</span> 2,500 Credits / mo</li>
                            <li className="flex gap-2">✓ Advanced Enrichment</li>
                            <li className="flex gap-2">✓ LinkedIn Automation agent</li>
                            <li className="flex gap-2">✓ Priority Support</li>
                        </ul>
                        <button
                            onClick={() => handleCheckout(PRICE_IDS.GROWTH)}
                            className="block w-full text-center py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg text-white font-bold hover:shadow-lg hover:shadow-purple-500/25 transition transform hover:scale-[1.02]"
                        >
                            {session ? "Upgrade to Pro" : "Start Free Trial"}
                        </button>
                    </GlassCard>
                </div>

                <GlassCard title="Enterprise" className="border-white/10">
                    <h3 className="text-3xl font-bold text-white mb-2">Custom</h3>
                    <p className="mb-6 text-gray-400 text-sm">You’ve outgrown limits — now you need total control.</p>
                    <ul className="space-y-3 mb-8 text-sm text-gray-300">
                        <li className="flex gap-2">✓ Custom Credit Volume</li>
                        <li className="flex gap-2">✓ Dedicated Success Manager</li>
                        <li className="flex gap-2">✓ SSO & Team Management</li>
                    </ul>
                    <button className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white font-medium transition">
                        Contact Sales
                    </button>
                </GlassCard>
            </div>
        </div>
    );
}
