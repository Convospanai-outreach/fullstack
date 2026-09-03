"use client";

import { useState, useEffect } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useSession } from "next-auth/react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";
import { BILLING_COUNTRIES, INDIAN_STATES } from "@/lib/billingAddress";
import { getBrowserApiBase } from "@/lib/api/browserBase";

// planId slugs match PLAN_ALIASES in apps/api/routes/billing/checkout/route.ts.
const PLAN_SLUGS: { slug: string; label: string; features: string[]; popular?: boolean }[] = [
    { slug: "pro", label: "Pro", features: ["Advanced Analytics", "Unlimited Campaigns", "Priority Support"], popular: true },
    { slug: "enterprise", label: "Enterprise", features: ["Unlimited AI Credits", "Custom Integrations", "Dedicated Manager", "SLA"] },
];

const CURRENCY_SYMBOL: Record<string, string> = { USD: "$", EUR: "€", INR: "₹" };

type LivePlan = { id: string; name: string; currency: string; amount: number | null; creditsPerMonth: number };

export default function BillingPage() {
    const { data: session } = useSession();
    const [loading, setLoading] = useState<string | null>(null);
    const [balance, setBalance] = useState<number | null>(null);
    const [balanceLoading, setBalanceLoading] = useState(true);
    const [livePlans, setLivePlans] = useState<Record<string, LivePlan>>({});
    const [addressModalOpen, setAddressModalOpen] = useState(false);
    const [pendingSlug, setPendingSlug] = useState<string | null>(null);
    const [billingCountry, setBillingCountry] = useState("US");
    const [billingCustomCountry, setBillingCustomCountry] = useState("");
    const [billingState, setBillingState] = useState("Delhi");

    useEffect(() => {
        const fetchBalance = async () => {
            try {
                const res = await fetch(getBrowserApiBase() + "/billing/usage");
                if (!res.ok) throw new Error("Failed");
                const data = await res.json();
                setBalance(data.balance);
            } catch {
                // Leave balance null — display will show fallback
            } finally {
                setBalanceLoading(false);
            }
        };
        fetchBalance();
    }, []);

    useEffect(() => {
        const resolvedCountry = billingCountry === "OTHER" ? (billingCustomCountry.trim() || "US") : billingCountry;
        fetch(getBrowserApiBase() + `/billing/plans?country=${encodeURIComponent(resolvedCountry)}`)
            .then((res) => res.json())
            .then((data) => {
                const byName: Record<string, LivePlan> = {};
                for (const p of data.plans || []) byName[p.name] = { ...p, currency: data.currency };
                setLivePlans(byName);
            })
            .catch(() => setLivePlans({}));
    }, [billingCountry, billingCustomCountry]);

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

    const handleUpgrade = (slug: string) => {
        setPendingSlug(slug);
        setAddressModalOpen(true);
    };

    const confirmUpgrade = async () => {
        const slug = pendingSlug;
        if (!slug) return;
        setAddressModalOpen(false);
        setLoading(slug);

        const resolvedCountry = billingCountry === "OTHER" ? billingCustomCountry.trim() : billingCountry;

        try {
            // 1. Create Order / Checkout Session
            const res = await fetch(getBrowserApiBase() + "/billing/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    planId: slug,
                    country: resolvedCountry,
                    state: resolvedCountry === "IN" ? billingState : undefined,
                }),
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.message || "Failed to create order");

            if (data.gateway === "STRIPE") {
                window.location.href = data.url;
                return;
            }

            // 2. Open Razorpay
            const isLoaded = await loadRazorpayScript();
            if (!isLoaded) {
                alert("Failed to load payment gateway");
                return;
            }

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

            const res = await fetch(getBrowserApiBase() + "/billing/topup", {
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
                            <div className="text-3xl font-bold text-white">
                                {balanceLoading ? "..." : balance !== null ? balance.toLocaleString() : "---"}
                            </div>
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
                        <div className="glass p-8 rounded-2xl border border-white/10 relative flex flex-col">
                            <h3 className="text-xl font-bold text-white mb-2">Free</h3>
                            <div className="text-4xl font-bold text-white mb-6">
                                $0<span className="text-lg text-gray-400 font-normal">/mo</span>
                            </div>
                            <ul className="space-y-4 mb-8 flex-1">
                                {["100 AI Credits/mo", "Basic Analytics", "1 Campaign"].map((feature) => (
                                    <li key={feature} className="flex items-center text-gray-300">
                                        <svg className="w-5 h-5 text-green-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                            <button disabled className="w-full py-3 rounded-xl font-bold bg-white/10 text-gray-400 cursor-default">
                                Current Plan
                            </button>
                        </div>

                        {PLAN_SLUGS.map((plan) => {
                            const live = livePlans[plan.slug === "pro" ? "PRO" : "ENTERPRISE"];
                            const price = live?.amount != null ? Math.round(live.amount / 100) : null;
                            const symbol = live ? (CURRENCY_SYMBOL[live.currency] || live.currency + " ") : "$";
                            return (
                                <div
                                    key={plan.slug}
                                    className={`glass p-8 rounded-2xl border ${plan.popular ? 'border-blue-500 shadow-blue-500/20 shadow-lg' : 'border-white/10'} relative flex flex-col`}
                                >
                                    {plan.popular && (
                                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                                            Most Popular
                                        </div>
                                    )}

                                    <h3 className="text-xl font-bold text-white mb-2">{plan.label}</h3>
                                    <div className="text-4xl font-bold text-white mb-6">
                                        {price != null ? `${symbol}${price}` : "—"}<span className="text-lg text-gray-400 font-normal">/mo</span>
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
                                        onClick={() => handleUpgrade(plan.slug)}
                                        disabled={!!loading}
                                        className="w-full py-3 rounded-xl font-bold transition-all bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 text-white disabled:opacity-50"
                                    >
                                        {loading === plan.slug ? "Processing..." : "Upgrade Now"}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <Modal
                open={addressModalOpen}
                onClose={() => setAddressModalOpen(false)}
                title="Confirm Billing Address"
                footer={
                    <>
                        <Button variant="outline" onClick={() => setAddressModalOpen(false)}>Cancel</Button>
                        <Button
                            disabled={billingCountry === "OTHER" && !billingCustomCountry.trim()}
                            onClick={confirmUpgrade}
                        >
                            Confirm & Pay
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <p className="text-xs text-gray-400">Used to determine tax treatment and currency on your invoice.</p>
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
