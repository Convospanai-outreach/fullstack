// CSV formula-injection guard (OWASP), mirrored from apps/api/src/lib/csvStream.ts
// for the exports apps/web builds in the browser (roadmap 3.5 / S-14).
//
// No `m` flag and no trailing `.*$`, so a multi-line cell like "=1+1\nx" still matches.
const CSV_FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** Prefixes a formula-triggering cell with `'` so spreadsheets treat it as text.
 *  Apply before quote-escaping, and quote the cell. */
export function neutralizeCsvFormula(value: string): string {
    return CSV_FORMULA_PREFIX.test(value) ? `'${value}` : value;
}
