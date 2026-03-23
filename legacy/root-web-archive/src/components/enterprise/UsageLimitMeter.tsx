"use client";

// React import removed

interface UsageLimitMeterProps {
    used: number;
    total: number;
    label?: string;
}

export function UsageLimitMeter({ used, total, label = "Usage" }: UsageLimitMeterProps) {
    const percentage = Math.min((used / total) * 100, 100);
    const isCritical = percentage > 90;

    return (
        <div className="space-y-2">
            <div className="flex justify-between items-end">
                <span className="text-xs font-bold uppercase tracking-wider text-text-muted">{label}</span>
                <span className={`text-xs font-mono font-bold ${isCritical ? 'text-red-400' : 'text-text-primary'}`}>
                    {used.toLocaleString()} / {total.toLocaleString()}
                </span>
            </div>
            <div className="h-2.5 bg-white/10 rounded-full overflow-hidden border border-white/5">
                <div
                    className={`h-full transition-all duration-500 ease-out rounded-full ${isCritical ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-accent-mint shadow-[0_0_10px_rgba(16,185,129,0.3)]'}`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}
