"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Check, Zap, Rocket, Shield, Crown, Star, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function PricingPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const [isAnnual, setIsAnnual] = useState(true);

    const loadRazorpayScript = () => {
        return new Promise((resolve) => {
            if ((window as any).Razorpay) {
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

    const handleCheckout = async (plan: string) => {
        if (plan === "Enterprise") {
            router.push("/contact");
            return;
        }

        if (!session) {
            router.push("/signup");
            return;
        }

        try {
            const isLoaded = await loadRazorpayScript();
            if (!isLoaded) {
                toast.error("Failed to load payment gateway");
                return;
            }

            const res = await fetch(process.env["NEXT_PUBLIC_API_URL"] + "/billing/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ planId: plan.toLowerCase() })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Failed to create order");

            const options = {
                key: data.key,
                amount: data.amount,
                currency: data.currency,
                name: "ConvoSpan",
                description: `${plan} Plan Subscription`,
                order_id: data.orderId,
                handler: function (_response: any) {
                    toast.success("Payment successful!");
                },
                prefill: {
                    name: session?.user?.name,
                    email: session?.user?.email
                },
                theme: { color: "#3b82f6" }
            };

            const rzp = new (window as any).Razorpay(options);
            rzp.open();
        } catch (error: any) {
            toast.error(error.message || "Checkout failed");
        }
    };

    const plans = [
        {
            name: "Starter",
            description: "Perfect for individual prospectors and testing",
            monthlyPrice: 49,
            annualPrice: 39,
            credits: 500,
            features: [
                "Basic AI Enrichment",
                "Email Sequencing",
                "Community Support",
                "Standard Lead Export"
            ],
            icon: Zap,
            color: "text-accent-silver",
            badge: "Free Trial Available"
        },
        {
            name: "Growth",
            description: "For teams scaling their outbound velocity",
            monthlyPrice: 99,
            annualPrice: 79,
            credits: 2500,
            features: [
                "Advanced Agent Intelligence",
                "LinkedIn Multi-step Playbooks",
                "Priority Support Response",
                "Custom ICP Builder",
                "A/B Testing Suites"
            ],
            icon: Rocket,
            color: "text-accent-blue",
            badge: "Most Popular",
            highlight: true
        },
        {
            name: "Enterprise",
            description: "Custom governance and infinite scale",
            monthlyPrice: 499,
            annualPrice: 399,
            credits: 15000,
            features: [
                "Full Governance Console",
                "SSO & Directory Sync",
                "Dedicated Success Manager",
                "Custom Model Fine-tuning",
                "Infinite Export Volume",
                "Audit Log Persistence"
            ],
            icon: Crown,
            color: "text-accent-gold",
            badge: "Custom Quotas"
        }
    ];

    return (
        <div className="min-h-screen bg-slate-950 text-white selection:bg-accent-blue/30 overflow-x-hidden">
            {/* Background Decorations */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent-blue/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent-violet/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="max-w-7xl mx-auto px-6 py-24 relative z-10">
                {/* Header */}
                <div className="text-center space-y-6 mb-20 animate-reveal">
                    <Badge variant="info" className="px-4 py-1.5 uppercase tracking-widest text-[10px] bg-accent-blue/10 border-accent-blue/20">
                        Pricing & Plans
                    </Badge>
                    <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight">
                        Fuel your <span className="bg-gradient-to-r from-accent-blue to-accent-violet bg-clip-text text-transparent">Outbound Engine</span>
                    </h1>
                    <p className="text-text-secondary text-lg max-w-2xl mx-auto">
                        Predictable pricing for high-performance teams. Switch plans at any time,
                        scale your credits as you grow.
                    </p>

                    {/* Billing Toggle */}
                    <div className="flex items-center justify-center gap-4 pt-4">
                        <span className={`text-sm font-semibold transition-colors ${!isAnnual ? 'text-white' : 'text-text-muted'}`}>Monthly</span>
                        <button
                            onClick={() => setIsAnnual(!isAnnual)}
                            aria-label="Toggle billing cycle"
                            className="w-14 h-7 bg-white/5 rounded-full p-1 border border-white/10 hover:border-white/20 transition-all relative group"
                        >
                            <div className={`w-5 h-5 bg-accent-blue rounded-full transition-all shadow-glow ${isAnnual ? 'translate-x-7' : 'translate-x-0'}`} />
                        </button>
                        <div className="flex items-center gap-2">
                            <span className={`text-sm font-semibold transition-colors ${isAnnual ? 'text-white' : 'text-text-muted'}`}>Annual</span>
                            <Badge className="bg-emerald-500/10 text-emerald-400 border-none !text-[9px] py-0.5">SAVE 20%</Badge>
                        </div>
                    </div>
                </div>

                {/* Pricing Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
                    {plans.map((plan, i) => {
                        const Icon = plan.icon;
                        const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;

                        return (
                            <div
                                key={plan.name}
                                className={`relative group animate-slide-up ${
                                    i === 0 ? 'animation-delay-0' : 
                                    i === 1 ? 'animation-delay-100' : 
                                    'animation-delay-200'
                                }`}
                            >
                                {plan.highlight && (
                                    <div className="absolute -top-4 inset-x-0 flex justify-center z-20">
                                        <Badge variant="info" className="bg-accent-blue text-white shadow-glow border-none px-4 py-1">
                                            {plan.badge}
                                        </Badge>
                                    </div>
                                )}

                                <div className={`h-full glass-strong p-8 rounded-3xl border transition-all duration-500 flex flex-col ${plan.highlight
                                    ? 'border-accent-blue/30 shadow-[0_0_50px_rgba(59,130,246,0.15)] bg-slate-900/40'
                                    : 'border-white/5 hover:border-white/20'
                                    }`}>
                                    <div className="mb-8">
                                        <div className={`p-3 rounded-2xl bg-white/5 w-fit mb-6 ${plan.color}`}>
                                            <Icon className="w-8 h-8" />
                                        </div>
                                        <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                                        <p className="text-sm text-text-secondary leading-relaxed">{plan.description}</p>
                                    </div>

                                    <div className="mb-8 p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-4xl font-black text-white">${price}</span>
                                            <span className="text-text-muted text-sm font-medium">/month</span>
                                        </div>
                                        <p className="text-[10px] text-text-muted mt-2 font-bold uppercase tracking-widest">
                                            Billed {isAnnual ? 'annually' : 'monthly'}
                                        </p>
                                        <div className="mt-4 pt-4 border-t border-white/5">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-text-secondary">Credits included</span>
                                                <span className="text-white font-bold">{plan.credits.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <ul className="space-y-4 mb-10 flex-1">
                                        {plan.features.map((feature) => (
                                            <li key={feature} className="flex items-start gap-3 text-sm text-text-secondary group-hover:text-white transition-colors">
                                                <div className={`shrink-0 mt-0.5 ${plan.highlight ? 'text-accent-blue' : 'text-text-muted'}`}>
                                                    <Check className="w-4 h-4" />
                                                </div>
                                                {feature}
                                            </li>
                                        ))}
                                    </ul>

                                    <Button
                                        variant={plan.highlight ? 'default' : 'outline'}
                                        className="w-full py-6 text-base font-bold"
                                        onClick={() => handleCheckout(plan.name)}
                                    >
                                        {plan.name === 'Enterprise' ? 'Contact Sales' : 'Get Started'}
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Value Proposition */}
                <div className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-12">
                    <div className="space-y-4">
                        <div className="p-3 bg-accent-blue/10 rounded-xl text-accent-blue w-fit">
                            <Shield className="w-6 h-6" />
                        </div>
                        <h4 className="text-lg font-bold text-white">Bank-Grade Security</h4>
                        <p className="text-sm text-text-secondary">AES-256 encryption at rest, SOC2 compliant infrastructure, and dedicated private VPC for enterprise.</p>
                    </div>
                    <div className="space-y-4">
                        <div className="p-3 bg-accent-violet/10 rounded-xl text-accent-violet w-fit">
                            <Star className="w-6 h-6" />
                        </div>
                        <h4 className="text-lg font-bold text-white">Priority Support</h4>
                        <p className="text-sm text-text-secondary">Our Growth and Enterprise plans get 1-hour response times and a dedicated WhatsApp tunnel for emergencies.</p>
                    </div>
                    <div className="space-y-4">
                        <div className="p-3 bg-accent-mint/10 rounded-xl text-accent-mint w-fit">
                            <ArrowRight className="w-6 h-6" />
                        </div>
                        <h4 className="text-lg font-bold text-white">Frictionless Migration</h4>
                        <p className="text-sm text-text-secondary">Import thousands of leads from Apollo, Hunter, or your custom CRM with 100% data integrity check.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
