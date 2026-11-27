"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Crown, PhoneCall, Rocket, Shield, Star, TrendingUp, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { displayPrice, type LivePrice } from "./displayPrice";
import { BILLING_COUNTRIES } from "@/lib/billingAddress";
import { getBrowserApiBase } from "@/lib/api/browserBase";
import { PRICING_TIERS, type PricingTier } from "@/lib/pricing";
import { siteSans, siteSerif } from "@/components/marketing/home/fonts";
import { APP_URL } from "../../../config/appUrl.mjs";
import "@/components/marketing/site/site.css";

// Presentation-only fields (copy/visuals). The name/displayName/description/price/
// credits come from PRICING_TIERS so this page, the JSON-LD, and the plan taxonomy
// share one source (F-02).
type PlanPresentation = {
    annualPrice: number;
    features: string[];
    icon: typeof Zap;
    badge: string;
    highlight?: boolean;
    outcome: string;
};

type Plan = PricingTier & { monthlyPrice: number } & PlanPresentation;

const PRESENTATION: Record<PricingTier["name"], PlanPresentation> = {
    Starter: {
        annualPrice: 39,
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
    Growth: {
        annualPrice: 79,
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
    Enterprise: {
        annualPrice: 399,
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
};

const plans: Plan[] = PRICING_TIERS.map((tier) => ({
    ...tier,
    monthlyPrice: tier.usdMonthly,
    ...PRESENTATION[tier.name],
}));

const proofPoints = [
    "Managed growth execution",
    "Human-approved campaign operations",
    "Lead and meeting workflow tracking",
];

const pricingFaqs = [
    {
        q: "What do I get with the Pilot?",
        a: "A 30-day growth pilot package for one ideal customer profile, one geography and one offer, with an approval-first sending flow and follow-up reporting.",
    },
    {
        q: "Which currency are prices shown in?",
        a: "Indian visitors see the live INR price. Other countries see the USD list price. Pick your country above; your billing country at checkout also decides GST treatment on the invoice.",
    },
    {
        q: "Does anything send without a person approving it?",
        a: "Approval-first sending and governance controls are part of the plans, so campaigns are reviewed before they go out.",
    },
    {
        q: "How do I get Enterprise or the booking add-on?",
        a: "Both are quoted individually. Use Talk to Sales and we will scope quotas, playbooks and caller support with you.",
    },
];

// Checkout charges the monthly price whatever the visitor picks here, so the Annual toggle stays hidden until
// annual billing exists on the server. With it hidden, isAnnual can never become true.
const ANNUAL_BILLING_AVAILABLE = false;

export default function PricingPage() {
    const router = useRouter();
    // Defaults to monthly: checkout always charges plan.monthlyPrice regardless of
    // this toggle (annual billing isn't wired up server-side yet), so showing the
    // discounted annual price by default would misrepresent what gets charged.
    const [isAnnual, setIsAnnual] = useState(false);
    const [billingCountry, setBillingCountry] = useState("IN");
    const [billingCustomCountry, setBillingCustomCountry] = useState("");
    const [livePrices, setLivePrices] = useState<Record<string, LivePrice> | null>(null);

    // Refetches whenever the visitor picks a different billing country in the modal,
    // so the displayed price always matches what checkout would actually charge.
    useEffect(() => {
        const resolvedCountry = billingCountry === "OTHER" ? (billingCustomCountry.trim() || "US") : billingCountry;
        const apiBase = getBrowserApiBase();
        const base = apiBase.endsWith("/") ? apiBase.slice(0, -1) : apiBase;

        fetch(`${base}/billing/plans?country=${encodeURIComponent(resolvedCountry)}`)
            .then((res) => { if (!res.ok) throw new Error("Price quote is unavailable"); return res.json(); })
            .then((data) => {
                const byName: Record<string, LivePrice> = {};
                for (const p of data.plans || []) {
                    byName[p.name] = { currency: data.currency, amount: p.amount, available: p.available === true };
                }
                setLivePrices(byName);
            })
            .catch(() => setLivePrices(null));
    }, [billingCountry, billingCustomCountry]);

    const handleCheckout = (plan: Plan["name"]) => {
        if (plan === "Enterprise") {
            router.push("/contact");
            return;
        }

        window.location.assign(`${APP_URL}/signup`);
    };

    const priceFor = (plan: Plan) => displayPrice({
        isAnnual,
        country: billingCountry === "OTHER" ? (billingCustomCountry.trim() || "US") : billingCountry,
        live: livePrices?.[plan.dbName],
        usdMonthly: plan.monthlyPrice,
        annualPrice: plan.annualPrice,
    });

    // Live price only applies to the monthly figure - annual billing isn't wired up
    // server-side yet (see the toggle's comment above). Only trust the live price when
    // the currency is actually available; otherwise displayPrice falls back to the USD
    // list price, except for India where no amount is shown.
    const priceLabel = (plan: Plan) => {
        const { symbol, amount } = priceFor(plan);
        return amount != null ? <>{symbol}{amount}</> : <span title="Price unavailable">&mdash;</span>;
    };

    const ctaFor = (plan: Plan) => {
        if (plan.name === "Enterprise") return "Talk to Sales";
        return plan.name === "Growth" ? "Sign Up for Growth Pilot" : "Sign Up for Pilot";
    };

    // JSON-LD structured data is rendered once, server-side, in layout.tsx (built
    // from the canonical PRICING_TIERS). It used to be duplicated here with a
    // conflicting hardcoded USD list - removed to leave a single source (F-02).

    return (
        <div className={`ph relative min-h-screen overflow-x-hidden bg-[#F3EDE4] text-[#1A1414] ${siteSans.variable} ${siteSerif.variable}`} style={{ fontFamily: "var(--font-home), system-ui, sans-serif" }}>

            <div className="relative z-10 mx-auto max-w-7xl px-6 py-24">
                <div className="mb-20 space-y-6 text-center">
                    <Badge variant="info" className="border-[#1A1414]/10 bg-[#C2A36B]/30 px-4 py-1.5 text-[10px] uppercase tracking-widest">
                        Pricing & Plans
                    </Badge>
                    <h1 className="text-5xl font-medium tracking-tight md:text-6xl">
                        Choose your plan
                    </h1>
                    <p className="mx-auto max-w-2xl text-lg text-[#1A1414]/75">
                        Start with a focused pilot, then scale the buyer-signal-to-meeting workflow with managed campaigns, follow-ups, and governance.
                    </p>
                    <p className="mx-auto max-w-2xl text-sm text-[#1A1414]/60">
                        {plans.map((plan) => `${plan.displayName} $${plan.usdMonthly}/month`).join(", ")} (USD list prices; customers in India are billed in INR).
                    </p>

                    {ANNUAL_BILLING_AVAILABLE ? (
                    <div className="pt-4">
                        <div className="inline-flex items-center gap-4 rounded-full border border-[#1A1414]/10 bg-white px-4 py-2">
                            <span className={`text-sm font-semibold transition-colors ${!isAnnual ? "text-[#1A1414]" : "text-[#1A1414]/60"}`}>Monthly</span>
                            <button
                                onClick={() => setIsAnnual(!isAnnual)}
                                aria-label="Toggle billing cycle"
                                className="group relative h-7 w-14 rounded-full border border-[#1A1414]/10 bg-white p-1 transition-all hover:border-[#1A1414]/30"
                            >
                                <div className={`h-5 w-5 rounded-full bg-[#5C1A2B] shadow transition-all ${isAnnual ? "translate-x-7" : "translate-x-0"}`} />
                            </button>
                            <div className="flex items-center gap-2">
                                <span className={`text-sm font-semibold transition-colors ${isAnnual ? "text-[#1A1414]" : "text-[#1A1414]/60"}`}>Annual</span>
                                <Badge className="border-none bg-[#C2A36B]/30 py-0.5 text-[9px] text-[#5C1A2B]">SAVE 20%</Badge>
                            </div>
                        </div>
                    </div>
                    ) : null}
                </div>

                <div className="mb-10 flex flex-col items-center justify-center gap-3 text-sm text-[#1A1414]/75 sm:flex-row">
                    <label htmlFor="pricing-country" className="font-semibold text-[#1A1414]">Prices shown for</label>
                    <select
                        id="pricing-country"
                        className="rounded-full border border-[#1A1414]/20 bg-white px-4 py-2 text-sm text-[#1A1414]"
                        value={billingCountry}
                        onChange={(e) => setBillingCountry(e.target.value)}
                    >
                        {BILLING_COUNTRIES.map((c) => (
                            <option key={c.code} value={c.code} className="bg-white">{c.label}</option>
                        ))}
                    </select>
                    {billingCountry === "OTHER" && (
                        <input
                            aria-label="Country name"
                            className="rounded-full border border-[#1A1414]/20 bg-white px-4 py-2 text-sm text-[#1A1414]"
                            value={billingCustomCountry}
                            onChange={(e) => setBillingCustomCountry(e.target.value)}
                            placeholder="Enter your country"
                        />
                    )}
                </div>

                <div className="grid grid-cols-1 items-stretch gap-8 md:grid-cols-3">
                    {plans.map((plan) => {
                        const Icon = plan.icon;
                        return (
                            <div key={plan.name} className="relative">
                                {plan.highlight && (
                                    <div className="absolute -top-4 inset-x-0 z-20 flex justify-center">
                                        <Badge variant="info" className="border-none bg-[#5C1A2B] px-4 py-1 text-[#1A1414] shadow">
                                            Recommended
                                        </Badge>
                                    </div>
                                )}

                                <div
                                    className={`flex h-full flex-col rounded-2xl border p-8 transition-all duration-500 ${
                                        plan.highlight
                                            ? "border-[#C2A36B] border-2 bg-white shadow-xl"
                                            : "border-[#1A1414]/10 bg-white hover:border-[#1A1414]/30"
                                    }`}
                                >
                                    <div className="mb-6">
                                        <div className="mb-4 w-fit rounded-2xl bg-white p-3 text-[#5C1A2B]">
                                            <Icon className="h-7 w-7" />
                                        </div>
                                        <h3 className="mb-2 text-2xl font-bold text-[#1A1414]">{plan.displayName}</h3>
                                        <p className="text-sm leading-relaxed text-[#1A1414]/75">{plan.description}</p>
                                    </div>

                                    <div className="mb-6">
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-4xl font-semibold text-[#1A1414]">{priceLabel(plan)}</span>
                                            <span className="text-sm font-medium text-[#1A1414]/60">/month</span>
                                        </div>
                                        <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-[#1A1414]/55">
                                            Billed {isAnnual ? "annually" : "monthly"}
                                        </p>
                                    </div>

                                    <Button
                                        variant={plan.highlight ? "default" : "outline"}
                                        className={`mb-8 w-full py-6 text-base font-bold ${
                                            plan.highlight ? "bg-[#5C1A2B] text-[#F3EDE4] hover:bg-[#46121F] rounded-full" : "border-[#1A1414]/30 bg-transparent text-[#1A1414] hover:bg-[#E8DFD2]"
                                        }`}
                                        onClick={() => handleCheckout(plan.name)}
                                    >
                                        {ctaFor(plan)}
                                    </Button>

                                    <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#5C1A2B]">Key features</p>
                                    <ul className="flex-1 space-y-4">
                                        {plan.features.map((feature) => (
                                            <li key={feature} className="flex items-start gap-3 text-sm text-[#1A1414]/85">
                                                <div className="mt-0.5 shrink-0 text-[#5C1A2B]">
                                                    <Check className="h-4 w-4" />
                                                </div>
                                                {feature}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <section aria-labelledby="compare-plans" className="mt-20">
                    <h2 id="compare-plans" className="mb-8 text-center text-3xl font-semibold text-[#1A1414] md:text-4xl">Compare plans</h2>
                    <div className="overflow-x-auto rounded-2xl border border-[#1A1414]/10 bg-white">
                        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                            <thead>
                                <tr className="border-b border-[#1A1414]/10 bg-[#E8DFD2]">
                                    <th scope="col" className="sticky top-0 w-1/4 p-5 align-bottom text-xs font-semibold uppercase tracking-[0.16em] text-[#1A1414]/60">Plan</th>
                                    {plans.map((plan) => (
                                        <th key={plan.name} scope="col" className="sticky top-0 p-5 align-bottom">
                                            <div className="text-lg font-bold text-[#1A1414]">{plan.displayName}</div>
                                            <div className="mt-1 text-2xl font-semibold text-[#1A1414]">
                                                {priceLabel(plan)}<span className="ml-1 text-sm font-medium text-[#1A1414]/60">/month</span>
                                            </div>
                                            <Button
                                                variant={plan.highlight ? "default" : "outline"}
                                                className={`mt-3 w-full font-bold ${plan.highlight ? "bg-[#5C1A2B] text-[#F3EDE4] hover:bg-[#46121F] rounded-full" : "border-[#1A1414]/30 bg-transparent text-[#1A1414] hover:bg-[#E8DFD2]"}`}
                                                onClick={() => handleCheckout(plan.name)}
                                            >
                                                {plan.name === "Enterprise" ? "Talk to Sales" : "Choose plan"}
                                            </Button>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b border-[#1A1414]/10 align-top">
                                    <th scope="row" className="p-5 font-semibold text-[#1A1414]">Best for</th>
                                    {plans.map((plan) => (
                                        <td key={plan.name} className="p-5 text-[#1A1414]/75">{plan.outcome}</td>
                                    ))}
                                </tr>
                                <tr className="align-top">
                                    <th scope="row" className="p-5 font-semibold text-[#1A1414]">What&apos;s included</th>
                                    {plans.map((plan) => (
                                        <td key={plan.name} className="p-5">
                                            <ul className="space-y-3">
                                                {plan.features.map((feature) => (
                                                    <li key={feature} className="flex items-start gap-2 text-[#1A1414]/85">
                                                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#5C1A2B]" />
                                                        {feature}
                                                    </li>
                                                ))}
                                            </ul>
                                        </td>
                                    ))}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                <div className="mt-16 rounded-2xl border border-[#1A1414]/10 bg-[#E8DFD2] p-8 md:p-10">
                    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr,0.9fr]">
                        <div>
                            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#C2A36B] bg-[#C2A36B]/30 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#5C1A2B]">
                                <PhoneCall className="h-3.5 w-3.5" />
                                Optional add-on
                            </div>
                            <h3 className="text-2xl font-semibold text-[#1A1414] md:text-3xl">
                                Human booking and follow-up support
                            </h3>
                            <p className="mt-3 max-w-xl text-sm leading-7 text-[#1A1414]/85">
                                When campaigns generate high-intent replies, route qualified leads to trained human callers who close the scheduling gap, capture remarks, and prepare meeting-ready context.
                            </p>
                            <div className="mt-6 flex flex-wrap gap-3">
                                <Badge className="border-none bg-[#E8DFD2] text-[#1A1414]">Intent score threshold</Badge>
                                <Badge className="border-none bg-[#E8DFD2] text-[#1A1414]">Consent-aware routing</Badge>
                                <Badge className="border-none bg-[#E8DFD2] text-[#1A1414]">SLA-based follow-up</Badge>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-[#1A1414]/20 bg-white p-6">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5C1A2B]">Best fit</p>
                            <ul className="mt-4 space-y-3 text-sm text-[#1A1414]/85">
                                <li className="flex items-start gap-2"><TrendingUp className="mt-0.5 h-4 w-4 text-[#5C1A2B]" />Service companies already generating warm replies every week</li>
                                <li className="flex items-start gap-2"><TrendingUp className="mt-0.5 h-4 w-4 text-[#5C1A2B]" />Growth teams where follow-up speed is the bottleneck</li>
                                <li className="flex items-start gap-2"><TrendingUp className="mt-0.5 h-4 w-4 text-[#5C1A2B]" />Workflows requiring governance and auditable handoffs</li>
                            </ul>
                            <Button onClick={() => router.push("/contact")} className="mt-6 w-full bg-[#5C1A2B] py-5 font-semibold text-[#F3EDE4] hover:bg-[#46121F]">
                                Talk to sales about add-on pricing
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">

                    <div className="space-y-3 rounded-2xl border border-[#1A1414]/10 bg-white p-5">
                        <div className="w-fit rounded-xl bg-[#C2A36B]/30 p-3 text-[#5C1A2B]">
                            <Shield className="h-5 w-5" />
                        </div>
                        <h4 className="text-lg font-bold text-[#1A1414]">Secure by default</h4>
                        <p className="text-sm text-[#1A1414]/75">Approval-first workflows and governance controls remain active as managed campaigns scale.</p>
                    </div>
                    <div className="space-y-3 rounded-2xl border border-[#1A1414]/10 bg-white p-5">
                        <div className="w-fit rounded-xl bg-amber-500/10 p-3 text-amber-300">
                            <Star className="h-5 w-5" />
                        </div>
                        <h4 className="text-lg font-bold text-[#1A1414]">Support when it matters</h4>
                        <p className="text-sm text-[#1A1414]/75">Get implementation help for playbooks, handoffs, reporting, and launch readiness milestones.</p>
                    </div>
                    <div className="space-y-3 rounded-2xl border border-[#1A1414]/10 bg-white p-5">
                        <div className="w-fit rounded-xl bg-[#C2A36B]/30 p-3 text-[#5C1A2B]">
                            <ArrowRight className="h-5 w-5" />
                        </div>
                        <h4 className="text-lg font-bold text-[#1A1414]">Clear growth path</h4>
                        <p className="text-sm text-[#1A1414]/75">Start with a pilot package, review qualified lead and meeting-tracking signals, then scale the managed workflow.</p>
                    </div>
                </div>

                <section aria-labelledby="pricing-faq" className="mx-auto mt-20 max-w-3xl">
                    <h2 id="pricing-faq" className="mb-8 text-center text-3xl font-semibold text-[#1A1414] md:text-4xl">Pricing questions</h2>
                    <div className="divide-y divide-white/10 rounded-2xl border border-[#1A1414]/10 bg-white">
                        {pricingFaqs.map((item) => (
                            <details key={item.q} className="group p-6">
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-[#1A1414]">
                                    {item.q}
                                    <span className="text-[#5C1A2B] transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                                </summary>
                                <p className="mt-3 text-sm leading-7 text-[#1A1414]/75">{item.a}</p>
                            </details>
                        ))}
                    </div>
                </section>

                <section className="mt-20 rounded-2xl border border-[#1A1414]/10 bg-[#E8DFD2] p-10 text-center">
                    <h2 className="text-3xl font-semibold text-[#1A1414] md:text-4xl">Ready to start your pilot?</h2>
                    <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[#1A1414]/85">
                        Create an account and set up your first governed campaign, or talk to us about a larger rollout.
                    </p>
                    <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                        <Button onClick={() => window.location.assign(`${APP_URL}/signup`)} className="bg-[#5C1A2B] px-8 py-5 font-semibold text-[#F3EDE4] hover:bg-[#46121F]">
                            Get started
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                        <Button variant="outline" onClick={() => router.push("/contact")} className="border-[#1A1414]/30 bg-transparent px-8 py-5 font-semibold text-[#1A1414] hover:bg-[#E8DFD2]">
                            Talk to sales
                        </Button>
                    </div>
                </section>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-xs text-[#1A1414]/60">
                    {proofPoints.map((point) => (
                        <span key={point} className="inline-flex items-center gap-1 rounded-full border border-[#1A1414]/10 bg-white px-3 py-1.5">
                            <Check className="h-3.5 w-3.5 text-[#5C1A2B]" />
                            {point}
                        </span>
                    ))}
                </div>
            </div>

        </div>
    );
}
