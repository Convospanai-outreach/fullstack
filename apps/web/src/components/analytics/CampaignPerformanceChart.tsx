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
            <h3 className="text-lg font-semibold text-white mb-6">Campaign Performance</h3>
            <div className="space-y-6">
                {data.map((item) => (
                    <div key={item.name} className="space-y-2">
                        <div className="flex justify-between text-sm text-gray-400">
                            <span>{item.name}</span>
                            <span>{item.sent} Sent</span>
                        </div>
                        <div className="h-4 bg-white/5 rounded-full overflow-hidden flex">
                            {/* Sent (Background is the full bar, effectively) */}

                            {/* Opened */}
                            <div
                                className="h-full bg-blue-500/60"
                                style={{ width: `${(item.opened / item.sent) * 100}%` }}
                                title={`${item.opened} Opened`}
                            />

                            {/* Replied */}
                            <div
                                className="h-full bg-green-500/80"
                                style={{ width: `${(item.replied / item.sent) * 100}%` }}
                                title={`${item.replied} Replied`}
                            />
                        </div>
                        <div className="flex justify-end gap-4 text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-blue-500/60"></div>
                                <span>Opened ({Math.round((item.opened / item.sent) * 100)}%)</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-green-500/80"></div>
                                <span>Replied ({Math.round((item.replied / item.sent) * 100)}%)</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </GlassCard>
    );
}
