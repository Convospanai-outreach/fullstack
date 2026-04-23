import { describe, expect, it } from "vitest";
import {
    landingEventPayloadSchema,
    landingLeadPayloadSchema,
} from "../../../api/src/modules/landing-agent/schemas";

describe("landing-agent public payload schemas", () => {
    it("accepts known event names and rejects unknown values", () => {
        const ok = landingEventPayloadSchema.safeParse({
            eventName: "page_view",
            sessionId: "sess-1",
        });
        expect(ok.success).toBe(true);

        const bad = landingEventPayloadSchema.safeParse({
            eventName: "page_hover",
        });
        expect(bad.success).toBe(false);
    });

    it("validates lead payload shape", () => {
        const ok = landingLeadPayloadSchema.safeParse({
            email: "ops@example.com",
            name: "Ops User",
            utmSource: "linkedin",
            website: "",
        });
        expect(ok.success).toBe(true);

        const bad = landingLeadPayloadSchema.safeParse({
            email: "not-an-email",
        });
        expect(bad.success).toBe(false);
    });
});
