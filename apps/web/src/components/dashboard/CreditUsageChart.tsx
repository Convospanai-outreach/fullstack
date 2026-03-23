import { GlassCard } from "@/components/ui/GlassCard";

export function CreditUsageChart() {
    const totalCredits = 1000;
    const usedCredits = 650;
    const percentage = (usedCredits / totalCredits) * 100;

    return (
        <GlassCard>
            <h3 className="text-xl font-bold gradient-text mb-4">Credit Usage</h3>
            <div className="flex items-center justify-between mb-2 text-sm text-gray-300">
                <span>Used: {usedCredits}</span>
                <span>Total: {totalCredits}</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-4 overflow-hidden">
                <div
                    className="bg-gradient-to-r from-blue-500 to-purple-600 h-full rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${percentage}%` }}
                ></div>
            </div>
            <p className="mt-4 text-center text-2xl font-bold text-white">{percentage.toFixed(0)}%</p>
            <p className="text-center text-xs text-gray-400">Credits remaining for this month</p>
        </GlassCard>
    );
}
