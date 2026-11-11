// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockList, mockCampaigns, mockResults, mockAct } = vi.hoisted(() => ({
    mockList: vi.fn(),
    mockCampaigns: vi.fn(),
    mockResults: vi.fn(),
    mockAct: vi.fn(),
}));
vi.mock("@/modules/landing-agent/service/landingExperimentApi", () => ({
    landingExperimentApi: { list: mockList, results: mockResults, act: mockAct, create: vi.fn(), pickWinner: vi.fn() },
}));
vi.mock("@/modules/landing-agent/service/landingAgentApi", () => ({
    landingAgentApi: { listCampaigns: mockCampaigns },
}));

import LandingExperimentPanel from "./LandingExperimentPanel";

const experiment = {
    id: "exp-1",
    name: "Hero test",
    slug: "spring",
    status: "running",
    winnerPageId: null,
    startedAt: "2026-11-01T00:00:00Z",
    variants: [
        { id: "v-a", name: "A", landingPageId: "page-a", weight: 50 },
        { id: "v-b", name: "B", landingPageId: "page-b", weight: 50 },
    ],
};

async function flush(root: Root, node: React.ReactElement) {
    await act(async () => root.render(node));
    await act(async () => {});
}

describe("LandingExperimentPanel", () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        mockList.mockResolvedValue([experiment]);
        mockCampaigns.mockResolvedValue({
            campaigns: [
                {
                    id: "c1",
                    pages: [
                        { id: "page-a", title: "Offer A", slug: "offer-a", status: "published" },
                        { id: "page-b", title: "Offer B", slug: "offer-b", status: "published" },
                    ],
                },
            ],
        });
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        vi.clearAllMocks();
    });

    it("lists the test with its status and a Pause button while running", async () => {
        await flush(root, <LandingExperimentPanel />);

        expect(container.textContent).toContain("Hero test");
        expect(container.textContent).toContain("Running");
        expect(container.textContent).toContain("Pause");
    });

    it("shows the results and a plain-language verdict when asked", async () => {
        mockResults.mockResolvedValue({
            experimentId: "exp-1",
            status: "running",
            variants: {
                A: { visitors: 1000, formStarts: 0, leads: 100, conversionRate: 0.1 },
                B: { visitors: 1000, formStarts: 0, leads: 130, conversionRate: 0.13 },
            },
            verdict: { status: "clear_winner", winner: "B", readiness: "ready", difference: 0.03, confidence: 96.45, rateA: 0.1, rateB: 0.13 },
        });
        await flush(root, <LandingExperimentPanel />);

        const showResults = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Show results");
        expect(showResults).toBeDefined();
        await act(async () => showResults!.click());
        await act(async () => {});

        expect(mockResults).toHaveBeenCalledWith("exp-1");
        expect(container.textContent).toContain("13.0%");
        expect(container.textContent).toContain("Variant B is ahead with 96% confidence");
    });
});
