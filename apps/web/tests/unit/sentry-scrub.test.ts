import { describe, expect, it } from "vitest";
import { redactText, scrubBreadcrumb, scrubEvent, scrubRecordingEvent } from "../../src/lib/sentryScrub";

// Same cases as apps/api/src/lib/__tests__/sentry.test.ts: both apps redact the same way.
describe("sentryScrub", () => {
    const SECRET = "x".repeat(20) + "Y".repeat(20);
    const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl";

    it("redacts emails, phone numbers, tokens and query strings from free text", () => {
        const text = redactText(
            `send to jane.doe@example.com / +91 98765 43210 failed: Bearer abc.def-ghi key ${SECRET} jwt ${JWT} ` +
                `at https://api.example.com/v1/verify?token=abc&email=jane%40example.com and /invite?code=XYZ123`,
        );
        expect(text).not.toMatch(/jane|98765|abc\.def|XYZ123|eyJ/);
        expect(text).not.toContain(SECRET);
        expect(text).toContain("[email]");
        expect(text).toContain("[phone]");
        expect(text).toContain("Bearer [redacted]");
        expect(text).toContain("https://api.example.com/v1/verify?[redacted]");
        expect(text).toContain("/invite?code=[redacted]");
    });

    it("leaves ids, UUIDs and timestamps readable", () => {
        const text = "lead 3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b team cmf4x2k9a0001abcd at 2026-10-26T10:00:00.000Z (1793000000000) status 503";
        expect(redactText(text)).toBe(text);
    });

    it("scrubs the message, exception text, frame variables, extras, tags and breadcrumbs of an event", () => {
        const event = scrubEvent({
            message: "Lead jane@example.com bounced",
            request: { method: "POST", url: "https://x.test/api/leads?email=jane@example.com", headers: { cookie: "s=1" }, data: "{}" },
            exception: { values: [{ type: "Error", value: "Duplicate +1 415 555 0100", stacktrace: { frames: [{ function: "f", vars: { lead: { email: "jane@example.com" } } }] } }] },
            extra: { lead: { email: "jane@example.com", attempts: 2 } },
            tags: { recipient: "jane@example.com", route: "/api/leads" },
            breadcrumbs: [{ category: "http", message: "GET https://x.test/a?token=abc", data: { url: "https://x.test/a?token=abc", from: "/invite?code=1" } }],
        } as any) as any;
        expect(JSON.stringify(event)).not.toMatch(/jane|415 555|token=abc|code=1|cookie/);
        expect(event.request).toEqual({ method: "POST", url: "https://x.test/api/leads" });
        expect(event.exception.values[0].stacktrace.frames[0]).toEqual({ function: "f" });
        expect(event.extra.lead.attempts).toBe(2);
        expect(event.tags.route).toBe("/api/leads");
        expect(event.breadcrumbs[0].data).toEqual({ url: "https://x.test/a", from: "/invite" });
    });

    it("drops console breadcrumbs and scrubs the rest", () => {
        expect(scrubBreadcrumb({ category: "console", message: "jane@example.com" })).toBeNull();
        expect(scrubBreadcrumb({ category: "fetch", message: "to jane@example.com", data: { url: "/api/x?key=1" } })).toEqual({
            category: "fetch",
            message: "to [email]",
            data: { url: "/api/x" },
        });
    });

    it("redacts URLs in session replay custom events", () => {
        const event = scrubRecordingEvent({ type: 5, timestamp: 1, data: { tag: "performanceSpan", payload: { description: "https://x.test/invite?token=abc", data: { email: "jane@example.com" } } } });
        expect(JSON.stringify(event)).not.toMatch(/token=abc|jane/);
    });
});
