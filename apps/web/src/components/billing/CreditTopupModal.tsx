"use client";

import { useState } from 'react';
import { toast } from 'sonner';
import { ActionButton } from '../auth/ActionButton';
import { Coins } from 'lucide-react';
import { getBrowserApiBase } from "@/lib/api/browserBase";

const TOPUP_PACKS = [
    { tierId: "starter", credits: 500, price: 500, popular: false },
    { tierId: "pro", credits: 2000, price: 1800, popular: true },
    { tierId: "power", credits: 10000, price: 8000, popular: false }
];

export default function CreditTopupModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

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

    const handlePurchase = async (pack: typeof TOPUP_PACKS[0]) => {
        try {
            setLoading(true);
            const isLoaded = await loadRazorpayScript();
            if (!isLoaded) throw new Error("Failed to load payment gateway");

            const res = await fetch(getBrowserApiBase() + "/billing/topup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tierId: pack.tierId })
            });

            if (!res.ok) throw new Error("Purchase failed");

            const data = await res.json();
            const options = {
                key: data.key,
                amount: data.amount,
                currency: data.currency,
                name: "CraftMyFunnel",
                description: `Top-up: ${pack.credits} Credits`,
                order_id: data.id,
                handler: function (_response: any) {
                    toast.success("Payment successful! Credits will be added shortly.");
                    onClose();
                },
                theme: { color: "#5C1A2B" }
            };

            const rzp = new (window as any).Razorpay(options);
            rzp.open();
        } catch (error) {
            toast.error("Failed to initiate purchase");
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/60 backdrop-blur-sm animate-in fade-in">
            <div className="glass w-full max-w-2xl p-6 rounded-2xl relative border border-primary/20 shadow-2xl shadow-primary/40">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
                >
                    ✕
                </button>

                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/20 mb-4">
                        <Coins className="w-6 h-6 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">Top Up Credits</h2>
                    <p className="text-muted-foreground">Enrich more leads and run more agents.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {TOPUP_PACKS.map((pack) => (
                        <div
                            key={pack.credits}
                            className={`
                                relative p-4 rounded-xl border transition-all cursor-pointer hover:scale-[1.02]
                                ${pack.popular
                                    ? 'bg-primary/10 border-primary/50 shadow-lg shadow-primary/20'
                                    : 'bg-foreground/5 border-foreground/10 hover:border-foreground/20'
                                }
                            `}
                        >
                            {pack.popular && (
                                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                    Best Value
                                </span>
                            )}
                            <div className="text-center space-y-2">
                                <h3 className="text-xl font-bold text-foreground">{pack.credits}</h3>
                                <p className="text-xs text-muted-foreground uppercase tracking-wide">Credits</p>
                                <div className="text-2xl font-bold text-primary">â‚¹{pack.price}</div>
                                <ActionButton
                                    variant={pack.popular ? "primary" : "outline"}
                                    fullWidth
                                    className="mt-2 text-sm py-2"
                                    onClick={() => handlePurchase(pack)}
                                    disabled={loading}
                                >
                                    {loading ? "..." : "Buy Now"}
                                </ActionButton>
                            </div>
                        </div>
                    ))}
                </div>

                <p className="text-center text-xs text-muted-foreground mt-6">
                    Secured by Razorpay. Credits never expire.
                </p>
            </div>
        </div>
    );
}
