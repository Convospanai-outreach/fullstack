"use client";

import { GlassCard } from "@/components/ui/GlassCard";

interface CampaignData {
    name: string;
    sent: number;
    opened: number;
    replied: number;
}

interface CampaignPerformanceChartProps {
    data: CampaignData[];
}

export function CampaignPerformanceChart({ data }: CampaignPerformanceChartProps) {

    return (
        <GlassCard className="h-full">
            <h3 className="text-lg font-semibold text-foreground mb-6">Campaign Performance</h3>
            <div className="space-y-6">
                {data.map((item) => (
                    <div key={item.name} className="space-y-2">
                        <div className="flex justify-between text-sm text-muted-foreground">
                            <span>{item.name}</span>
                            <span>{item.sent} Sent</span>
                        </div>
                        <div className="h-4 bg-foreground/5 rounded-full overflow-hidden flex">
                            {/* Sent (Background is the full bar, effectively) */}

                            {/* Opened */}
                            <div
                                className="h-full bg-primary/60"
                                style={{ width: `${(item.opened / item.sent) * 100}%` }}
                                title={`${item.opened} Opened`}
                            />

                            {/* Replied */}
                            <div
                                className="h-full bg-success/80"
                                style={{ width: `${(item.replied / item.sent) * 100}%` }}
                                title={`${item.replied} Replied`}
                            />
                        </div>
                        <div className="flex justify-end gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-primary/60"></div>
                                <span>Opened ({Math.round((item.opened / item.sent) * 100)}%)</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-success/80"></div>
                                <span>Replied ({Math.round((item.replied / item.sent) * 100)}%)</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </GlassCard>
    );
}
