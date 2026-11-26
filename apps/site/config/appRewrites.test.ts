import { describe, expect, it } from "vitest";
import { appRewriteSources } from "./appRewrites.mjs";

describe("appRewriteSources", () => {
    // Links in emails sent before the public domain moved still point at it, so the site has to hand
    // them to the app instead of returning 404.
    it.each([
        "/api/track/open/:trackingId",
        "/api/track/click/:trackingKey",
        "/api/email/unsubscribe/:trackingId",
    ])("forwards the email link %s to the app", (source) => {
        expect(appRewriteSources).toContain(source);
    });

    it("keeps the form and discovery endpoints", () => {
        expect(appRewriteSources).toEqual(expect.arrayContaining(["/api/contact", "/api/careers/apply", "/.well-known/api-catalog"]));
    });
});
