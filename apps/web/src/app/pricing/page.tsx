"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Crown, PhoneCall, Rocket, Shield, Star, TrendingUp, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Plan = {
    name: "Starter" | "Growth" | "Enterprise";
    description: string;
    monthlyPrice: number;
    annualPrice: number;
    credits: number;
    features: string[];
    icon: typeof Zap;
    badge: string;
    highlight?: boolean;
    outcome: string;
};

const plans: Plan[] = [
    {
        name: "Starter",
        description: "For founders and early operators validating the first outbound loop",
        monthlyPrice: 49,
        annualPrice: 39,
        credits: 500,
        features: [
            "Email campaign drafting",
            "Lead import and mapping",
            "Approval-first sending flow",
            "Standard support response",
        ],
        icon: Zap,
        badge: "Free Trial Available",
        outcome: "Launch your first compliant campaign quickly",
    },
    {
        name: "Growth",
        description: "For teams scaling repeatable campaigns with tighter controls and ROI visibility",
        monthlyPrice: 99,
        annualPrice: 79,
        credits: 2500,
        features: [
            "Higher monthly send capacity",
            "Campaign templates and variants",
            "Priority support response",
            "Approval and governance controls",
            "Reporting and ROI views",
        ],
        icon: Rocket,
        badge: "Most Popular",
        highlight: true,
        outcome: "Improve reply velocity and handoff quality",
    },
    {
        name: "Enterprise",
        description: "For teams that need governance, SSO, and rollout support",
        monthlyPrice: 499,
        annualPrice: 399,
        credits: 15000,
        features: [
            "Advanced governance console",
            "SSO & Directory Sync",
            "Dedicated Success Manager",
            "Custom rollout planning",
            "Expanded usage controls",
            "Audit log persistence",
        ],
        icon: Crown,
        badge: "Custom Quotas",
        outcome: "Operate multi-team outreach with confidence",
    },
];

const proofPoints = [
    "No annual lock-in required",
    "Keep data ownership and exports",
    "Approval-first workflows stay enabled",
];

export default function PricingPage() {
    const router = useRouter();
    const [isAnnual, setIsAnnual] = useState(true);

    const hasSessionCookie = () => {
        if (typeof document === "undefined") {
            return false;
        }
        return document.cookie.includes("next-auth.session-token=") ||
            document.cookie.includes("__Secure-next-auth.session-token=");
    };

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

    const handleCheckout = async (plan: Plan["name"]) => {
        if (plan === "Enterprise") {
            router.push("/contact");
            return;
        }

        if (!hasSessionCookie()) {
            router.push("/signup");
            return;
        }

        try {
            const isLoaded = await loadRazorpayScript();
            if (!isLoaded) {
                toast.error("Failed to load payment gateway");
                return;
            }

            const apiBase = process.env["NEXT_PUBLIC_API_URL"] || "/api/proxy";
            const base = apiBase.endsWith("/") ? apiBase.slice(0, -1) : apiBase;
            const res = await fetch(`${base}/billing/checkout`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ planId: plan.toLowerCase() }),
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
                handler: function () {
                    toast.success("Payment successful!");
                },
                theme: { color: "#0891b2" },
            };

            const rzp = new (window as any).Razorpay(options);
            rzp.open();
        } catch (error: any) {
            toast.error(error.message || "Checkout failed");
        }
    };

    return (
        <div className="min-h-screen overflow-x-hidden bg-slate-950 text-white selection:bg-cyan-500/30">
            <div className="pointer-events-none absolute left-[-8%] top-[-10%] h-[42%] w-[42%] rounded-full bg-cyan-500/12 blur-[120px]" />
            <div className="pointer-events-none absolute bottom-[-12%] right-[-8%] h-[42%] w-[42%] rounded-full bg-amber-400/10 blur-[120px]" />

            <div className="relative z-10 mx-auto max-w-7xl px-6 py-24">
                <div className="mb-20 space-y-6 text-center">
                    <Badge variant="info" className="border-cyan-500/20 bg-cyan-500/10 px-4 py-1.5 text-[10px] uppercase tracking-widest">
                        Pricing & Plans
                    </Badge>
                    <h1 className="text-5xl font-extrabold tracking-tight md:text-6xl">
                        Choose the plan for your outbound team.
                    </h1>
                    <p className="mx-auto max-w-2xl text-lg text-slate-300">
                        Start with guided email campaigns, then add governance and scale as your volume grows.
                    </p>

                    <div className="pt-4">
                        <div className="inline-flex items-center gap-4 rounded-full border border-white/10 bg-white/5 px-4 py-2">
                            <span className={`text-sm font-semibold transition-colors ${!isAnnual ? "text-white" : "text-slate-400"}`}>Monthly</span>
                            <button
                                onClick={() => setIsAnnual(!isAnnual)}
                                aria-label="Toggle billing cycle"
                                className="group relative h-7 w-14 rounded-full border border-white/10 bg-white/5 p-1 transition-all hover:border-white/20"
                            >
                                <div className={`h-5 w-5 rounded-full bg-cyan-500 shadow-lg shadow-cyan-500/30 transition-all ${isAnnual ? "translate-x-7" : "translate-x-0"}`} />
                            </button>
                            <div className="flex items-center gap-2">
                                <span className={`text-sm font-semibold transition-colors ${isAnnual ? "text-white" : "text-slate-400"}`}>Annual</span>
                                <Badge className="border-none bg-emerald-500/10 py-0.5 text-[9px] text-emerald-300">SAVE 20%</Badge>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 items-stretch gap-8 md:grid-cols-3">
                    {plans.map((plan) => {
                        const Icon = plan.icon;
                        const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;
                        const ctaText = plan.name === "Enterprise"
                            ? "Talk to Sales"
                            : plan.name === "Growth"
                              ? "Choose Growth"
                              : "Start Free Trial";

                        return (
                            <div key={plan.name} className="relative">
                                {plan.highlight && (
                                    <div className="absolute -top-4 inset-x-0 z-20 flex justify-center">
                                        <Badge variant="info" className="border-none bg-cyan-500 px-4 py-1 text-white shadow-lg shadow-cyan-500/30">
                                            {plan.badge}
                                        </Badge>
                                    </div>
                                )}

                                <div
                                    className={`flex h-full flex-col rounded-3xl border p-8 transition-all duration-500 ${
                                        plan.highlight
                                            ? "border-cyan-400/40 bg-slate-900/50 shadow-[0_0_50px_rgba(34,211,238,0.16)]"
                                            : "border-white/10 bg-slate-900/35 hover:border-white/25"
                                    }`}
                                >
                                    <div className="mb-8">
                                        <div className="mb-5 w-fit rounded-2xl bg-white/5 p-3 text-cyan-300">
                                            <Icon className="h-8 w-8" />
                                        </div>
                                        <h3 className="mb-2 text-2xl font-bold text-white">{plan.name}</h3>
                                        <p className="text-sm leading-relaxed text-slate-300">{plan.description}</p>
                                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">{plan.outcome}</p>
                                    </div>

                                    <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-4xl font-black text-white">${price}</span>
                                            <span className="text-sm font-medium text-slate-400">/month</span>
                                        </div>
                                        <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                            Billed {isAnnual ? "annually" : "monthly"}
                                        </p>
                                        <div className="mt-4 border-t border-white/10 pt-4">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-slate-300">Monthly usage included</span>
                                                <span className="font-bold text-white">{plan.credits.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <ul className="mb-10 flex-1 space-y-4">
                                        {plan.features.map((feature) => (
                                            <li key={feature} className="flex items-start gap-3 text-sm text-slate-200">
                                                <div className="mt-0.5 shrink-0 text-cyan-300">
                                                    <Check className="h-4 w-4" />
                                                </div>
                                                {feature}
                                            </li>
                                        ))}
                                    </ul>

                                    <Button
                                        variant={plan.highlight ? "default" : "outline"}
                                        className={`w-full py-6 text-base font-bold ${
                                            plan.highlight ? "bg-cyan-600 hover:bg-cyan-500" : "border-white/20 hover:bg-white/10"
                                        }`}
                                        onClick={() => handleCheckout(plan.name)}
                                    >
                                        {ctaText}
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-16 rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/8 to-slate-900/80 p-8 md:p-10">
                    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr,0.9fr]">
                        <div>
                            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
                                <PhoneCall className="h-3.5 w-3.5" />
                                Optional add-on
                            </div>
                            <h3 className="text-2xl font-black text-white md:text-3xl">
                                Optional human booking add-on for warm leads
                            </h3>
                            <p className="mt-3 max-w-xl text-sm leading-7 text-slate-200">
                                When campaigns generate high-intent replies, route only qualified leads to trained human callers who close the scheduling gap and book meetings.
                            </p>
                            <div className="mt-6 flex flex-wrap gap-3">
                                <Badge className="border-none bg-white/10 text-slate-100">Intent score threshold</Badge>
                                <Badge className="border-none bg-white/10 text-slate-100">Consent-aware routing</Badge>
                                <Badge className="border-none bg-white/10 text-slate-100">SLA-based follow-up</Badge>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-white/15 bg-slate-950/60 p-6">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Best fit</p>
                            <ul className="mt-4 space-y-3 text-sm text-slate-200">
                                <li className="flex items-start gap-2"><TrendingUp className="mt-0.5 h-4 w-4 text-cyan-300" />Teams already generating warm replies every week</li>
                                <li className="flex items-start gap-2"><TrendingUp className="mt-0.5 h-4 w-4 text-cyan-300" />Ops or sales teams where follow-up speed is the bottleneck</li>
                                <li className="flex items-start gap-2"><TrendingUp className="mt-0.5 h-4 w-4 text-cyan-300" />Workflows requiring governance and auditable handoffs</li>
                            </ul>
                            <Button onClick={() => router.push("/contact")} className="mt-6 w-full bg-cyan-600 py-5 font-semibold hover:bg-cyan-500">
                                Talk to sales about add-on pricing
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
                    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                        <div className="w-fit rounded-xl bg-cyan-500/10 p-3 text-cyan-300">
                            <Shield className="h-5 w-5" />
                        </div>
                        <h4 className="text-lg font-bold text-white">Secure by default</h4>
                        <p className="text-sm text-slate-300">Approval-first workflows and governance controls remain active as volume grows.</p>
                    </div>
                    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                        <div className="w-fit rounded-xl bg-amber-500/10 p-3 text-amber-300">
                            <Star className="h-5 w-5" />
                        </div>
                        <h4 className="text-lg font-bold text-white">Support when it matters</h4>
                        <p className="text-sm text-slate-300">Get implementation help for onboarding, billing, and launch readiness milestones.</p>
                    </div>
                    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                        <div className="w-fit rounded-xl bg-emerald-500/10 p-3 text-emerald-300">
                            <ArrowRight className="h-5 w-5" />
                        </div>
                        <h4 className="text-lg font-bold text-white">Clear growth path</h4>
                        <p className="text-sm text-slate-300">Start lean, validate conversion economics, then upgrade only when needed.</p>
                    </div>
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-400">
                    {proofPoints.map((point) => (
                        <span key={point} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                            {point}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}

