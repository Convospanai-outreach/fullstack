import { describe, expect, it } from "vitest";
// The Cloudflare worker has no test runner of its own; its fetch handler only
// needs Request/Response/Headers, which Node provides, so it is exercised here.
import worker from "../../../../../../workers/landing-pages/src/index";

function makeKv(entries: Record<string, unknown>) {
    return {
        API_ORIGIN: "https://api.example.test",
        DEFAULT_HOST: "pages.example.test",
        LANDING_PAGES: { get: async (key: string) => entries[key] ?? null },
    } as any;
}

const owned = { "host:go.example.com": "team-1" };

describe("landing-pages worker thank-you page", () => {
    it("shows the form's success message and a follow button for a validated handle", async () => {
        const env = makeKv({ ...owned, "page:spring": { html: "<p>x</p>", teamId: "team-1", successMessage: "Thanks!", instagramHandle: "brand.shop" } });
        const res = await worker.fetch(new Request("https://go.example.com/spring/thank-you"), env);
        const body = await res.text();

        expect(body).toContain("<p>Thanks!</p>");
        expect(body).toContain('href="https://www.instagram.com/brand.shop/"');
        expect(body).toContain("Follow us on Instagram");
    });

    it("keeps today's text and no button when the page has no config", async () => {
        const env = makeKv({ ...owned, "page:spring": { html: "<p>x</p>", teamId: "team-1" } });
        const res = await worker.fetch(new Request("https://go.example.com/spring/thank-you"), env);
        const body = await res.text();

        expect(body).toContain("Your submission has been received.");
        expect(body).not.toContain("instagram");
    });

    it("never builds a link from a handle that fails the rules", async () => {
        for (const instagramHandle of ["@brand", "a/b", "x".repeat(31), "../x", "brand?x"]) {
            const env = makeKv({ ...owned, "page:spring": { html: "<p>x</p>", teamId: "team-1", instagramHandle } });
            const res = await worker.fetch(new Request("https://go.example.com/spring/thank-you"), env);
            expect(await res.text()).not.toContain("instagram.com");
        }
    });

    it("shows a Book a call button only for a saved https link, escaped", async () => {
        const good = makeKv({ ...owned, "page:spring": { html: "<p>x</p>", teamId: "team-1", bookingUrl: "https://cal.example.com/intro?a=1&b=\"2\"" } });
        const goodBody = await (await worker.fetch(new Request("https://go.example.com/spring/thank-you"), good)).text();
        expect(goodBody).toContain("Book a call");
        expect(goodBody).toContain('href="https://cal.example.com/intro?a=1&amp;b=&quot;2&quot;"');

        for (const bookingUrl of ["http://cal.example.com/intro", "javascript:alert(1)", "https://x.example.com/\"><script>"]) {
            const env = makeKv({ ...owned, "page:spring": { html: "<p>x</p>", teamId: "team-1", bookingUrl } });
            const body = await (await worker.fetch(new Request("https://go.example.com/spring/thank-you"), env)).text();
            expect(body).not.toContain("Book a call");
            expect(body).not.toContain("<script>");
        }
    });

    it("shows no config on a page the host does not own", async () => {
        const env = makeKv({ "host:go.example.com": "team-2", "page:spring": { html: "<p>x</p>", teamId: "team-1", successMessage: "Thanks!", instagramHandle: "brand" } });
        const res = await worker.fetch(new Request("https://go.example.com/spring/thank-you"), env);
        const body = await res.text();

        expect(body).not.toContain("Thanks!");
        expect(body).not.toContain("instagram");
    });
});
