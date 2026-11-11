import { describe, expect, it } from "vitest";
import worker from "./index";

const CONNECTED = "go.brand.test";

function envWith(kv: Record<string, unknown>) {
    return {
        LANDING_PAGES: { get: async (key: string) => (key in kv ? kv[key] : null) },
        API_ORIGIN: "https://api.test",
        DEFAULT_HOST: "pages.test",
    } as never;
}

async function deletionPage(host: string, kv: Record<string, unknown>) {
    const res = await worker.fetch(new Request(`https://${host}/offer/data-deletion`), envWith(kv));
    return { status: res.status, body: await res.text(), csp: res.headers.get("Content-Security-Policy") ?? "" };
}

const page = {
    "page:offer": {
        html: "<main>Offer</main>",
        teamId: "team-1",
        deletionSteps: "Step <b>1</b>: email us\nStep 2: we delete within 30 days",
        contactEmail: "privacy@brand.test",
    },
    [`host:${CONNECTED}`]: "team-1",
};

describe("Worker data-deletion page", () => {
    it("shows the page's steps escaped and the contact email", async () => {
        const { status, body } = await deletionPage(CONNECTED, page);
        expect(status).toBe(200);
        expect(body).toContain("Step &lt;b&gt;1&lt;/b&gt;: email us");
        expect(body).not.toContain("<b>1</b>");
        expect(body).toContain('href="mailto:privacy@brand.test"');
    });

    it("keeps the steps' line breaks", async () => {
        const { body } = await deletionPage(CONNECTED, page);
        expect(body).toContain("white-space:pre-line");
    });

    it("falls back to a neutral message when the page has no steps", async () => {
        const { status, body } = await deletionPage(CONNECTED, { "page:offer": { html: "<main/>", teamId: "team-1" }, [`host:${CONNECTED}`]: "team-1" });
        expect(status).toBe(200);
        expect(body).toContain("contact the site owner");
        expect(body).not.toContain("mailto:");
    });

    it("does not show a stored page to a connected domain owned by another team", async () => {
        const { body } = await deletionPage(CONNECTED, { ...page, [`host:${CONNECTED}`]: "team-2" });
        expect(body).not.toContain("Step");
        expect(body).toContain("contact the site owner");
    });

    it("shows the steps on the shared host, which may serve any team's page", async () => {
        const { body } = await deletionPage("pages.test", page);
        expect(body).toContain("Step &lt;b&gt;1&lt;/b&gt;");
    });

    it("leaves out a contact link that is not an email address", async () => {
        const hostile = { "page:offer": { html: "<main/>", teamId: "team-1", deletionSteps: "Ask us", contactEmail: `x"><script>alert(1)</script>` }, [`host:${CONNECTED}`]: "team-1" };
        const { body } = await deletionPage(CONNECTED, hostile);
        expect(body).toContain("Ask us");
        expect(body).not.toContain("<script>");
        expect(body).not.toContain("mailto:");
    });

    it("sends the same security headers as the thank-you page", async () => {
        const { csp } = await deletionPage(CONNECTED, page);
        expect(csp).toContain("frame-ancestors 'none'");
    });

    it("answers an unknown page with the neutral message", async () => {
        const { body } = await deletionPage(CONNECTED, {});
        expect(body).toContain("contact the site owner");
    });
});
