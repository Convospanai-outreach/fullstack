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

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-4))', 'hsl(var(--chart-1))'];

export default function FunnelChart({ data }: { data: FunnelData }) {
    const chartData = [
        { name: 'Sent', value: data.sent, fill: COLORS[0] },
        { name: 'Opened', value: data.opened, fill: COLORS[1] },
        { name: 'Clicked', value: data.clicked, fill: COLORS[2] },
        { name: 'Replied', value: data.replied, fill: COLORS[3] },
    ]

    return (
        <GlassCard className="h-[350px] w-full">
            <h3 className="text-lg font-semibold mb-4 text-foreground">Conversion Funnel</h3>
            <ResponsiveContainer width="100%" height="100%" minHeight={1}>
                <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                    <YAxis
                        dataKey="name"
                        type="category"
                        stroke="hsl(var(--foreground))"
                        width={80}
                    />
                    <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
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
