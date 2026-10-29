export type LivePrice = { currency: string; amount: number | null; available: boolean };

const CURRENCY_SYMBOL: Record<string, string> = { USD: "$", EUR: "€", INR: "₹" };

// What a plan card shows. An Indian visitor is charged in INR, so while the INR price is not available
// (still loading, or the plans request failed) the card shows no amount instead of the USD list price.
export function displayPrice(opts: {
    isAnnual: boolean;
    country: string;
    live: LivePrice | undefined;
    usdMonthly: number;
    annualPrice: number;
}): { symbol: string; amount: number | null } {
    const { isAnnual, country, live, usdMonthly, annualPrice } = opts;
    if (isAnnual) return { symbol: "$", amount: annualPrice };
    if (live?.available === true && live.amount != null) {
        return { symbol: CURRENCY_SYMBOL[live.currency] || live.currency + " ", amount: Math.round(live.amount / 100) };
    }
    if (country === "IN") return { symbol: "", amount: null };
    return { symbol: "$", amount: usdMonthly };
}
