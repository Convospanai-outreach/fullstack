"use client";

import { GlassCard } from "@/components/ui/GlassCard";

interface LeadData {
    month: string;
    leads: number;
}

interface LeadGrowthChartProps {
    data: LeadData[];
}

export function LeadGrowthChart({ data }: LeadGrowthChartProps) {
    const maxLeads = Math.max(...data.map(d => d.leads)) * 1.2; // Add some headroom
    const height = 200;
    const width = 500;
    const padding = 40;

    // Calculate points for the SVG path
    const points = data.map((d, i) => {
        const x = padding + (i * (width - 2 * padding)) / (data.length - 1);
        const y = height - padding - (d.leads / maxLeads) * (height - 2 * padding);
        return `${x},${y}`;
    }).join(" ");

    return (
        <GlassCard className="h-full">
            <h3 className="text-lg font-semibold text-white mb-6">Lead Growth</h3>
            <div className="w-full overflow-x-auto">
                <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
                    {/* Grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
                        const y = height - padding - tick * (height - 2 * padding);
                        return (
                            <g key={tick}>
                                <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />
                                <text x={padding - 10} y={y + 4} fill="rgba(255,255,255,0.4)" fontSize="10" textAnchor="end">
                                    {Math.round(tick * maxLeads)}
                                </text>
                            </g>
                        );
                    })}

                    {/* The Line */}
                    <polyline
                        fill="none"
                        stroke="#8b5cf6"
                        strokeWidth="3"
                        points={points}
                    />

                    {/* Data Points */}
                    {data.map((d, i) => {
                        const x = padding + (i * (width - 2 * padding)) / (data.length - 1);
                        const y = height - padding - (d.leads / maxLeads) * (height - 2 * padding);
                        return (
                            <circle key={i} cx={x} cy={y} r="4" fill="#8b5cf6" stroke="#fff" strokeWidth="2" />
                        );
                    })}

                    {/* X Axis Labels */}
                    {data.map((d, i) => {
                        const x = padding + (i * (width - 2 * padding)) / (data.length - 1);
                        return (
                            <text key={i} x={x} y={height - 10} fill="rgba(255,255,255,0.6)" fontSize="12" textAnchor="middle">
                                {d.month}
                            </text>
                        );
                    })}
                </svg>
            </div>
        </GlassCard>
    );
}
