"use client";

import { TrendingUp, Target, ArrowUpRight } from "lucide-react";

interface ForecastingProps {
    current: number;
    weighted: number;
    total: number;
}

export function ForecastingWidget({ current, weighted, total }: ForecastingProps) {
    const percentage = total > 0 ? (current / total) * 100 : 0;

    return (
        <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        Revenue Forecast <Target className="w-4 h-4 text-blue-400" />
                    </h3>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Weighted Pipeline Analysis</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                    <TrendingUp className="w-3 h-3 text-emerald-400" />
                    <span className="text-[10px] font-bold text-emerald-400">+12% vs LY</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                    <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Actual Revenue</div>
                    <div className="text-xl font-bold text-white">${current.toLocaleString()}</div>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                    <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Forecasted</div>
                    <div className="text-xl font-bold text-blue-400">${total.toLocaleString()}</div>
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase">
                    <span>Progress to Forecast</span>
                    <span className="text-white">{Math.round(percentage)}%</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5">
                    <div
                        className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                        style={{ width: `${percentage}%` }}
                    />
                </div>
            </div>

            <div className="pt-4 border-t border-white/5">
                <div className="flex items-center gap-2 text-[10px] text-gray-400 italic">
                    <ArrowUpRight className="w-3 h-3 text-blue-400" />
                    Based on {weighted.toLocaleString()} in weighted pipeline opportunities.
                </div>
            </div>
        </div>
    );
}
