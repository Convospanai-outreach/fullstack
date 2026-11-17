// Speed to lead: seconds from a lead's creation to its first outbound message (email, LinkedIn or
// Instagram DM, WhatsApp). Computed when read from existing message rows; nothing is stored.

/** Seconds from `createdAt` to the earliest outbound time at or after it, or null when there is none. */
export function firstResponseSeconds(createdAt: Date, outboundAt: Date[]): number | null {
  const start = createdAt.getTime();
  let earliest: number | null = null;
  for (const time of outboundAt) {
    const ms = time.getTime();
    if (ms < start) continue;
    if (earliest === null || ms < earliest) earliest = ms;
  }
  return earliest === null ? null : Math.round((earliest - start) / 1000);
}

/** Median of the non-null values, or null when there are none. */
export function medianSeconds(values: (number | null)[]): number | null {
  const sorted = values.filter((v): v is number => v !== null).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
