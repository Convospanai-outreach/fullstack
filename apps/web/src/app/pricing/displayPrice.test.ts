import { describe, expect, it } from "vitest";
import { displayPrice } from "./displayPrice";

const base = { isAnnual: false, usdMonthly: 49, annualPrice: 39 };

describe("displayPrice", () => {
    it("shows the live INR price when it is available", () => {
        const live = { currency: "INR", amount: 500000, available: true };
        expect(displayPrice({ ...base, country: "IN", live })).toEqual({ symbol: "₹", amount: 5000 });
    });

    it("does not show the USD fallback to an Indian visitor while the INR price is missing", () => {
        expect(displayPrice({ ...base, country: "IN", live: undefined }).amount).toBeNull();
        expect(displayPrice({ ...base, country: "IN", live: { currency: "INR", amount: null, available: false } }).amount).toBeNull();
    });

    it("keeps the USD list price for other countries", () => {
        expect(displayPrice({ ...base, country: "US", live: undefined })).toEqual({ symbol: "$", amount: 49 });
    });

    it("keeps the static annual figure", () => {
        expect(displayPrice({ ...base, isAnnual: true, country: "IN", live: undefined })).toEqual({ symbol: "$", amount: 39 });
    });
});
