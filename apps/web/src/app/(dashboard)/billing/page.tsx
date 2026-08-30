"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Modal } from "@/components/ui/Modal";
import { UsageLimitMeter } from "@/components/enterprise/UsageLimitMeter";
import { Skeleton } from "@/components/ui/Skeleton";
import { Download } from "lucide-react";
import useSWR from "swr";
import { BILLING_COUNTRIES, INDIAN_STATES } from "@/lib/billingAddress";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

import { getBrowserApiUrl } from "@/lib/api/browserBase";

export default function BillingPage() {
    const router = useRouter();
    const { data: rawSubscription, isLoading, error } = useSWR(getBrowserApiUrl("/billing/subscription"), fetcher, {
        revalidateOnFocus: false,
    });
    const { data: usage } = useSWR(getBrowserApiUrl("/billing/usage"), fetcher);
    const { data: invoiceData } = useSWR(getBrowserApiUrl("/billing/invoices"), fetcher);
    const [topUpLoading, setTopUpLoading] = useState(false);
    const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);
    const [billingModalOpen, setBillingModalOpen] = useState(false);
    const [pendingTierId, setPendingTierId] = useState<string | null>(null);
    const [billingCountry, setBillingCountry] = useState("IN");
    const [billingCustomCountry, setBillingCustomCountry] = useState("");
    const [billingState, setBillingState] = useState("Delhi");

    const invoices = invoiceData?.invoices || [];

    const subscription = rawSubscription || {
        active: true,
        plan: "FREE",
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const openTopUpModal = (tierId: string) => {
        setPendingTierId(tierId);
        setBillingModalOpen(true);
    };

    const downloadInvoice = (id: string) => {
        setDownloadingInvoiceId(id);
        window.open(getBrowserApiUrl(`/billing/invoices/${id}/download`), "_blank");
        setDownloadingInvoiceId(null);
    };

    const handleTopUp = async (tierId: string, country: string, state: string) => {
        setTopUpLoading(true);
        try {
            // Create Razorpay order
            const response = await fetch(getBrowserApiUrl('/billing/topup'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tierId, country, state: country === "IN" ? state : undefined })
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
                <h1 className="text-3xl font-bold text-foreground tracking-tight">Billing & Credits</h1>
                <p className="text-muted-foreground mt-1">Manage your enterprise plan, credit balance, and transaction history.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Current Plan Overview */}
                <div className="lg:col-span-1 space-y-6">
                    <Card className="border-primary/20 bg-primary/[0.02]">
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
                                <div className="mt-4 p-6 rounded-2xl bg-muted border border-border relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-3">
                                        <Badge variant={subscription?.active ? "success" : "default"}>
                                            {subscription?.active ? "Active" : "Inactive"}
                                        </Badge>
                                    </div>

                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="p-3 bg-primary/10 rounded-xl text-primary">
                                            <Zap className="w-8 h-8" />
                                        </div>
                                        <div>
                                            <h4 className="text-2xl font-black text-foreground capitalize">
                                                {subscription?.plan || "Free"}
                                            </h4>
                                            <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest">
                                                {subscription?.plan === "ENTERPRISE" ? "Enterprise Access" : "Standard Access"}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Renews on</span>
                                            <span className="text-foreground font-mono">
                                                {subscription?.currentPeriodEnd
                                                    ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                                                    : 'N/A'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Monthly Credits</span>
                                            <span className="text-foreground font-mono">
                                                {subscription?.credits || 0}
                                            </span>
                                        </div>
                                    </div>

                                    <Button
                                        variant="outline"
                                        className="w-full mt-8 border-border"
                                        onClick={() => router.push("/pricing")}
                                    >
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
                                <button
                                    className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-accent transition group text-left border border-border disabled:opacity-50"
                                    disabled={invoices.length === 0}
                                    onClick={() => invoices[0] && downloadInvoice(invoices[0].id)}
                                >
                                    <div className="flex items-center gap-3">
                                        <History className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                                        <span className="text-sm font-semibold text-foreground">Download Last Invoice</span>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                </button>
                                <button className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-accent transition group text-left border border-border">
                                    <div className="flex items-center gap-3">
                                        <CreditCard className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                                        <span className="text-sm font-semibold text-foreground">Update Payment Method</span>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                </button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Invoice History</CardTitle>
                            <CardDescription>Tax invoices for every payment on this workspace</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 mt-2">
                                {invoices.length === 0 && (
                                    <div className="text-xs text-muted-foreground">No invoices yet.</div>
                                )}
                                {invoices.map((inv: any) => (
                                    <div key={inv.id} className="flex items-center justify-between p-3 rounded-xl border border-border">
                                        <div>
                                            <p className="text-xs font-mono text-foreground">{inv.invoiceNumber}</p>
                                            <p className="text-[10px] text-muted-foreground">{new Date(inv.createdAt).toLocaleDateString()}</p>
                                        </div>
                                        <button
                                            className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-primary disabled:opacity-50"
                                            disabled={downloadingInvoiceId === inv.id}
                                            onClick={() => downloadInvoice(inv.id)}
                                            aria-label={`Download ${inv.invoiceNumber}`}
                                        >
                                            <Download className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
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
                                        <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase">
                                            <span>Current Balance</span>
                                            <span className="text-accent-mint">{usage?.balance ?? 0} remaining</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            Credits refresh automatically on your billing anniversary. Unused base credits do not roll over.
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-muted p-6 rounded-2xl border border-border flex flex-col justify-between">
                                    <div className="flex justify-between items-start">
                                        <div className="p-3 bg-accent-gold/10 rounded-xl text-accent-gold">
                                            <Coins className="w-6 h-6" />
                                        </div>
                                        <Badge className="bg-accent-gold/10 text-accent-gold border-none">Reserve Pool</Badge>
                                    </div>
                                    <div className="mt-6">
                                        <h5 className="text-3xl font-black text-foreground">{usage?.balance ?? 0}</h5>
                                        <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">Non-Expiring Top-Up Credits</p>
                                    </div>
                                    <Button
                                        variant="default"
                                        className="mt-6 bg-accent-gold hover:bg-accent-gold/90 text-slate-950 shadow-glow-gold"
                                        onClick={() => openTopUpModal("starter")}
                                        disabled={topUpLoading}
                                    >
                                        <PlusCircle className="w-4 h-4 mr-2" />
                                        {topUpLoading ? "Processing..." : "Purchase More"}
                                    </Button>
                                </div>
                            </div>

                            <div className="mt-12">
                                <h5 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                                    <History className="w-4 h-4 text-primary" />
                                    Recent Credit Activity
                                </h5>
                                <div className="space-y-3">
                                    {(usage?.history || []).map((row: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between p-4 rounded-xl glass-strong border border-border">
                                            <div className="flex items-center gap-4">
                                                <div className={`p-2 rounded-lg ${row.amount > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                                                    <ArrowUpCircle className={`w-4 h-4 ${row.amount < 0 ? 'rotate-180' : ''}`} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-foreground">{row.type}</p>
                                                    <p className="text-xs text-muted-foreground">{row.description}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-sm font-mono font-bold ${row.amount > 0 ? 'text-emerald-400' : 'text-foreground'}`}>
                                                    {row.amount > 0 ? '+' : ''}{row.amount.toLocaleString()}
                                                </p>
                                                <p className="text-[10px] text-muted-foreground font-medium">
                                                    {new Date(row.createdAt).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                    {(usage?.history || []).length === 0 && (
                                        <div className="text-xs text-muted-foreground">No credit activity yet.</div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="bg-gradient-to-r from-accent-violet/20 to-primary/20 border border-border p-8 rounded-3xl relative overflow-hidden animate-slide-up">
                        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-accent-crystal">
                                    <Crown className="w-5 h-5" />
                                    <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Enterprise Growth</span>
                                </div>
                                <h4 className="text-2xl font-bold text-foreground">Need custom quotas?</h4>
                                <p className="text-sm text-muted-foreground max-w-md">Scale to millions of monthly leads with custom RAG persistence and dedicated infrastructure.</p>
                            </div>
                            <Button className="bg-white text-slate-950 hover:bg-white/90 font-bold px-8">Talk to Sales</Button>
                        </div>
                        {/* Decorative Gradient Blob */}
                        <div className="absolute top-[-50%] right-[-10%] w-64 h-64 bg-accent-violet/30 rounded-full blur-[80px] pointer-events-none" />
                    </div>
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
                            disabled={topUpLoading || (billingCountry === "OTHER" && !billingCustomCountry.trim())}
                            onClick={() => {
                                setBillingModalOpen(false);
                                if (pendingTierId) {
                                    const resolvedCountry = billingCountry === "OTHER" ? billingCustomCountry.trim() : billingCountry;
                                    handleTopUp(pendingTierId, resolvedCountry, billingState);
                                }
                            }}
                        >
                            Confirm & Pay
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <p className="text-xs text-muted-foreground">Used to determine GST treatment on your invoice.</p>
                    <div>
                        <label className="text-xs font-semibold text-foreground block mb-1">Country</label>
                        <select
                            className="w-full bg-muted border border-border rounded-lg p-2 text-sm text-foreground"
                            value={billingCountry}
                            onChange={(e) => setBillingCountry(e.target.value)}
                        >
                            {BILLING_COUNTRIES.map((c) => (
                                <option key={c.code} value={c.code} className="bg-popover">{c.label}</option>
                            ))}
                        </select>
                    </div>
                    {billingCountry === "IN" && (
                        <div>
                            <label className="text-xs font-semibold text-foreground block mb-1">State</label>
                            <select
                                className="w-full bg-muted border border-border rounded-lg p-2 text-sm text-foreground"
                                value={billingState}
                                onChange={(e) => setBillingState(e.target.value)}
                            >
                                {INDIAN_STATES.map((s) => (
                                    <option key={s} value={s} className="bg-popover">{s}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    {billingCountry === "OTHER" && (
                        <div>
                            <label className="text-xs font-semibold text-foreground block mb-1">Country name</label>
                            <input
                                className="w-full bg-muted border border-border rounded-lg p-2 text-sm text-foreground"
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

