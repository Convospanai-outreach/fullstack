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
            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    label="Sent"
                    value={funnel.sent}
                    icon={Send}
                    color="text-accent-blue"
                />
                <MetricCard
                    label="Open Rate"
                    value={`${openRate}%`}
                    icon={MailOpen}
                    color="text-accent-mint"
                    trend={2.5} // Mock trend for now
                />
                <MetricCard
                    label="Click Rate"
                    value={`${clickRate}%`}
                    icon={MousePointerClick}
                    color="text-accent-violet"
                />
                <MetricCard
                    label="Reply Rate"
                    value={`${replyRate}%`}
                    icon={MessageCircle}
                    color="text-pink-500"
                    trend={-0.4}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Funnel Chart */}
                <div className="lg:col-span-2">
                    <FunnelChart data={funnel} />
                </div>

                {/* Insights / Side Panel */}
                <div className="space-y-4">
                    {/* We can re-use existing CampaignCharts or add a heat map here later */}
                    <div className="bg-bg-glass backdrop-blur-xl border border-border-subtle rounded-xl p-5 h-full">
                        <h3 className="text-lg font-semibold mb-4 text-text-primary flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-accent-mint" />
                            AI Insights
                        </h3>
                        <div className="space-y-4 text-sm text-text-secondary">
                            <p>• Open rate is <span className="text-accent-mint font-medium">12% above average</span> for this industry.</p>
                            <p>• Most replies occur on <span className="text-text-primary">Tuesdays</span> between 9-11 AM.</p>
                            <p>• Recommendation: Increase personalization in the subject line to boost open rate further.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
