"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { getBrowserApiBase } from "@/lib/api/browserBase";

export function UsageCard() {
    const [usage, setUsage] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(getBrowserApiBase() + "/usage")
            .then(res => res.json())
            .then(data => {
                if (data.usage) setUsage(data.usage);
            })
            .catch(err => console.error("Failed to load usage", err))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="h-48 bg-foreground/5 animate-pulse rounded-xl" />;

    const percent = usage ? Math.min(100, (usage.currentSpend / usage.monthlyLimit) * 100) : 0;

    return (
        <GlassCard className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Workspace Usage</h3>

            {usage ? (
                <div className="space-y-4">
                    <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Used Credits</span>
                        <span>{usage.currentSpend} / {usage.monthlyLimit}</span>
                    </div>
                    <div className="w-full h-2 bg-card rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full ${percent > 90 ? 'bg-destructive' : 'bg-primary'}`}
                            style={{ width: `${percent}%` }}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Resets on the 1st of every month.
                    </p>
                </div>
            ) : (
                <p className="text-muted-foreground">Usage data unavailable.</p>
            )}
        </GlassCard>
    );
}
