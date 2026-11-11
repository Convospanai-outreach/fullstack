import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockTrackEvent } = vi.hoisted(() => ({ mockTrackEvent: vi.fn() }));

vi.mock("../service", () => ({
    landingAgentService: { trackEventBySlug: mockTrackEvent },
}));
vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ authorizeRole: vi.fn(), TeamRole: {} }));

import { postPublicEvent } from "./handlers";

function eventRequest(headers: Record<string, string>) {
    return new Request("http://localhost/landing-agent/public/promo/event", {
        method: "POST",
        headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0 Chrome/120.0", ...headers },
        body: JSON.stringify({ eventName: "page_view", sessionId: "s1" }),
    });
}

// Do Not Track and Global Privacy Control are passed to the service, which then records no A/B variant.
describe("postPublicEvent privacy signals", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockTrackEvent.mockResolvedValue({ id: "ev-1" });
    });

    it("passes doNotTrack when DNT is 1", async () => {
        await postPublicEvent(eventRequest({ dnt: "1" }), { params: Promise.resolve({ slug: "promo" }) });
        expect(mockTrackEvent.mock.calls[0][0].doNotTrack).toBe(true);
    });

    it("passes doNotTrack when Sec-GPC is 1", async () => {
        await postPublicEvent(eventRequest({ "sec-gpc": "1" }), { params: Promise.resolve({ slug: "promo" }) });
        expect(mockTrackEvent.mock.calls[0][0].doNotTrack).toBe(true);
    });

    it("passes doNotTrack false without the signals", async () => {
        await postPublicEvent(eventRequest({}), { params: Promise.resolve({ slug: "promo" }) });
        expect(mockTrackEvent.mock.calls[0][0].doNotTrack).toBe(false);
    });
});
