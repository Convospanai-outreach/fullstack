"use client";

import { useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useSession } from "next-auth/react";

const PLANS = [
    {
        name: "Free",
        price: "$0",
        features: ["100 AI Credits/mo", "Basic Analytics", "1 Campaign"],
        priceId: null,
    },
    {
        name: "Pro",
        price: "$29",
        features: ["1000 AI Credits/mo", "Advanced Analytics", "Unlimited Campaigns", "Priority Support"],
        priceId: "price_1Q_PRO", // Placeholder
        popular: true,
    },
    {
        name: "Enterprise",
        price: "$99",
        features: ["Unlimited AI Credits", "Custom Integrations", "Dedicated Manager", "SLA"],
        priceId: "price_1Q_ENT", // Placeholder
    },
];

export default function BillingPage() {
    const { data: session } = useSession();
    const [loading, setLoading] = useState<string | null>(null);

    const loadRazorpayScript = () => {
        return new Promise((resolve) => {
            if (window.Razorpay) {
                resolve(true);
                return;
            }
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

    const handleUpgrade = async (priceId: string | null) => {
        if (!priceId) return;
        setLoading(priceId);

        try {
            const isLoaded = await loadRazorpayScript();
            if (!isLoaded) {
                alert("Failed to load payment gateway");
                return;
            }

            // 1. Create Order
            const res = await fetch((process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy") + "/billing/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ priceId }),
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.message || "Failed to create order");

            // 2. Open Razorpay
            const options = {
                key: data.key,
                amount: data.amount,
                currency: data.currency,
                name: "CraftMyFunnel AI",
                description: "Subscription Upgrade",
                order_id: data.orderId,
                handler: function (response: any) {
                    alert(`Payment Successful! Payment ID: ${response.razorpay_payment_id}`);
                    // Optionally verify payment on backend here
                    // window.location.href = "/dashboard?upgrade=success";
                },
                prefill: {
                    name: session?.user?.name || "",
                    email: session?.user?.email || "",
                },
                theme: {
                    color: "#3B82F6",
                },
            };

            const rzp1 = new window.Razorpay(options);
            rzp1.on("payment.failed", function (response: any) {
                alert(response.error.description);
            });
            rzp1.open();

        } catch (error) {
            console.error(error);
            alert("Something went wrong");
        } finally {
            setLoading(null);
        }
    };

    const handleTopUp = async (tierId: string) => {
        setLoading("topup");
        try {
            const isLoaded = await loadRazorpayScript();
            if (!isLoaded) {
                alert("Failed to load payment gateway");
                return;
            }

            const res = await fetch((process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy") + "/billing/topup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tierId }),
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.message || "Failed to create order");

            const options = {
                key: data.key,
                amount: data.amount,
                currency: data.currency,
                name: "CraftMyFunnel AI",
                description: "Credits Top-up",
                order_id: data.id, // ID from backend is order_id
                handler: function (response: any) {
                    alert(`Top-up Successful! Payment ID: ${response.razorpay_payment_id}`);
                },
                prefill: {
                    name: session?.user?.name || "",
                    email: session?.user?.email || "",
                },
                theme: {
                    color: "#10B981", // Green for top-up
                },
            };

            const rzp1 = new window.Razorpay(options);
            rzp1.open();

        } catch (error) {
            console.error(error);
            alert("Top-up failed");
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="p-8 min-h-screen bg-black relative overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 max-w-5xl mx-auto space-y-12">

                {/* Credits Section */}
                <div className="glass p-8 rounded-2xl border border-white/10">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <SectionHeader title="Credit Balance" subtitle="Pay as you go for extra usage" />
                            <div className="text-sm text-gray-400 mt-1">
                                Used for AI generation, lead enrichment, and extra emails.
                            </div>
                        </div>
                        <div className="text-right">
                            {/* Ideally fetch real balance here */}
                            <div className="text-3xl font-bold text-white">---</div>
                            <div className="text-xs text-gray-400">Current Credits</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                            { tierId: "starter", credits: 500, amount: 500, label: "Starter Pack" },
                            { tierId: "pro", credits: 2000, amount: 1800, label: "Pro Pack", save: "Save 10%" },
                            { tierId: "power", credits: 10000, amount: 8000, label: "Power Pack", save: "Save 20%" }
                        ].map(pack => (
                            <button
                                key={pack.credits}
                                onClick={() => handleTopUp(pack.tierId)}
                                disabled={!!loading}
                                className="relative group p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-green-500/50 transition-all text-left"
                            >
                                {pack.save && (
                                    <span className="absolute -top-3 right-4 px-2 py-0.5 bg-green-600 text-[10px] font-bold uppercase rounded-full text-white">
                                        {pack.save}
                                    </span>
                                )}
                                <div className="text-lg font-bold text-white mb-1">{pack.credits} Credits</div>
                                <div className="text-gray-400 text-sm mb-3">{pack.label}</div>
                                <div className="text-xl font-bold text-green-400">₹{pack.amount}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Plans Section */}
                <div>
                    <h3 className="text-2xl font-bold text-white mb-6">Subscription Plans</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {PLANS.map((plan) => (
                            <div
                                key={plan.name}
                                className={`glass p-8 rounded-2xl border ${plan.popular ? 'border-blue-500 shadow-blue-500/20 shadow-lg' : 'border-white/10'} relative flex flex-col`}
                            >
                                {plan.popular && (
                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                                        Most Popular
                                    </div>
                                )}

                                <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                                <div className="text-4xl font-bold text-white mb-6">
                                    {plan.price}<span className="text-lg text-gray-400 font-normal">/mo</span>
                                </div>

                                <ul className="space-y-4 mb-8 flex-1">
                                    {plan.features.map((feature) => (
                                        <li key={feature} className="flex items-center text-gray-300">
                                            <svg className="w-5 h-5 text-green-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            {feature}
                                        </li>
                                    ))}
                                </ul>

                                <button
                                    onClick={() => handleUpgrade(plan.priceId)}
                                    disabled={!plan.priceId || !!loading}
                                    className={`w-full py-3 rounded-xl font-bold transition-all ${plan.priceId
                                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 text-white'
                                        : 'bg-white/10 text-gray-400 cursor-default'
                                        }`}
                                >
                                    {loading === plan.priceId ? "Processing..." : plan.priceId ? "Upgrade Now" : "Current Plan"}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
