"use client"

import FunnelChart from "@/components/analytics/FunnelChart"
import MetricCard from "@/components/analytics/MetricCard"
import { Send, MailOpen, MousePointerClick, MessageCircle, TrendingUp } from "lucide-react"

interface AnalyticsTabProps {
    data: any
}

export default function AnalyticsTab({ data }: AnalyticsTabProps) {
    // Safe defaults
    const funnel = data?.funnel || { sent: 0, opened: 0, clicked: 0, replied: 0 };

    // Calculate Rates
    const openRate = funnel.sent > 0 ? ((funnel.opened / funnel.sent) * 100).toFixed(1) : "0.0";
    const clickRate = funnel.opened > 0 ? ((funnel.clicked / funnel.opened) * 100).toFixed(1) : "0.0";
    const replyRate = funnel.sent > 0 ? ((funnel.replied / funnel.sent) * 100).toFixed(1) : "0.0";

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    label="Sent"
                    value={funnel.sent}
                    icon={Send}
                    color="text-primary"
                />
                <MetricCard
                    label="Open Rate"
                    value={`${openRate}%`}
                    icon={MailOpen}
                    color="text-success"
                />
                <MetricCard
                    label="Click Rate"
                    value={`${clickRate}%`}
                    icon={MousePointerClick}
                    color="text-primary"
                />
                <MetricCard
                    label="Reply Rate"
                    value={`${replyRate}%`}
                    icon={MessageCircle}
                    color="text-chart-4"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <FunnelChart data={funnel} />
                </div>

                <div className="space-y-4">
                    <div className="glass backdrop-blur-xl p-5 h-full">
                        <h3 className="text-lg font-semibold mb-4 text-foreground flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-success" />
                            AI Insights
                        </h3>
                        <div className="space-y-4 text-sm text-muted-foreground">
                            <p>- Open rate is above your baseline.</p>
                            <p>- Most replies cluster on weekdays.</p>
                            <p>- Recommendation: Increase personalization in the subject line.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
