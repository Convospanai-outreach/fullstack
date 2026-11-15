import { describe, expect, it } from "vitest";
import { parseSignupMessage } from "../whatsappEmbeddedSignup";

const FINISH = {
    type: "WA_EMBEDDED_SIGNUP",
    event: "FINISH",
    data: { phone_number_id: "109876543210987", waba_id: "102290129340398", business_id: "482171909560307" },
};

describe("parseSignupMessage", () => {
    it("reads the ids from a finished signup", () => {
        expect(parseSignupMessage("https://www.facebook.com", FINISH)).toEqual({
            kind: "finish",
            phoneNumberId: "109876543210987",
            wabaId: "102290129340398",
        });
    });

    it("accepts the message as a JSON string, as Meta sends it", () => {
        expect(parseSignupMessage("https://web.facebook.com", JSON.stringify(FINISH))).toEqual({
            kind: "finish",
            phoneNumberId: "109876543210987",
            wabaId: "102290129340398",
        });
    });

    it("reports a cancelled signup", () => {
        expect(parseSignupMessage("https://www.facebook.com", { type: "WA_EMBEDDED_SIGNUP", event: "CANCEL", data: {} })).toEqual({ kind: "cancel" });
    });

    it("ignores messages from any other origin, so a page cannot fake a signup", () => {
        expect(parseSignupMessage("https://evil.example", FINISH)).toBeNull();
        expect(parseSignupMessage("https://www.facebook.com.evil.example", FINISH)).toBeNull();
    });

    it("ignores unrelated messages and finishes without ids", () => {
        expect(parseSignupMessage("https://www.facebook.com", { type: "something-else" })).toBeNull();
        expect(parseSignupMessage("https://www.facebook.com", "not json")).toBeNull();
        expect(parseSignupMessage("https://www.facebook.com", null)).toBeNull();
        expect(parseSignupMessage("https://www.facebook.com", { type: "WA_EMBEDDED_SIGNUP", event: "FINISH", data: {} })).toBeNull();
    });
});
