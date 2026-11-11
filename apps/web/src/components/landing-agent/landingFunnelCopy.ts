// Display helpers for the landing page funnel report (phase 12). Numbers come from the API already computed.

export function durationText(seconds: number | null): string {
    if (seconds === null) return "-";
    if (seconds < 60) return `${Math.round(seconds)} sec`;
    if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
    if (seconds < 86400) return `${Math.round((seconds / 3600) * 10) / 10} h`;
    const days = Math.round((seconds / 86400) * 10) / 10;
    return days === 1 ? "1 day" : `${days} days`;
}

export function dropOffText(percent: number | null): string {
    if (percent === null) return "-";
    if (percent < 0) return `${Math.abs(percent)}% more than the step before`;
    return `${percent}% drop-off`;
}

export function presetRange(days: number, now: Date): { from: string; to: string } {
    return { from: new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString(), to: now.toISOString() };
}
