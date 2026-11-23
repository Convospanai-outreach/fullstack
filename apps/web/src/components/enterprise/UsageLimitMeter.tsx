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
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
                <span className={`text-xs font-mono font-bold ${isCritical ? 'text-destructive' : 'text-foreground'}`}>
                    {used.toLocaleString()} / {total.toLocaleString()}
                </span>
            </div>
            <div className="h-2.5 bg-foreground/10 rounded-full overflow-hidden border border-foreground/5">
                <div
                    className={`h-full transition-all duration-500 ease-out rounded-full ${isCritical ? 'bg-destructive shadow-[0_0_10px_hsl(var(--destructive)/0.5)]' : 'bg-success shadow-[0_0_10px_rgba(16,185,129,0.3)]'}`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}
