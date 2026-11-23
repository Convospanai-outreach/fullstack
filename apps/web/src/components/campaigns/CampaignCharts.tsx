"use client";
import { useEffect, useState } from "react";

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from "recharts";

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-6))', 'hsl(var(--chart-8))', 'hsl(var(--chart-7))'];

interface CampaignChartsProps {
    timeline: Array<{ date: string; sent: number; opened: number }>;
    leadsByStatus: Record<string, number>;
}

export default function CampaignCharts({ timeline, leadsByStatus }: CampaignChartsProps) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    if (!mounted) return <div className="h-64 flex items-center justify-center text-muted-foreground">Loading charts...</div>;

    const pieData = Object.entries(leadsByStatus).map(([name, value]) => ({
        name,
        value,
    }));

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Activity Chart */}
            <div className="bg-card p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">Activity Timeline (7 Days)</h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <LineChart data={timeline}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="sent"
                                stroke="hsl(var(--chart-7))"
                                name="Emails Sent"
                                activeDot={{ r: 8 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="opened"
                                stroke="hsl(var(--chart-2))"
                                name="Emails Opened"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Status Distribution */}
            <div className="bg-card p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">Lead Status Distribution</h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }: { name?: string, percent?: number }) =>
                                    `${name || 'Unknown'} ${((percent || 0) * 100).toFixed(0)}%`
                                }
                                outerRadius={80}
                                fill="hsl(var(--chart-7))"
                                dataKey="value"
                            >
                                {pieData.map((_, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={COLORS[index % COLORS.length]}
                                    />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
