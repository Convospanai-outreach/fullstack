// Picks which payment gateway and currency a subscription checkout should use,
// based on the billing country the customer already provides at checkout.
// Pattern-matched after DbFactory.getClient(region): a small static selector
// with one safe default, not a general abstraction framework.

export type BillingGateway = "RAZORPAY" | "STRIPE";
export type BillingCurrency = "INR" | "USD" | "EUR";

const EUR_COUNTRIES = new Set(["DE", "FR", "IT", "ES", "NL", "BE", "AT", "IE", "PT", "FI"]);

export function resolveBillingCurrency(country: string): BillingCurrency {
    const normalized = country.trim().toUpperCase();
    if (normalized === "IN") return "INR";
    if (EUR_COUNTRIES.has(normalized)) return "EUR";
    return "USD";
}

export function resolveGateway(currency: BillingCurrency): BillingGateway {
    return currency === "INR" ? "RAZORPAY" : "STRIPE";
}
