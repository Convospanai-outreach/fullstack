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
        <div className="glass px-5 py-[18px] animate-slide-up">
            <div className="flex items-start justify-between">
                <div className="h-10 w-10 grid place-items-center rounded-[3px] bg-primary/[.12] text-primary">
                    <Icon className="w-5 h-5" />
                </div>
                {trend && (
                    <div className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-[2px] ${trend.isUp ? 'bg-success/[.14] text-success' : 'bg-destructive/[.12] text-destructive'}`}>
                        {trend.isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {trend.value}%
                    </div>
                )}
            </div>

            <div className="mt-4">
                <h4 className="text-[13px] text-muted-foreground">{label}</h4>
                <div className="flex items-baseline gap-2 mt-1">
                    <span className="font-display text-4xl font-semibold text-primary leading-[1.1]">
                        {isNumber ? displayValue.toLocaleString() : value}
                        {label.includes("ROI") && "%"}
                    </span>
                </div>
                {description && <p className="text-[13px] text-muted-foreground mt-1.5">{description}</p>}
            </div>
        </div>
    );
}
