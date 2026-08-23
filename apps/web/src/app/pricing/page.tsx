"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Crown, PhoneCall, Rocket, Shield, Star, TrendingUp, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/Modal";
import { toast } from "sonner";
import { BILLING_COUNTRIES, INDIAN_STATES } from "@/lib/billingAddress";

type Plan = {
    name: "Starter" | "Growth" | "Enterprise";
    displayName: string;
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
        displayName: "Pilot",
        description: "30-day growth pilot package for one ICP, one geography, and one offer",
        monthlyPrice: 49,
        annualPrice: 39,
        credits: 500,
        features: [
            "Email campaign drafting",
            "Lead list and qualification workflow",
            "Campaign landing funnel",
            "Approval-first sending flow",
            "Follow-up handling and reporting",
        ],
        icon: Zap,
        badge: "Pilot Available",
        outcome: "Review a qualified lead and meeting-tracking motion before scaling",
    },
    {
        name: "Growth",
        displayName: "Growth Autopilot",
        description: "Monthly managed campaign operations for repeatable pipeline tracking",
        monthlyPrice: 99,
        annualPrice: 79,
        credits: 2500,
        features: [
            "Multiple managed campaigns",
            "Vertical playbooks and variants",
            "Weekly performance review",
            "Approval and governance controls",
            "Lead and meeting workflow tracking",
        ],
        icon: Rocket,
        badge: "Most Popular",
        highlight: true,
        outcome: "Support buyer-signal follow-up and meeting tracking",
    },
    {
        name: "Enterprise",
        displayName: "Enterprise / Partner",
        description: "Custom vertical playbooks, governance, and private-data execution options",
        monthlyPrice: 499,
        annualPrice: 399,
        credits: 15000,
        features: [
            "Team governance and approval workflows",
            "Custom vertical playbook design",
            "Private data / edge execution where applicable",
            "Advanced reporting",
            "Dedicated success and rollout support",
            "Partner operating model",
        ],
        icon: Crown,
        badge: "Custom Quotas",
        outcome: "Operate governed growth workflows across teams or regions",
    },
];

const proofPoints = [
    "Managed growth execution",
    "Human-approved campaign operations",
    "Lead and meeting workflow tracking",
];

// Matches PLAN_ALIASES in apps/api/routes/billing/checkout/route.ts, which maps
// these same lowercase names to the real Plan.name rows (PRO/GROWTH/ENTERPRISE).
const DB_PLAN_NAME: Record<Plan["name"], string> = {
    Starter: "PRO",
    Growth: "GROWTH",
    Enterprise: "ENTERPRISE",
};

type LivePrice = { currency: string; amount: number | null; available: boolean };

const CURRENCY_SYMBOL: Record<string, string> = { USD: "$", EUR: "€", INR: "₹" };

export default function PricingPage() {
    const router = useRouter();
    // Defaults to monthly: checkout always charges plan.monthlyPrice regardless of
    // this toggle (annual billing isn't wired up server-side yet), so showing the
    // discounted annual price by default would misrepresent what gets charged.
    const [isAnnual, setIsAnnual] = useState(false);
    const [billingModalOpen, setBillingModalOpen] = useState(false);
    const [pendingPlan, setPendingPlan] = useState<Plan["name"] | null>(null);
    const [billingCountry, setBillingCountry] = useState("IN");
    const [billingCustomCountry, setBillingCustomCountry] = useState("");
    const [billingState, setBillingState] = useState("Delhi");
    const [livePrices, setLivePrices] = useState<Record<string, LivePrice> | null>(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    // Refetches whenever the visitor picks a different billing country in the modal,
    // so the displayed price always matches what checkout would actually charge.
    useEffect(() => {
        const resolvedCountry = billingCountry === "OTHER" ? (billingCustomCountry.trim() || "US") : billingCountry;
        const apiBase = process.env["NEXT_PUBLIC_API_URL"] || "/api/proxy";
        const base = apiBase.endsWith("/") ? apiBase.slice(0, -1) : apiBase;

        fetch(`${base}/billing/plans?country=${encodeURIComponent(resolvedCountry)}`)
            .then((res) => res.json())
            .then((data) => {
                const byName: Record<string, LivePrice> = {};
                for (const p of data.plans || []) {
                    byName[p.name] = { currency: data.currency, amount: p.amount, available: p.available ?? true };
                }
                setLivePrices(byName);
            })
            .catch(() => setLivePrices(null));
    }, [billingCountry, billingCustomCountry]);

    const hasSessionCookie = () => {
        if (typeof document === "undefined") {
            return false;
        }
        return document.cookie.includes("next-auth.session-token=") ||
            document.cookie.includes("__Secure-next-auth.session-token=");
    };

    useEffect(() => {
        setIsLoggedIn(hasSessionCookie());
    }, []);

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

    const handleCheckout = (plan: Plan["name"]) => {
        if (plan === "Enterprise") {
            router.push("/contact");
            return;
        }

        if (!hasSessionCookie()) {
            router.push("/signup");
            return;
        }

        setPendingPlan(plan);
        setBillingModalOpen(true);
    };

    const confirmCheckout = async () => {
        const plan = pendingPlan;
        if (!plan) return;
        setBillingModalOpen(false);

        const resolvedCountry = billingCountry === "OTHER" ? billingCustomCountry.trim() : billingCountry;

        try {
            const apiBase = process.env["NEXT_PUBLIC_API_URL"] || "/api/proxy";
            const base = apiBase.endsWith("/") ? apiBase.slice(0, -1) : apiBase;
            const res = await fetch(`${base}/billing/checkout`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    planId: plan.toLowerCase(),
                    country: resolvedCountry,
                    state: resolvedCountry === "IN" ? billingState : undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Failed to create order");

            if (data.gateway === "STRIPE") {
                // Stripe Checkout is hosted - redirect instead of opening a client-side popup.
                window.location.href = data.url;
                return;
            }

            const isLoaded = await loadRazorpayScript();
            if (!isLoaded) {
                toast.error("Failed to load payment gateway");
                return;
            }

            const options = {
                key: data.key,
                amount: data.amount,
                currency: data.currency,
                name: "CraftMyFunnel",
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
                        Plans for managed growth execution, campaign operations, and pipeline tracking.
                    </h1>
                    <p className="mx-auto max-w-2xl text-lg text-slate-300">
                        Start with a focused pilot, then scale the buyer-signal-to-meeting workflow with managed campaigns, follow-ups, and governance.
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
                        const live = livePrices?.[DB_PLAN_NAME[plan.name]];
                        // Live price only applies to the monthly figure - annual billing isn't
                        // wired up server-side yet (see the toggle's comment above), so the
                        // annual column stays on the static marketing estimate either way.
                        const price = isAnnual
                            ? plan.annualPrice
                            : live?.amount != null ? Math.round(live.amount / 100) : plan.monthlyPrice;
                        const currencySymbol = !isAnnual && live ? (CURRENCY_SYMBOL[live.currency] || live.currency + " ") : "$";
                        const isEnterprise = plan.name === "Enterprise";
                        let ctaText = isEnterprise ? "Talk to Sales" : "Start Pilot";
                        
                        if (!isEnterprise) {
                            if (plan.name === "Growth") {
                                ctaText = isLoggedIn ? "Start Guided Growth Pilot" : "Sign Up for Growth Pilot";
                            } else {
                                ctaText = isLoggedIn ? "Start Pilot" : "Sign Up for Pilot";
                            }
                        }

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
                                        <h3 className="mb-2 text-2xl font-bold text-white">{plan.displayName}</h3>
                                        <p className="text-sm leading-relaxed text-slate-300">{plan.description}</p>
                                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">{plan.outcome}</p>
                                    </div>

                                    <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-4xl font-black text-white">{currencySymbol}{price}</span>
                                            <span className="text-sm font-medium text-slate-400">/month</span>
                                        </div>
                                        <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                            Billed {isAnnual ? "annually" : "monthly"}
                                        </p>
                                        <div className="mt-4 border-t border-white/10 pt-4">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-slate-300">Commercial focus</span>
                                                <span className="font-bold text-white">Pipeline tracking</span>
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
                                Human booking and follow-up support
                            </h3>
                            <p className="mt-3 max-w-xl text-sm leading-7 text-slate-200">
                                When campaigns generate high-intent replies, route qualified leads to trained human callers who close the scheduling gap, capture remarks, and prepare meeting-ready context.
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
                                <li className="flex items-start gap-2"><TrendingUp className="mt-0.5 h-4 w-4 text-cyan-300" />Service companies already generating warm replies every week</li>
                                <li className="flex items-start gap-2"><TrendingUp className="mt-0.5 h-4 w-4 text-cyan-300" />Growth teams where follow-up speed is the bottleneck</li>
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
                        <p className="text-sm text-slate-300">Approval-first workflows and governance controls remain active as managed campaigns scale.</p>
                    </div>
                    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                        <div className="w-fit rounded-xl bg-amber-500/10 p-3 text-amber-300">
                            <Star className="h-5 w-5" />
                        </div>
                        <h4 className="text-lg font-bold text-white">Support when it matters</h4>
                        <p className="text-sm text-slate-300">Get implementation help for playbooks, handoffs, reporting, and launch readiness milestones.</p>
                    </div>
                    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                        <div className="w-fit rounded-xl bg-emerald-500/10 p-3 text-emerald-300">
                            <ArrowRight className="h-5 w-5" />
                        </div>
                        <h4 className="text-lg font-bold text-white">Clear growth path</h4>
                        <p className="text-sm text-slate-300">Start with a pilot package, review qualified lead and meeting-tracking signals, then scale the managed workflow.</p>
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

            <Modal
                open={billingModalOpen}
                onClose={() => setBillingModalOpen(false)}
                title="Confirm Billing Address"
                footer={
                    <>
                        <Button variant="outline" onClick={() => setBillingModalOpen(false)}>Cancel</Button>
                        <Button
                            disabled={billingCountry === "OTHER" && !billingCustomCountry.trim()}
                            onClick={confirmCheckout}
                        >
                            Confirm & Pay
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <p className="text-xs text-slate-400">Used to determine GST treatment on your invoice.</p>
                    <div>
                        <label className="text-xs font-semibold text-white block mb-1">Country</label>
                        <select
                            className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white"
                            value={billingCountry}
                            onChange={(e) => setBillingCountry(e.target.value)}
                        >
                            {BILLING_COUNTRIES.map((c) => (
                                <option key={c.code} value={c.code} className="bg-slate-900">{c.label}</option>
                            ))}
                        </select>
                    </div>
                    {billingCountry === "IN" && (
                        <div>
                            <label className="text-xs font-semibold text-white block mb-1">State</label>
                            <select
                                className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white"
                                value={billingState}
                                onChange={(e) => setBillingState(e.target.value)}
                            >
                                {INDIAN_STATES.map((s) => (
                                    <option key={s} value={s} className="bg-slate-900">{s}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    {billingCountry === "OTHER" && (
                        <div>
                            <label className="text-xs font-semibold text-white block mb-1">Country name</label>
                            <input
                                className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white"
                                value={billingCustomCountry}
                                onChange={(e) => setBillingCustomCountry(e.target.value)}
                                placeholder="Enter your country"
                            />
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
}

