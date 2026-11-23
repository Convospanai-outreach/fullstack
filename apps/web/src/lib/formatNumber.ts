const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const compactUsd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });

/** 1234 -> "1.2K". Non-finite values render as an em dash. */
export function formatCompact(value: number): string {
  return Number.isFinite(value) ? compact.format(value) : "—";
}

export function formatCompactUsd(value: number): string {
  return Number.isFinite(value) ? compactUsd.format(value) : "—";
}

/** Percent with one decimal, or an em dash when there is nothing to divide by. */
export function formatPercent(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "—" : `${value.toFixed(1)}%`;
}
