import { describe, expect, it } from "vitest";
import { domainOfEmail, presetForHost, SMTP_PRESETS } from "./smtpPresets";

describe("smtp presets", () => {
    it("finds a preset by the typed host, ignoring case and spaces", () => {
        expect(presetForHost(" SMTP.Gmail.com ")?.spfInclude).toBe("_spf.google.com");
        expect(presetForHost("mail.mycompany.com")).toBeUndefined();
        expect(presetForHost(undefined)).toBeUndefined();
        expect(presetForHost("")).toBeUndefined();
    });

    it("uses implicit TLS only on port 465 and has one preset per host", () => {
        for (const p of SMTP_PRESETS) expect(p.secure).toBe(p.port === 465);
        expect(new Set(SMTP_PRESETS.map((p) => p.host)).size).toBe(SMTP_PRESETS.length);
    });

    it("reads the domain from a From address", () => {
        expect(domainOfEmail("Sales@Acme.com")).toBe("acme.com");
        expect(domainOfEmail("no-at-sign")).toBe("");
        expect(domainOfEmail("trailing@")).toBe("");
        expect(domainOfEmail(null)).toBe("");
    });
});
