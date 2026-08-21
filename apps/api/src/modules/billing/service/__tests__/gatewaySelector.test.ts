import { describe, expect, it } from "vitest";
import { resolveBillingCurrency, resolveGateway } from "../gatewaySelector";

describe("resolveBillingCurrency", () => {
    it("resolves India to INR", () => {
        expect(resolveBillingCurrency("IN")).toBe("INR");
    });

    it("is case-insensitive and trims whitespace", () => {
        expect(resolveBillingCurrency(" in ")).toBe("INR");
    });

    it("resolves EU countries to EUR", () => {
        for (const country of ["DE", "FR", "IT", "ES", "NL", "BE", "AT", "IE", "PT", "FI"]) {
            expect(resolveBillingCurrency(country)).toBe("EUR");
        }
    });

    it("defaults everything else to USD", () => {
        expect(resolveBillingCurrency("US")).toBe("USD");
        expect(resolveBillingCurrency("GB")).toBe("USD");
        expect(resolveBillingCurrency("AE")).toBe("USD");
    });
});

describe("resolveGateway", () => {
    it("routes INR to Razorpay", () => {
        expect(resolveGateway("INR")).toBe("RAZORPAY");
    });

    it("routes USD and EUR to Stripe", () => {
        expect(resolveGateway("USD")).toBe("STRIPE");
        expect(resolveGateway("EUR")).toBe("STRIPE");
    });
});
