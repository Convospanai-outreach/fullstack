import { describe, expect, it } from "vitest";
import { buildTrackingScript, normalizeTracking, pageTrackingSchema } from "./tracking";

describe("pageTrackingSchema", () => {
    it("accepts well-formed IDs, trimming and upper-casing them", () => {
        const parsed = pageTrackingSchema.parse({ ga4Id: " g-abc1234 ", gtmId: "gtm-ab12cd", hotjarId: "1234567" });
        expect(parsed).toEqual({ ga4Id: "G-ABC1234", gtmId: "GTM-AB12CD", hotjarId: "1234567" });
    });

    it("accepts empty and missing fields", () => {
        expect(pageTrackingSchema.safeParse({ ga4Id: "", gtmId: null }).success).toBe(true);
        expect(pageTrackingSchema.safeParse({}).success).toBe(true);
    });

    it.each([
        ["ga4Id", "UA-12345-1"],
        ["ga4Id", 'G-ABC");alert(1);("'],
        ["gtmId", "GTM-<script>"],
        ["gtmId", "G-ABC1234"],
        ["hotjarId", "12ab"],
        ["hotjarId", "1;alert(1)"],
    ])("rejects %s = %s", (field, value) => {
        expect(pageTrackingSchema.safeParse({ [field]: value }).success).toBe(false);
    });
});

describe("normalizeTracking", () => {
    it("drops empty values and returns null when nothing is set", () => {
        expect(normalizeTracking({ ga4Id: "", gtmId: null, hotjarId: undefined })).toBeNull();
        expect(normalizeTracking(null)).toBeNull();
        expect(normalizeTracking({ ga4Id: "G-ABC1234", hotjarId: "" })).toEqual({ ga4Id: "G-ABC1234" });
    });

    it("ignores stored values that no longer pass validation", () => {
        expect(normalizeTracking({ ga4Id: "not-an-id" })).toBeNull();
    });
});

describe("buildTrackingScript", () => {
    it("is empty without tracking", () => {
        expect(buildTrackingScript(null)).toBe("");
        expect(buildTrackingScript({ ga4Id: "" })).toBe("");
    });

    it("loads only the configured vendors", () => {
        const script = buildTrackingScript({ ga4Id: "G-ABC1234" });
        expect(script).toContain('"https://www.googletagmanager.com/gtag/js?id=" + "G-ABC1234"');
        expect(script).toContain('window.gtag("config", "G-ABC1234")');
        expect(script).not.toContain("gtm.js");
        expect(script).not.toContain("hotjar");
    });

    it("loads all three when all are set", () => {
        const script = buildTrackingScript({ ga4Id: "G-ABC1234", gtmId: "GTM-AB12CD", hotjarId: "1234567" });
        expect(script).toContain('"https://www.googletagmanager.com/gtm.js?id=" + "GTM-AB12CD"');
        expect(script).toContain("gtag/js?id=");
        expect(script).toContain("hjid: 1234567");
        expect(script).toContain('"https://static.hotjar.com/c/hotjar-"');
    });

    it("never places an invalid stored value in code", () => {
        expect(buildTrackingScript({ ga4Id: 'G-1");alert(1);//' })).toBe("");
    });
});
