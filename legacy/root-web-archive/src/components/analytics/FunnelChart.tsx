"use client"

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from "recharts"
import { GlassCard } from "@/components/ui/GlassCard"

interface FunnelData {
    sent: number
    opened: number
    clicked: number
    replied: number
}

const COLORS = ['#4F8BFF', '#2DD4BF', '#F472B6', '#8B5CF6'];

export default function FunnelChart({ data }: { data: FunnelData }) {
    const chartData = [
        { name: 'Sent', value: data.sent, fill: COLORS[0] },
        { name: 'Opened', value: data.opened, fill: COLORS[1] },
        { name: 'Clicked', value: data.clicked, fill: COLORS[2] },
        { name: 'Replied', value: data.replied, fill: COLORS[3] },
    ]

    return (
        <GlassCard className="h-[350px] w-full">
            <h3 className="text-lg font-semibold mb-4 text-text-primary">Conversion Funnel</h3>
            <ResponsiveContainer width="100%" height="100%" minHeight={1}>
                <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.1)" />
                    <XAxis type="number" stroke="#9CA3AF" />
                    <YAxis
                        dataKey="name"
                        type="category"
                        stroke="#E6EAF2"
                        width={80}
                    />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#0B0F1A', borderColor: 'rgba(255,255,255,0.1)' }}
                        itemStyle={{ color: '#E6EAF2' }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </GlassCard>
    )
}
