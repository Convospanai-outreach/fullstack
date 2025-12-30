"use client";

import { LucideIcon, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface StatCardProps {
    label: string;
    value: string | number;
    icon: LucideIcon;
    trend?: {
        value: number;
        isUp: boolean;
    };
    description?: string;
}

export function StatCard({ label, value, icon: Icon, trend, description }: StatCardProps) {
    return (
        <div className="glass p-6 rounded-2xl hover:bg-white/10 transition-all group border border-white/5 shadow-xl animate-slide-up">
            <div className="flex items-start justify-between">
                <div className="p-3 rounded-xl bg-accent-blue/10 text-accent-blue group-hover:scale-110 transition-transform">
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
                <h4 className="text-sm font-medium text-text-secondary uppercase tracking-wider">{label}</h4>
                <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-bold text-white tracking-tight">{value}</span>
                </div>
                {description && <p className="text-xs text-text-muted mt-2">{description}</p>}
            </div>
        </div>
    );
}
