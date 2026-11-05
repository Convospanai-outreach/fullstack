import { describe, expect, it } from "vitest";
import { resolveMessageTokens } from "./messageTokens";

const lead = { fullName: "Asha Rao", company: "Acme", jobTitle: "CTO", location: null, customFields: { plan: "Pro", seats: 5 } };

describe("resolveMessageTokens", () => {
    it("fills known fields and custom properties, ignoring case and spacing", () => {
        const r = resolveMessageTokens("Hi {{ firstName }} {{LASTNAME}} at {{companyName}}, {{jobTitle}}. Plan {{property.plan}}, {{property.seats}} seats.", lead);
        expect(r.text).toBe("Hi Asha Rao at Acme, CTO. Plan Pro, 5 seats.");
        expect(r.missing).toEqual([]);
    });

    it("uses a fallback the sender wrote in the step without asking", () => {
        const r = resolveMessageTokens("Hi {{firstName}} from {{location|your city}}", lead);
        expect(r.text).toBe("Hi Asha from your city");
        expect(r.missing).toEqual([]);
    });

    it("reports an empty field with a suggested fallback and leaves the text unsent-ready", () => {
        const r = resolveMessageTokens("Hi {{firstName}}, how is {{location}}?", { ...lead, fullName: null });
        expect(r.missing.map((m) => [m.token, m.reason, m.suggestedFallback])).toEqual([
            ["firstName", "empty", "there"],
            ["location", "empty", "your area"],
        ]);
        expect(r.missing[0]!.advice).toContain("{{firstName|there}}");
        expect(r.text).toBe("Hi {{firstName}}, how is {{location}}?");
    });

    it("sends the suggested fallback only when the sender approved it", () => {
        const r = resolveMessageTokens("Hi {{firstName}}", { fullName: null }, { useSuggestedFallbacks: true });
        expect(r.text).toBe("Hi there");
        expect(r.missing).toHaveLength(1);
    });

    it("has no suggestion for a missing property or last name, so approval cannot paper over it", () => {
        const r = resolveMessageTokens("{{property.industry}} {{lastName}}", { fullName: "Asha" }, { useSuggestedFallbacks: true });
        expect(r.missing.map((m) => m.suggestedFallback)).toEqual([null, null]);
        expect(r.text).toBe("{{property.industry}} {{lastName}}");
    });

    it("flags a mistyped field and suggests the right one, and never approves it away", () => {
        const r = resolveMessageTokens("Hi {{firstNam}} and {{foo}}", lead, { useSuggestedFallbacks: true });
        expect(r.missing.map((m) => [m.token, m.reason])).toEqual([
            ["firstNam", "unknown"],
            ["foo", "unknown"],
        ]);
        expect(r.missing[0]!.advice).toContain("{{firstName}}");
        expect(r.text).toBe("Hi {{firstNam}} and {{foo}}");
    });

    it("lists each missing token once", () => {
        const r = resolveMessageTokens("{{firstName}} {{firstName}}", { fullName: null });
        expect(r.missing).toHaveLength(1);
    });

    it("escapes lead data in an HTML body but not in a subject", () => {
        const odd = { fullName: 'A<b> & "Q"' };
        expect(resolveMessageTokens("{{fullName}}", odd, { html: true }).text).toBe("A&lt;b&gt; &amp; &quot;Q&quot;");
        expect(resolveMessageTokens("{{fullName}}", odd).text).toBe('A<b> & "Q"');
    });
});
