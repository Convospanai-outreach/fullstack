"use client";
import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function ChartCard({ title, series, subtitle }: any) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    return (
        <div className="glass p-4 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-primary">{title}</h3>
                    <div className="text-sm text-muted-foreground">{subtitle}</div>
                </div>
            </div>

            <div style={{ width: "100%", height: 220 }}>
                {mounted && (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <LineChart data={series}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.06} />
                            <XAxis dataKey="day" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                            <Tooltip />
                            <Line type="monotone" dataKey="value" stroke="hsl(var(--chart-1))" strokeWidth={3} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
}
