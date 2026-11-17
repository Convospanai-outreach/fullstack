/** Renders a 0..1 probability as a percentage with two decimals. Never returns raw floats or scientific notation. */
export function formatProbability(value: number | null | undefined): string {
    if (typeof value !== "number" || !Number.isFinite(value)) return "—";
    const clamped = Math.min(1, Math.max(0, value));
    if (clamped > 0 && clamped < 0.0001) return "< 0.01%";
    return `${(clamped * 100).toFixed(2)}%`;
}
