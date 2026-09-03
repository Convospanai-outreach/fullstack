"use client";
import useSWR from "swr";
import { toast } from "sonner";
import { useEffect } from "react";
import { getBrowserApiBase } from "@/lib/api/browserBase";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function BillingSettings() {
    const { data: team, mutate } = useSWR(getBrowserApiBase() + "/team?include=subscription,transactions", fetcher);

    useEffect(() => {
        // Load Razorpay Script
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        document.body.appendChild(script);
        return () => {
            document.body.removeChild(script);
        }
    }, []);

    const handlePortal = () => {
        toast.info("Manage subscription via Razorpay Dashboard or contact support.");
    };

    const handleTopUp = async (tierId: string, credits: number) => {
        try {
            // 1. Create Order
            const res = await fetch(getBrowserApiBase() + "/billing/topup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tierId }),
            });
            const order = await res.json();

            if (!order.id) {
                toast.error("Failed to create order");
                return;
            }

            // 2. Open Razorpay
            const options = {
                key: order.key,
                amount: order.amount,
                currency: order.currency,
                name: "CraftMyFunnel",
                description: `${credits} Credits Top-up`,
                order_id: order.id,
                handler: async function (_response: any) {
                    toast.success("Payment Successful! Updating balance...");
                    // Webhook handles the actual credit addition, but we trigger a refresh
                    try {
                        // Optional: Call verify API if we implemented client-side verification
                        // await verifyPayment(response); 
                    } catch (err) { }

                    // Revalidate team data
                    mutate(getBrowserApiBase() + "/team?include=subscription,transactions");
                },
                prefill: {
                    name: "User Name", // Ideally retrieve from user session if available here
                    email: "user@example.com",
                    contact: "9999999999"
                },
                theme: {
                    color: "#9333ea"
                }
            };

            const rzp1 = new (window as any).Razorpay(options);
            rzp1.open();

        } catch (e) {
            console.error(e);
            toast.error("Error connecting to payment gateway");
        }
    };

    if (!team) return <div className="text-muted-foreground">Loading...</div>;

    const sub = team.subscription;
    const isPro = sub && sub.status === "active";

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold text-foreground">Plan & Billing</h3>

            <div className="glass p-6 rounded-xl border border-border flex justify-between items-center">
                <div>
                    <div className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Current Plan</div>
                    <div className="text-3xl font-bold text-foreground mb-2">{isPro ? "Pro Plan" : "Free Plan"}</div>
                    <div className="text-sm text-muted-foreground">
                        {isPro
                            ? `Renews on ${new Date(sub.currentPeriodEnd).toLocaleDateString()}`
                            : "Upgrade to unlock more agents and credits."}
                    </div>
                </div>

                {isPro ? (
                    <button
                        onClick={handlePortal}
                        className="px-6 py-2 bg-muted hover:bg-accent text-foreground rounded-lg transition"
                    >
                        Manage Subscription
                    </button>
                ) : (
                    <a
                        href="/pricing"
                        className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:opacity-90 transition shadow-lg shadow-purple-900/20"
                    >
                        Upgrade Now
                    </a>
                )}
            </div>

            <div className="glass p-6 rounded-xl border border-border">
                <h4 className="text-lg font-semibold text-foreground mb-4">Usage & Credits</h4>
                <div className="flex gap-4">
                    <div className="p-4 bg-muted rounded-lg flex-1">
                        <div className="text-2xl font-mono text-purple-400">{team.credits || 0}</div>
                        <div className="text-xs text-muted-foreground">Available Credits</div>
                    </div>
                    <div className="p-4 bg-muted rounded-lg flex-1">
                        <div className="text-2xl font-mono text-blue-400">{team.members?.length || 1}</div>
                        <div className="text-xs text-muted-foreground">Team Members</div>
                    </div>
                </div>
            </div>

            {/* Top Up Section */}
            <div className="glass p-6 rounded-xl border border-border">
                <h4 className="text-lg font-semibold text-foreground mb-4">Add Credits</h4>
                                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={() => handleTopUp("starter", 500)}
                        className="p-4 bg-muted hover:bg-accent border border-border rounded-lg text-left transition"
                    >
                        <div className="text-purple-400 font-bold text-xl">500 Credits</div>
                        <div className="text-foreground">INR 500</div>
                    </button>
                    <button
                        onClick={() => handleTopUp("pro", 2000)}
                        className="p-4 bg-muted hover:bg-accent border border-border rounded-lg text-left transition"
                    >
                        <div className="text-purple-400 font-bold text-xl">2,000 Credits</div>
                        <div className="text-foreground">INR 1800 (Save 10%)</div>
                    </button>
                </div>
            </div>

            {/* Transaction History */}
            <div className="glass p-6 rounded-xl border border-border">
                <h4 className="text-lg font-semibold text-foreground mb-4">Transaction History</h4>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-muted-foreground">
                        <thead className="text-xs uppercase bg-muted text-muted-foreground">
                            <tr>
                                <th className="px-4 py-3 rounded-l-lg">Date</th>
                                <th className="px-4 py-3">Description</th>
                                <th className="px-4 py-3 text-right rounded-r-lg">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {team.transactions?.map((tx: any) => (
                                <tr key={tx.id} className="border-b border-border hover:bg-muted">
                                    <td className="px-4 py-3">{new Date(tx.createdAt).toLocaleDateString()}</td>
                                    <td className="px-4 py-3">{tx.description}</td>
                                    <td className={`px-4 py-3 text-right font-mono ${tx.amount > 0 ? "text-green-400" : "text-muted-foreground"}`}>
                                        {tx.amount > 0 ? "+" : ""}{tx.amount}
                                    </td>
                                </tr>
                            ))}
                            {!team.transactions?.length && (
                                <tr>
                                    <td colSpan={3} className="px-4 py-8 text-center italic text-muted-foreground">No transactions yet.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

