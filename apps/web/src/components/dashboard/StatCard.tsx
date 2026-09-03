"use client";

import { useState, useEffect } from 'react';
import { LucideIcon, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface StatCardProps {
    label: string;
    value: string | number;
    icon: LucideIcon;
    trend?: {
        value: number;
        isUp: boolean;
    } | undefined;
    description?: string | undefined;
}

export function StatCard({ label, value, icon: Icon, trend, description }: StatCardProps) {
    // Basic CountUp implementation
    const [displayValue, setDisplayValue] = useState(0);
    const numericValue = typeof value === 'number' ? value : parseInt(String(value).replace(/,/g, ''), 10) || 0;
    const isNumber = typeof value === 'number' || !isNaN(Number(String(value).replace(/,/g, '')));

    useEffect(() => {
        if (!isNumber) return;

        let start = 0;
        const end = numericValue;
        const duration = 1500;
        const startTime = performance.now();

        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // EaseOutQuart
            const ease = 1 - Math.pow(1 - progress, 4);

            setDisplayValue(Math.floor(start + (end - start) * ease));

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }, [numericValue, isNumber]);

    return (
        <div className="glass p-6 rounded-2xl hover:bg-accent transition-all group border border-border shadow-xl animate-slide-up">
            <div className="flex items-start justify-between">
                <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                    <Icon className="w-6 h-6" />
                </div>
                {trend && (
                    <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${trend.isUp ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        {trend.isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {trend.value}%
                    </div>
                )}
            </div>

            <div className="mt-4">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{label}</h4>
                <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-bold text-foreground tracking-tight">
                        {isNumber ? displayValue.toLocaleString() : value}
                        {label.includes("ROI") && "%"}
                    </span>
                </div>
                {description && <p className="text-xs text-muted-foreground mt-2">{description}</p>}
            </div>
        </div>
    );
}
