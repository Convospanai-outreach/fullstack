// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockListCampaigns } = vi.hoisted(() => ({ mockListCampaigns: vi.fn() }));
vi.mock("@/modules/landing-agent/service/landingAgentApi", () => ({ landingAgentApi: { listCampaigns: mockListCampaigns } }));

import LandingPageList from "./LandingPageList";

const campaign = (autoReplies: { total: number; active: number } | undefined) => ({
    id: "campaign-1",
    name: "Free guide",
    updatedAt: "2026-10-30T10:00:00Z",
    pages: [{ id: "page-1", slug: "guide", title: "Free guide", status: "published", updatedAt: "2026-10-30T10:00:00Z", autoReplies }],
    _count: { wireframeOptions: 0, leads: 2 },
});

async function renderList(container: HTMLDivElement, root: Root) {
    await act(async () => {
        root.render(<LandingPageList />);
    });
    await act(async () => {});
}

describe("LandingPageList auto-reply usage", () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        mockListCampaigns.mockReset();
    });

    it("shows how many keyword auto-replies link to each page", async () => {
        mockListCampaigns.mockResolvedValue({ campaigns: [campaign({ total: 3, active: 1 })], liveDomain: null });

        await renderList(container, root);

        expect(container.textContent).toContain("Used by 3 auto-replies");
    });

    it("uses the singular for one auto-reply", async () => {
        mockListCampaigns.mockResolvedValue({ campaigns: [campaign({ total: 1, active: 1 })], liveDomain: null });

        await renderList(container, root);

        expect(container.textContent).toContain("Used by 1 auto-reply");
        expect(container.textContent).not.toContain("Used by 1 auto-replies");
    });

    it("says no auto-reply uses the page when the count is zero", async () => {
        mockListCampaigns.mockResolvedValue({ campaigns: [campaign({ total: 0, active: 0 })], liveDomain: null });

        await renderList(container, root);

        expect(container.textContent).toContain("Used by 0 auto-replies");
    });
});
