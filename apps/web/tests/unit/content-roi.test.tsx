// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ContentRoi, type ContentRoiReport } from "@/components/content/ContentRoi";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const report = (over: Partial<ContentRoiReport> = {}): ContentRoiReport => ({
    days: 30,
    mainCurrency: "INR",
    posts: [
        {
            id: "post-p",
            excerpt: "Free guide drop",
            funnelStage: "TOFU",
            channels: [{ platform: "INSTAGRAM", handle: "@maker" }],
            publishedAt: "2026-09-20T10:00:00Z",
            visits: 12,
            optIns: 3,
            purchases: 1,
            revenue: [{ currency: "INR", amount: 49900 }],
        },
    ],
    stages: [
        { from: "TOFU", to: "MOFU", reached: 4, converted: 1, rate: 0.25 },
        { from: "MOFU", to: "BOFU", reached: 0, converted: 0, rate: null },
        { from: "BOFU", to: "POST", reached: 1, converted: 1, rate: 1 },
    ],
    unattributed: { purchases: 2, revenue: [{ currency: "USD", amount: 1000 }] },
    totalRevenue: [{ currency: "INR", amount: 49900 }, { currency: "USD", amount: 1000 }],
    ...over,
});

let root: Root;
let container: HTMLDivElement;
const fetchMock = vi.fn();

async function render() {
    await act(async () => {
        root.render(
            <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
                <ContentRoi />
            </SWRConfig>,
        );
    });
    for (let i = 0; i < 3; i++) await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
}

describe("Content ROI", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = fetchMock as any;
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
    });

    it("says the feature is off on a 404", async () => {
        fetchMock.mockResolvedValue(json(404, { error: "Not found" }));
        await render();
        expect(container.textContent).toContain("isn't on for this workspace");
    });

    it("shows each post's numbers, stage conversion and unattributed sales", async () => {
        fetchMock.mockResolvedValue(json(200, report()));
        await render();
        const text = container.textContent ?? "";
        expect(fetchMock).toHaveBeenCalledWith("/api/proxy/content/roi?days=30", expect.anything());
        expect(text).toContain("Free guide drop");
        expect(text).toContain("499 INR");
        expect(text).toContain("25%");
        expect(text).toContain("1 of 4 leads");
        expect(text).toContain("2 purchases (10 USD) couldn't be traced");
    });

    it("switches the window", async () => {
        fetchMock.mockResolvedValue(json(200, report()));
        await render();
        const ninety = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "90 days")!;
        await act(async () => {
            ninety.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });
        for (let i = 0; i < 3; i++) await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
        expect(fetchMock).toHaveBeenCalledWith("/api/proxy/content/roi?days=90", expect.anything());
    });
});
