
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardTitle, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/Progress";
import Link from "next/link";
import { Zap, Database, TrendingUp, PlusCircle } from "lucide-react";
import { getBrowserApiBase } from "@/lib/api/browserBase";

interface UsageData {
    credits: number;
    currentSpend: number;
    monthlyLimit: number;
    teamId: string;
}

const DEFAULT_USAGE: UsageData = {
    credits: 0,
    currentSpend: 0,
    monthlyLimit: 1000,
    teamId: "local",
};

function normalizeUsage(usage: Partial<UsageData> | null | undefined): UsageData {
    return {
        credits: Number.isFinite(usage?.credits) ? Number(usage?.credits) : DEFAULT_USAGE.credits,
        currentSpend: Number.isFinite(usage?.currentSpend) ? Number(usage?.currentSpend) : DEFAULT_USAGE.currentSpend,
        monthlyLimit: Number.isFinite(usage?.monthlyLimit) && Number(usage?.monthlyLimit) > 0 ? Number(usage?.monthlyLimit) : DEFAULT_USAGE.monthlyLimit,
        teamId: usage?.teamId || DEFAULT_USAGE.teamId,
    };
}

export function UsageStats() {
    const [data, setData] = useState<UsageData>(DEFAULT_USAGE);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(getBrowserApiBase() + "/usage")
            .then((res) => res.json())
            .then((json) => {
                setData(normalizeUsage(json?.usage));
            })
            .catch((err) => console.error("Failed to fetch usage:", err))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return <div className="p-4 text-sm text-muted-foreground">Loading usage stats...</div>;
    }

    const percentUsed = Math.min((data.currentSpend / data.monthlyLimit) * 100, 100);
    const lowCredits = data.credits < 100;

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Credits Card */}
            <Card className="flex flex-col justify-between">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle>Available Credits</CardTitle>
                    <Link
                        href="/credits"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                    >
                        <PlusCircle className="w-3.5 h-3.5" />
                        Top Up
                    </Link>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-2xl font-bold text-foreground">{data.credits.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {lowCredits ? "Low balance - optimization active" : "Sufficient for execution"}
                            </p>
                        </div>
                        <Zap className={`h-8 w-8 ${lowCredits ? "text-red-500" : "text-blue-500"}`} />
                    </div>
                </CardContent>
            </Card>

            {/* Monthly Limit Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Monthly Quota</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-2xl font-bold text-foreground">
                            {data.currentSpend.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">/ {data.monthlyLimit.toLocaleString()}</span>
                        </div>
                        <Database className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <Progress value={percentUsed} className="mt-2 h-2" />
                    <p className="text-xs text-muted-foreground mt-2">
                        {percentUsed.toFixed(0)}% used
                    </p>
                </CardContent>
            </Card>

            {/* Efficiency Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Optimization</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-2xl font-bold text-foreground">Active</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Semantic Cache is enabled
                            </p>
                        </div>
                        <TrendingUp className="h-8 w-8 text-green-500" />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
