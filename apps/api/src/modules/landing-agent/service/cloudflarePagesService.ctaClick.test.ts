// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        landingPage: { findUnique: vi.fn() },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

import { cloudflarePagesService } from "./cloudflarePagesService";

// Runs the page's real inline script (the one the Worker serves) against a jsdom page,
// so the click behavior is tested as shipped rather than by string matching.
async function publishedScript(html: string, fetchMock: ReturnType<typeof vi.fn>): Promise<string> {
    mockPrisma.landingPage.findUnique.mockResolvedValue({
        id: "page-1",
        slug: "guide",
        title: "Guide",
        renderedJson: { html, css: "" },
        campaign: { teamId: "team-1" },
    });
    await cloudflarePagesService.publishPageToCloudflare("page-1");
    const doc = JSON.parse(fetchMock.mock.calls[0][1].body).html as string;
    const scripts = [...doc.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\b[^>]*>/gi)];
    expect(scripts).toHaveLength(1);
    // Put the served body markup on the jsdom page (scripts in innerHTML do not run).
    document.body.innerHTML = new DOMParser().parseFromString(doc, "text/html").body.innerHTML;
    return scripts[0]![1]!;
}

function ctaEventBodies(fetchMock: ReturnType<typeof vi.fn>): Array<{ eventName: string; eventData?: unknown }> {
    return fetchMock.mock.calls
        .filter((call) => String(call[0]).endsWith("/event"))
        .map((call) => JSON.parse(call[1].body))
        .filter((body) => body.eventName === "cta_click");
}

describe("Worker page script: cta_click on a.la-cta anchors", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        process.env["CLOUDFLARE_ACCOUNT_ID"] = "acct-1";
        process.env["CLOUDFLARE_API_TOKEN"] = "token-1";
        process.env["CLOUDFLARE_KV_NAMESPACE_ID"] = "ns-1";
        document.body.innerHTML = "";
        fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "", json: async () => ({}) });
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        document.body.innerHTML = "";
    });

    it("emits cta_click with cta anchor when a.la-cta is clicked, for solid, outline, and nested clicks", async () => {
        const script = await publishedScript(
            '<p><a class="la-cta" href="#lead-form">Get the free guide</a></p>' +
                '<p><a class="la-cta la-cta-outline" href="https://example.com/offer">Yes, show me how</a></p>' +
                '<p><a class="la-cta"><span id="inner">Reserve my seat</span></a></p>',
            fetchMock
        );
        new Function(script)();

        document.querySelector<HTMLAnchorElement>("a.la-cta")!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        document.querySelector<HTMLAnchorElement>("a.la-cta-outline")!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        document.getElementById("inner")!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

        const events = ctaEventBodies(fetchMock);
        expect(events).toHaveLength(3);
        for (const event of events) {
            expect(event.eventData).toEqual({ cta: "anchor" });
        }
    });

    it("does not emit cta_click for ordinary links or for the lead form submit button", async () => {
        const script = await publishedScript('<p><a href="https://example.com/about">About</a></p>', fetchMock);
        new Function(script)();

        document.querySelector<HTMLAnchorElement>("a")!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        expect(ctaEventBodies(fetchMock)).toHaveLength(0);

        // The form's own submit button is a button.la-cta, not an anchor, so the submit
        // path (cta: form_submit) is the only cta_click for a form.
        const form = document.getElementById("la-lead-form") as HTMLFormElement;
        expect(form).not.toBeNull();
        expect(form.querySelector("a.la-cta")).toBeNull();
        form.querySelector<HTMLButtonElement>("button[type=submit]")!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        expect(ctaEventBodies(fetchMock).filter((e) => (e.eventData as { cta?: string })?.cta === "anchor")).toHaveLength(0);
    });

    it("sends the event with keepalive so navigation does not cancel it", async () => {
        const script = await publishedScript('<p><a class="la-cta" href="https://example.com/offer">Claim the offer</a></p>', fetchMock);
        new Function(script)();

        document.querySelector<HTMLAnchorElement>("a.la-cta")!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        const eventCall = fetchMock.mock.calls.find((call) => String(call[0]).endsWith("/event") && String(call[1].body).includes("cta_click"));
        expect(eventCall?.[1].keepalive).toBe(true);
    });
});
