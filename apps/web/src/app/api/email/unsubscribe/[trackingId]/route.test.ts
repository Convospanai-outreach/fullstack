import { describe, expect, it } from "vitest";
import { GET } from "./route";

function paramsFor(trackingId: string) {
    return { params: Promise.resolve({ trackingId }) };
}

describe("GET /api/email/unsubscribe/[trackingId]", () => {
    it("HTML-escapes a trackingId that attempts to break out of the form action attribute", async () => {
        const malicious = '"><script>alert(1)</script>';
        const res = await GET(new Request("http://localhost") as any, paramsFor(malicious));
        const html = await res.text();

        expect(html).not.toContain(malicious);
        expect(html).not.toContain("<script>alert(1)</script>");
    });

    it("still renders a working unsubscribe form action for a normal trackingId", async () => {
        const res = await GET(new Request("http://localhost") as any, paramsFor("abc-123"));
        const html = await res.text();

        expect(html).toContain('action="/api/email/unsubscribe/abc-123"');
    });
});
