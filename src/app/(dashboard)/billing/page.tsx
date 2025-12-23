"use client";

import React, { useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PaymentHistory } from "@/components/billing/PaymentHistory";
import { UpgradeModal } from "@/components/billing/UpgradeModal";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function SubscriptionPage() {
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
    const { data: subscription, error, isLoading } = useSWR("/api/billing/subscription", fetcher);

    return (
        <main className="p-8 max-w-6xl mx-auto">
            <SectionHeader title="Billing & Subscription" subtitle="Manage your plan and payments" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                {/* Current Plan */}
                <GlassCard className="md:col-span-1 border-blue-500/30 bg-blue-500/5">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-gray-400 text-sm uppercase tracking-wider">Current Plan</p>
                            <h3 className="text-2xl font-bold text-white mt-1 capitalize">
                                {isLoading ? "..." : (subscription?.plan || "Free")}
                            </h3>
                        </div>
                        <Badge variant={subscription?.active ? "success" : "warning"}>
                            {isLoading ? "..." : (subscription?.active ? "Active" : "Inactive")}
                        </Badge>
                    </div>

                    <div className="mb-6">
                        <p className="text-3xl font-bold gradient-text">
                            {subscription?.plan === "enterprise" ? "Custom" : (subscription?.plan === "pro" ? "$49" : "$0")}
                            <span className="text-lg text-gray-400 font-normal">/mo</span>
                        </p>
                    </div>

                    <div className="space-y-3 mb-8">
                        <p className="text-sm text-gray-300">
                            ✓ {subscription?.credits || 0} Credits / month
                        </p>
                        <p className="text-sm text-gray-300">✓ AI Processing</p>
                    </div>

                    <Button className="w-full" onClick={() => setIsUpgradeModalOpen(true)}>
                        {subscription?.plan === "pro" ? "Manage Plan" : "Upgrade Plan"}
                    </Button>
                </GlassCard>

                {/* Credit Usage / Quick Topup */}
                <GlassCard className="md:col-span-2">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-white">Credit Usage</h3>
                        <Button variant="secondary" size="sm">Buy Credits</Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-white/5 p-4 rounded-lg">
                            <p className="text-gray-400 text-xs uppercase">Available Credits</p>
                            <p className="text-2xl font-bold text-white mt-1">{subscription?.credits || 0}</p>
                        </div>
                        <div className="bg-white/5 p-4 rounded-lg">
                            <p className="text-gray-400 text-xs uppercase">Next Refresh</p>
                            <p className="text-white mt-1">
                                {subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : "N/A"}
                            </p>
                        </div>
                    </div>

                    <p className="text-sm text-gray-400">
                        Credits are used for lead enrichment (1 credit) and AI content generation (1 credit).
                        Top-up credits never expire.
                    </p>
                </GlassCard>
            </div>

            <PaymentHistory />

            <UpgradeModal isOpen={isUpgradeModalOpen} onClose={() => setIsUpgradeModalOpen(false)} />
        </main>
    );
}
