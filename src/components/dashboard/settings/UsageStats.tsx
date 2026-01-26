
"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/Progress";
import { Zap, Database, TrendingUp } from "lucide-react";

interface UsageData {
    credits: number;
    currentSpend: number;
    monthlyLimit: number;
    teamId: string;
}

export function UsageStats() {
    const [data, setData] = useState<UsageData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/usage")
            .then((res) => res.json())
            .then((json) => {
                if (json.usage) setData(json.usage);
            })
            .catch((err) => console.error("Failed to fetch usage:", err))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return <div className="p-4 text-sm text-white/50">Loading usage stats...</div>;
    }

    if (!data) {
        return <div className="p-4 text-sm text-red-500">Unable to load usage data.</div>;
    }

    const percentUsed = Math.min((data.currentSpend / data.monthlyLimit) * 100, 100);
    const lowCredits = data.credits < 100;

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Credits Card */}
            <Card title="Available Credits">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-2xl font-bold text-white">{data.credits.toLocaleString()}</div>
                        <p className="text-xs text-text-secondary mt-1">
                            {lowCredits ? "Low balance - optimization active" : "Sufficient for execution"}
                        </p>
                    </div>
                    <Zap className={`h-8 w-8 ${lowCredits ? "text-red-500" : "text-blue-500"}`} />
                </div>
            </Card>

            {/* Monthly Limit Card */}
            <Card title="Monthly Quota">
                <div className="flex items-center justify-between mb-2">
                    <div className="text-2xl font-bold text-white">
                        {data.currentSpend.toLocaleString()} <span className="text-sm font-normal text-gray-500">/ {data.monthlyLimit.toLocaleString()}</span>
                    </div>
                    <Database className="h-5 w-5 text-gray-500" />
                </div>
                <Progress value={percentUsed} className="mt-2 h-2" />
                <p className="text-xs text-text-secondary mt-2">
                    {percentUsed.toFixed(0)}% used
                </p>
            </Card>

            {/* Efficiency Card */}
            <Card title="Optimization">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-2xl font-bold text-white">Active</div>
                        <p className="text-xs text-text-secondary mt-1">
                            Semantic Cache is enabled
                        </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-500" />
                </div>
            </Card>
        </div>
    );
}
