import { describe, expect, it } from "vitest";
import { consentChannels } from "./consentChannels";

const row = (channel: string, status: string, ms: number, purpose = "MARKETING_AND_SUPPORT") => ({ channel, status, purpose, grantedAt: new Date(ms) });

describe("consentChannels", () => {
    it("always lists email, WhatsApp and phone, with NONE when there is no row", () => {
        expect(consentChannels([])).toEqual([
            { channel: "EMAIL", status: "NONE" },
            { channel: "WHATSAPP", status: "NONE" },
            { channel: "PHONE", status: "NONE" },
        ]);
    });

    it("shows the newest row per channel, so a later revocation wins", () => {
        const out = consentChannels([row("EMAIL", "GRANTED", 1), row("EMAIL", "REVOKED", 2, "REVOCATION"), row("WHATSAPP", "GRANTED", 1)]);

        expect(out).toEqual([
            { channel: "EMAIL", status: "REVOKED" },
            { channel: "WHATSAPP", status: "GRANTED" },
            { channel: "PHONE", status: "NONE" },
        ]);
    });

    it("is not fooled by row order", () => {
        const out = consentChannels([row("EMAIL", "REVOKED", 2, "REVOCATION"), row("EMAIL", "GRANTED", 1)]);

        expect(out[0]).toEqual({ channel: "EMAIL", status: "REVOKED" });
    });

    it("does not count a WhatsApp reply window as consent", () => {
        expect(consentChannels([row("WHATSAPP", "GRANTED", 1, "INBOUND_REPLY")])[1]).toEqual({ channel: "WHATSAPP", status: "NONE" });
    });

    it("shows an expired or revoked-in-place row as revoked, never granted", () => {
        expect(consentChannels([row("EMAIL", "EXPIRED", 1)])[0]).toEqual({ channel: "EMAIL", status: "REVOKED" });
    });
});
