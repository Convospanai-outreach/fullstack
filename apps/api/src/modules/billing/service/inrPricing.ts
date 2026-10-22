import { prisma } from "@/lib/db";

// Plans are priced in USD. Indian buyers pay in INR through Razorpay: the INR plan price is the
// USD price at the day's rate plus 20%, and checkout adds GST on top (computeGstExclusive).

/** Monthly USD list price per Plan.name, in cents. */
export const PLAN_USD_MONTHLY_CENTS: Record<string, number> = {
    PRO: 4900,
    GROWTH: 9900,
    ENTERPRISE: 49900,
};

const INDIA_UPLIFT = 1.2;

// European Central Bank reference rates, published once per working day; no key needed.
const USD_INR_RATE_URL = "https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR";

// A rate outside this range means a bad response, not a real market move: keep the current prices.
const MIN_PLAUSIBLE_RATE = 40;
const MAX_PLAUSIBLE_RATE = 200;

/** Rounds a rupee amount up to the next whole-rupee price ending in 99 (5,174 -> 5,199). */
export function roundUpToNinetyNine(rupees: number): number {
    return Math.ceil((rupees + 1) / 100) * 100 - 1;
}

/** Monthly INR plan price in paise (Plan.monthlyPrice) for a USD price in cents. */
export function inrMonthlyPaise(usdCents: number, usdInrRate: number): number {
    return roundUpToNinetyNine((usdCents / 100) * usdInrRate * INDIA_UPLIFT) * 100;
}

async function fetchUsdInrRate(): Promise<number> {
    const res = await fetch(USD_INR_RATE_URL, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`USD/INR rate request failed with status ${res.status}`);
    const rate = (await res.json())?.rates?.INR;
    if (typeof rate !== "number" || rate < MIN_PLAUSIBLE_RATE || rate > MAX_PLAUSIBLE_RATE) {
        throw new Error(`Implausible USD/INR rate: ${String(rate)}`);
    }
    return rate;
}

/** Re-prices the paid plans in INR from today's USD rate. Throws, changing nothing, if the rate is unavailable. */
export async function refreshInrPlanPrices(): Promise<{ rate: number; prices: Record<string, number> }> {
    const rate = await fetchUsdInrRate();
    const prices: Record<string, number> = {};
    for (const [name, usdCents] of Object.entries(PLAN_USD_MONTHLY_CENTS)) {
        prices[name] = inrMonthlyPaise(usdCents, rate);
        await prisma.plan.updateMany({ where: { name }, data: { monthlyPrice: prices[name] } });
    }
    return { rate, prices };
}
