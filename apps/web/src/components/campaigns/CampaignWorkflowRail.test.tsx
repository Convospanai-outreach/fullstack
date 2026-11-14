// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/browserBase", () => ({ getBrowserApiBase: () => "/api/proxy" }));

import { CampaignWorkflowRail } from "./CampaignWorkflowRail";

const steps = [
    { key: "signal", label: "Signal Review", gated: false, rule: "rule 1", done: 8, current: 2, blocked: 0 },
    { key: "approve", label: "Approve Action", gated: true, rule: "rule 5", done: 1, current: 3, blocked: 2 },
];

function mockFetch(response: { ok: boolean; data?: unknown }) {
    const fetchMock = vi.fn(async () => ({ ok: response.ok, json: async () => ({ data: response.data }) }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

describe("CampaignWorkflowRail", () => {
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
        vi.unstubAllGlobals();
    });

    async function render() {
        await act(async () => {
            root.render(<CampaignWorkflowRail campaignId="c1" />);
        });
        await act(async () => {});
    }

    it("shows per-step counts from the campaign's workflow endpoint", async () => {
        const fetchMock = mockFetch({ ok: true, data: { leadCount: 10, capped: false, steps } });
        await render();
        expect(fetchMock).toHaveBeenCalledWith("/api/proxy/campaigns/c1/workflow", { cache: "no-store" });
        expect(container.textContent).toContain("10 leads");
        expect(container.textContent).toContain("8 done · 2 here");
        expect(container.textContent).toContain("1 done · 3 here · 2 blocked");
    });

    it("says when the counts cover only the newest leads", async () => {
        mockFetch({ ok: true, data: { leadCount: 2000, capped: true, steps } });
        await render();
        expect(container.textContent).toContain("Newest 2,000 leads");
    });

    it("renders nothing for a campaign with no leads or a failed request", async () => {
        mockFetch({ ok: true, data: { leadCount: 0, capped: false, steps: [] } });
        await render();
        expect(container.innerHTML).toBe("");
        act(() => root.unmount());
        root = createRoot(container);
        mockFetch({ ok: false });
        await render();
        expect(container.innerHTML).toBe("");
    });
});
