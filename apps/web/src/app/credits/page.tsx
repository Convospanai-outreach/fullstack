"use client";

import { useEffect, useState } from 'react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { Modal } from '@/components/ui/Modal';
import { Coins, ArrowUpRight, History, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { BILLING_COUNTRIES, INDIAN_STATES } from '@/lib/billingAddress';
import { getBrowserApiBase } from "@/lib/api/browserBase";

const BUNDLES = [
    { id: "starter", label: "Starter Pack", credits: 500, price: 500, desc: "Perfect for testing" },
    { id: "pro", label: "Growth Pack", credits: 2000, price: 1800, desc: "Best value for small teams", popular: true },
    { id: "power", label: "Power Pack", credits: 10000, price: 8000, desc: "For high-volume outreach" },
];

export default function CreditsPage() {
    const [balance, setBalance] = useState<number | null>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState<string | null>(null);
    const [billingModalOpen, setBillingModalOpen] = useState(false);
    const [pendingBundle, setPendingBundle] = useState<typeof BUNDLES[0] | null>(null);
    const [billingCountry, setBillingCountry] = useState("IN");
    const [billingCustomCountry, setBillingCustomCountry] = useState("");
    const [billingState, setBillingState] = useState("Delhi");

    useEffect(() => {
        loadData();
        // Load Razorpay script
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        document.body.appendChild(script);
        return () => { document.body.removeChild(script); };
    }, []);

    const loadData = async () => {
        try {
            const res = await fetch(getBrowserApiBase() + "/billing/usage");
            if (!res.ok) throw new Error("Failed to load data");
            const data = await res.json();
            setBalance(data.balance);
            setHistory(data.history);
        } catch (e) {
            console.error(e);
            toast.error("Failed to load usage data");
        } finally {
            setLoading(false);
        }
    };

    const openTopUpModal = (bundle: typeof BUNDLES[0]) => {
        setPendingBundle(bundle);
        setBillingModalOpen(true);
    };

    const handleTopUp = async (bundle: typeof BUNDLES[0], country: string, state: string) => {
        setPurchasing(bundle.id);
        try {
            const res = await fetch(getBrowserApiBase() + "/billing/topup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tierId: bundle.id, country, state: country === "IN" ? state : undefined })
            });

            const order = await res.json();
            if (!res.ok) throw new Error(order.error || "Order failed");

            const options = {
                key: order.key,
                amount: order.amount,
                currency: order.currency,
                name: "CraftMyFunnel",
                description: `Top-up: ${bundle.credits.toLocaleString()} Credits`,
                order_id: order.id,
                handler: function (_response: any) {
                    toast.success("Payment successful! Credits will be added shortly.");
                    // In a perfect world, we'd poll or wait for webhook, but let's refresh after 3s
                    setTimeout(loadData, 3000);
                },
                prefill: {
                    name: "", // Will be filled by Razorpay if user is logged in
                    email: "",
                },
                theme: {
                    color: "#5C1A2B",
                },
            };

            const rzp = new (window as any).Razorpay(options);
            rzp.open();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setPurchasing(null);
        }
    };

    return (
        <div className="space-y-8 max-w-6xl mr-auto">
            <SectionHeader
                title="Credits & Usage"
                subtitle="Manage your execution credits and view transaction history."
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Balance Card */}
                <GlassCard className="lg:col-span-1 p-8 flex flex-col justify-between border-primary/20 bg-primary/5 relative overflow-hidden">
                    <div className="absolute top-[-20px] right-[-20px] w-40 h-40 bg-primary/10 rounded-full blur-3xl"></div>
                    <div>
                        <div className="p-3 bg-primary/20 rounded-xl w-fit mb-6 text-primary">
                            <Coins className="w-8 h-8" />
                        </div>
                        <h3 className="text-muted-foreground font-medium mb-1">Available Credits</h3>
                        <div className="text-5xl font-bold text-foreground tracking-tight">
                            {loading ? "..." : balance?.toLocaleString()}
                        </div>
                        <p className="text-sm text-muted-foreground mt-4 flex items-center gap-2">
                            <Zap className="w-4 h-4 text-warning" /> Auto-renews next billing cycle
                        </p>
                    </div>
                </GlassCard>

                {/* Bundle Options */}
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Top-up Bundles</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {BUNDLES.map(bundle => (
                            <GlassCard
                                key={bundle.id}
                                className={`p-6 border-foreground/5 transition-all hover:border-primary/50 group ${bundle.popular ? 'bg-foreground/5 border-primary/30' : ''}`}
                            >
                                <h4 className="font-bold text-foreground mb-1">{bundle.label}</h4>
                                <div className="text-2xl font-bold text-primary mb-2">
                                    {bundle.credits.toLocaleString()} <span className="text-xs text-muted-foreground">Credits</span>
                                </div>
                                <p className="text-xs text-muted-foreground mb-6 h-8">{bundle.desc}</p>
                                <button
                                    disabled={purchasing !== null}
                                    onClick={() => openTopUpModal(bundle)}
                                    className={`w-full py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${bundle.popular
                                        ? 'bg-primary hover:bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                                        : 'bg-foreground/10 hover:bg-foreground/20 text-primary-foreground'
                                        }`}
                                >
                                    {purchasing === bundle.id ? "Processing..." : `Buy for ₹${bundle.price}`}
                                    <ArrowUpRight className="w-4 h-4" />
                                </button>
                            </GlassCard>
                        ))}
                    </div>
                </div>
            </div>

            {/* History Table */}
            <GlassCard className="p-8">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 bg-primary/20 rounded-lg text-primary">
                        <History className="w-5 h-5" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground">Transaction History</h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-foreground/10 text-xs text-muted-foreground uppercase tracking-wider">
                                <th className="pb-4 font-medium">Date</th>
                                <th className="pb-4 font-medium">Description</th>
                                <th className="pb-4 font-medium">Type</th>
                                <th className="pb-4 font-medium text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-foreground/5">
                            {history.map(tx => (
                                <tr key={tx.id} className="text-sm group hover:bg-foreground/5 transition-colors">
                                    <td className="py-4 text-muted-foreground">
                                        {formatDistanceToNow(new Date(tx.createdAt), { addSuffix: true })}
                                    </td>
                                    <td className="py-4 font-medium text-foreground">{tx.description}</td>
                                    <td className="py-4">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${tx.type === 'topup' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'
                                            }`}>
                                            {tx.type}
                                        </span>
                                    </td>
                                    <td className={`py-4 text-right font-bold ${tx.amount > 0 ? 'text-success' : 'text-primary'}`}>
                                        {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                                    </td>
                                </tr>
                            ))}
                            {history.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={4} className="py-8 text-center text-muted-foreground italic">
                                        No transactions yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </GlassCard>

            <Modal
                open={billingModalOpen}
                onClose={() => setBillingModalOpen(false)}
                title="Confirm Billing Address"
                footer={
                    <>
                        <button
                            className="px-4 py-2 rounded-lg text-sm font-medium text-foreground/80 hover:bg-foreground/10"
                            onClick={() => setBillingModalOpen(false)}
                        >
                            Cancel
                        </button>
                        <button
                            disabled={purchasing !== null || (billingCountry === "OTHER" && !billingCustomCountry.trim())}
                            className="px-4 py-2 rounded-lg text-sm font-bold bg-primary hover:bg-primary text-primary-foreground disabled:opacity-50"
                            onClick={() => {
                                setBillingModalOpen(false);
                                if (pendingBundle) {
                                    const resolvedCountry = billingCountry === "OTHER" ? billingCustomCountry.trim() : billingCountry;
                                    handleTopUp(pendingBundle, resolvedCountry, billingState);
                                }
                            }}
                        >
                            Confirm & Pay
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    <p className="text-xs text-muted-foreground">Used to determine GST treatment on your invoice.</p>
                    <div>
                        <label className="text-xs font-semibold text-foreground block mb-1">Country</label>
                        <select
                            className="w-full bg-foreground/5 border border-foreground/10 rounded-lg p-2 text-sm text-foreground"
                            value={billingCountry}
                            onChange={(e) => setBillingCountry(e.target.value)}
                        >
                            {BILLING_COUNTRIES.map((c) => (
                                <option key={c.code} value={c.code} className="bg-background">{c.label}</option>
                            ))}
                        </select>
                    </div>
                    {billingCountry === "IN" && (
                        <div>
                            <label className="text-xs font-semibold text-foreground block mb-1">State</label>
                            <select
                                className="w-full bg-foreground/5 border border-foreground/10 rounded-lg p-2 text-sm text-foreground"
                                value={billingState}
                                onChange={(e) => setBillingState(e.target.value)}
                            >
                                {INDIAN_STATES.map((s) => (
                                    <option key={s} value={s} className="bg-background">{s}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    {billingCountry === "OTHER" && (
                        <div>
                            <label className="text-xs font-semibold text-foreground block mb-1">Country name</label>
                            <input
                                className="w-full bg-foreground/5 border border-foreground/10 rounded-lg p-2 text-sm text-foreground"
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
