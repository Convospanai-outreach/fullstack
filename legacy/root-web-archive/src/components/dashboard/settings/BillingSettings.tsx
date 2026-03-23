"use client";
import useSWR from "swr";
import { toast } from "sonner";
import { useEffect } from "react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function BillingSettings() {
    const { data: team, mutate } = useSWR(process.env['NEXT_PUBLIC_API_URL'] + "/team?include=subscription,transactions", fetcher);

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

    const handleTopUp = async (credits: number, priceINR: number) => {
        try {
            // 1. Create Order
            const res = await fetch(process.env['NEXT_PUBLIC_API_URL'] + "/billing/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount: priceINR, currency: "INR" }), // Amount in rupees, API converts to paise
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
                name: "ConvoSpan",
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
                    mutate(process.env['NEXT_PUBLIC_API_URL'] + "/team?include=subscription,transactions");
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

    if (!team) return <div className="text-gray-400">Loading...</div>;

    const sub = team.subscription;
    const isPro = sub && sub.status === "active";

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold text-white">Plan & Billing</h3>

            <div className="glass p-6 rounded-xl border border-white/10 flex justify-between items-center">
                <div>
                    <div className="text-sm text-gray-400 uppercase tracking-wider mb-1">Current Plan</div>
                    <div className="text-3xl font-bold text-white mb-2">{isPro ? "Pro Plan" : "Free Plan"}</div>
                    <div className="text-sm text-gray-400">
                        {isPro
                            ? `Renews on ${new Date(sub.currentPeriodEnd).toLocaleDateString()}`
                            : "Upgrade to unlock more agents and credits."}
                    </div>
                </div>

                {isPro ? (
                    <button
                        onClick={handlePortal}
                        className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition"
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

            <div className="glass p-6 rounded-xl border border-white/10">
                <h4 className="text-lg font-semibold text-white mb-4">Usage & Credits</h4>
                <div className="flex gap-4">
                    <div className="p-4 bg-white/5 rounded-lg flex-1">
                        <div className="text-2xl font-mono text-purple-400">{team.credits || 0}</div>
                        <div className="text-xs text-gray-400">Available Credits</div>
                    </div>
                    <div className="p-4 bg-white/5 rounded-lg flex-1">
                        <div className="text-2xl font-mono text-blue-400">{team.members?.length || 1}</div>
                        <div className="text-xs text-gray-400">Team Members</div>
                    </div>
                </div>
            </div>

            {/* Top Up Section */}
            <div className="glass p-6 rounded-xl border border-white/10">
                <h4 className="text-lg font-semibold text-white mb-4">Add Credits</h4>
                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={() => handleTopUp(1000, 100)} // 100 INR
                        className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left transition"
                    >
                        <div className="text-purple-400 font-bold text-xl">1,000 Credits</div>
                        <div className="text-white">₹100</div>
                    </button>
                    <button
                        onClick={() => handleTopUp(5000, 400)} // 400 INR
                        className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left transition"
                    >
                        <div className="text-purple-400 font-bold text-xl">5,000 Credits</div>
                        <div className="text-white">₹400 (Save 20%)</div>
                    </button>
                </div>
            </div>

            {/* Transaction History */}
            <div className="glass p-6 rounded-xl border border-white/10">
                <h4 className="text-lg font-semibold text-white mb-4">Transaction History</h4>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-400">
                        <thead className="text-xs uppercase bg-white/5 text-gray-300">
                            <tr>
                                <th className="px-4 py-3 rounded-l-lg">Date</th>
                                <th className="px-4 py-3">Description</th>
                                <th className="px-4 py-3 text-right rounded-r-lg">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {team.transactions?.map((tx: any) => (
                                <tr key={tx.id} className="border-b border-white/5 hover:bg-white/5">
                                    <td className="px-4 py-3">{new Date(tx.createdAt).toLocaleDateString()}</td>
                                    <td className="px-4 py-3">{tx.description}</td>
                                    <td className={`px-4 py-3 text-right font-mono ${tx.amount > 0 ? "text-green-400" : "text-gray-400"}`}>
                                        {tx.amount > 0 ? "+" : ""}{tx.amount}
                                    </td>
                                </tr>
                            ))}
                            {!team.transactions?.length && (
                                <tr>
                                    <td colSpan={3} className="px-4 py-8 text-center italic text-gray-500">No transactions yet.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
