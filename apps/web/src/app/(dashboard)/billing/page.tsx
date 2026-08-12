"use client";

import { useState } from "react";
import {
    CreditCard,
    Coins,
    Zap,
    History,
    ArrowUpCircle,
    ChevronRight,
    PlusCircle,
    Crown
} from "lucide-react";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UsageLimitMeter } from "@/components/enterprise/UsageLimitMeter";
import { Skeleton } from "@/components/ui/Skeleton";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

import { getBrowserApiUrl } from "@/lib/api/browserBase";

export default function BillingPage() {
    const { data: rawSubscription, isLoading, error } = useSWR(getBrowserApiUrl("/billing/subscription"), fetcher, {
        revalidateOnFocus: false,
    });
    const { data: usage } = useSWR(getBrowserApiUrl("/billing/usage"), fetcher);
    const [topUpLoading, setTopUpLoading] = useState(false);

    const subscription = rawSubscription || {
        active: true,
        plan: "FREE",
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const handleTopUp = async (tierId: string) => {
        setTopUpLoading(true);
        try {
            // Create Razorpay order
            const response = await fetch(getBrowserApiUrl('/billing/topup'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tierId })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create order');
            }

            const razorpayKey = process.env['NEXT_PUBLIC_RAZORPAY_KEY_ID'];

            if (!razorpayKey) {
                throw new Error("NEXT_PUBLIC_RAZORPAY_KEY_ID is not configured");
            }

            // Open Razorpay checkout
            const options = {
                key: razorpayKey,
                amount: data.amount,
                currency: data.currency,
                name: 'CraftMyFunnel',
                description: 'Credit Top-up',
                order_id: data.id,
                handler: function (_response: any) {
                    // Payment successful
                    window.location.reload(); // Refresh to show updated credits
                },
                prefill: {
                    email: subscription?.email || ''
                },
                theme: {
                    color: '#3b82f6'
                }
            };

            const rzp = new window.Razorpay(options);
            rzp.open();
        } catch (error: any) {
            console.error('Top-up failed:', error);
            alert(error.message || 'Failed to process top-up');
        } finally {
            setTopUpLoading(false);
        }
    };

    return (
        <div className="space-y-8 animate-reveal">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white tracking-tight">Billing & Credits</h1>
                <p className="text-text-secondary mt-1">Manage your enterprise plan, credit balance, and transaction history.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Current Plan Overview */}
                <div className="lg:col-span-1 space-y-6">
                    <Card className="border-accent-blue/20 bg-accent-blue/[0.02]">
                        <CardHeader>
                            <CardTitle>Subscription Tier</CardTitle>
                            <CardDescription>Your current active workspace plan</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <Skeleton className="h-48 w-full" />
                            ) : error ? (
                                <div className="text-red-400 p-4">Failed to load subscription</div>
                            ) : (
                                <div className="mt-4 p-6 rounded-2xl bg-white/[0.03] border border-white/5 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-3">
                                        <Badge variant={subscription?.active ? "success" : "default"}>
                                            {subscription?.active ? "Active" : "Inactive"}
                                        </Badge>
                                    </div>

                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="p-3 bg-accent-blue/10 rounded-xl text-accent-blue">
                                            <Zap className="w-8 h-8" />
                                        </div>
                                        <div>
                                            <h4 className="text-2xl font-black text-white capitalize">
                                                {subscription?.plan || "Free"}
                                            </h4>
                                            <p className="text-text-muted text-xs font-bold uppercase tracking-widest">
                                                {subscription?.plan === "ENTERPRISE" ? "Enterprise Access" : "Standard Access"}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-text-secondary">Renews on</span>
                                            <span className="text-white font-mono">
                                                {subscription?.currentPeriodEnd
                                                    ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                                                    : 'N/A'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-text-secondary">Monthly Credits</span>
                                            <span className="text-white font-mono">
                                                {subscription?.credits || 0}
                                            </span>
                                        </div>
                                    </div>

                                    <Button variant="outline" className="w-full mt-8 border-white/10">
                                        Manage Subscription
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Quick Actions</CardTitle>
                            <CardDescription>One-click workspace operations</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 mt-4">
                                <button className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-white/5 transition group text-left border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <History className="w-5 h-5 text-text-muted group-hover:text-accent-blue" />
                                        <span className="text-sm font-semibold text-white">Download Last Invoice</span>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-text-muted" />
                                </button>
                                <button className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-white/5 transition group text-left border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <CreditCard className="w-5 h-5 text-text-muted group-hover:text-accent-blue" />
                                        <span className="text-sm font-semibold text-white">Update Payment Method</span>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-text-muted" />
                                </button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Credit & Usage Section */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Resource Allocation</CardTitle>
                            <CardDescription>Real-time credit and token consumption</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                                <div className="space-y-6">
                                    <UsageLimitMeter
                                        label="Monthly Campaign Credits"
                                        used={Math.max(0, (usage?.history || []).reduce((acc: number, tx: any) => acc + (tx.amount < 0 ? Math.abs(tx.amount) : 0), 0))}
                                        total={subscription?.credits || 0}
                                    />
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[10px] font-bold text-text-muted uppercase">
                                            <span>Current Balance</span>
                                            <span className="text-accent-mint">{usage?.balance ?? 0} remaining</span>
                                        </div>
                                        <p className="text-xs text-text-secondary leading-relaxed">
                                            Credits refresh automatically on your billing anniversary. Unused base credits do not roll over.
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-white/5 p-6 rounded-2xl border border-white/5 flex flex-col justify-between">
                                    <div className="flex justify-between items-start">
                                        <div className="p-3 bg-accent-gold/10 rounded-xl text-accent-gold">
                                            <Coins className="w-6 h-6" />
                                        </div>
                                        <Badge className="bg-accent-gold/10 text-accent-gold border-none">Reserve Pool</Badge>
                                    </div>
                                    <div className="mt-6">
                                        <h5 className="text-3xl font-black text-white">{usage?.balance ?? 0}</h5>
                                        <p className="text-xs text-text-muted font-bold uppercase tracking-widest mt-1">Non-Expiring Top-Up Credits</p>
                                    </div>
                                    <Button
                                        variant="default"
                                        className="mt-6 bg-accent-gold hover:bg-accent-gold/90 text-slate-950 shadow-glow-gold"
                                        onClick={() => handleTopUp("starter")}
                                        disabled={topUpLoading}
                                    >
                                        <PlusCircle className="w-4 h-4 mr-2" />
                                        {topUpLoading ? "Processing..." : "Purchase More"}
                                    </Button>
                                </div>
                            </div>

                            <div className="mt-12">
                                <h5 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                    <History className="w-4 h-4 text-accent-blue" />
                                    Recent Credit Activity
                                </h5>
                                <div className="space-y-3">
                                    {(usage?.history || []).map((row: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between p-4 rounded-xl glass-strong border border-white/5">
                                            <div className="flex items-center gap-4">
                                                <div className={`p-2 rounded-lg ${row.amount > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-text-muted'}`}>
                                                    <ArrowUpCircle className={`w-4 h-4 ${row.amount < 0 ? 'rotate-180' : ''}`} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-white">{row.type}</p>
                                                    <p className="text-xs text-text-muted">{row.description}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-sm font-mono font-bold ${row.amount > 0 ? 'text-emerald-400' : 'text-white'}`}>
                                                    {row.amount > 0 ? '+' : ''}{row.amount.toLocaleString()}
                                                </p>
                                                <p className="text-[10px] text-text-muted font-medium">
                                                    {new Date(row.createdAt).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                    {(usage?.history || []).length === 0 && (
                                        <div className="text-xs text-text-muted">No credit activity yet.</div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="bg-gradient-to-r from-accent-violet/20 to-accent-blue/20 border border-white/10 p-8 rounded-3xl relative overflow-hidden animate-slide-up">
                        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-accent-crystal">
                                    <Crown className="w-5 h-5" />
                                    <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Enterprise Growth</span>
                                </div>
                                <h4 className="text-2xl font-bold text-white">Need custom quotas?</h4>
                                <p className="text-sm text-text-secondary max-w-md">Scale to millions of monthly leads with custom RAG persistence and dedicated infrastructure.</p>
                            </div>
                            <Button className="bg-white text-slate-950 hover:bg-white/90 font-bold px-8">Talk to Sales</Button>
                        </div>
                        {/* Decorative Gradient Blob */}
                        <div className="absolute top-[-50%] right-[-10%] w-64 h-64 bg-accent-violet/30 rounded-full blur-[80px] pointer-events-none" />
                    </div>
                </div>
            </div>
        </div>
    );
}

