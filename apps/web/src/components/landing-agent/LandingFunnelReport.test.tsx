// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockReport, mockList, mockCampaigns } = vi.hoisted(() => ({
    mockReport: vi.fn(),
    mockList: vi.fn(),
    mockCampaigns: vi.fn(),
}));
vi.mock("@/modules/landing-agent/service/landingFunnelApi", () => ({
    landingFunnelApi: { get: mockReport },
}));
vi.mock("@/modules/landing-agent/service/landingExperimentApi", () => ({
    landingExperimentApi: { list: mockList },
}));
vi.mock("@/modules/landing-agent/service/landingAgentApi", () => ({
    landingAgentApi: { listCampaigns: mockCampaigns },
}));

import LandingFunnelReport from "./LandingFunnelReport";

const report = {
    range: { from: "2026-10-02T00:00:00.000Z", to: "2026-11-01T00:00:00.000Z" },
    filters: { landingPageId: null, variantId: null },
    steps: [
        { key: "visit", label: "Visit", count: 100, dropOffPercent: null, medianSecondsFromPrevious: null },
        { key: "form_start", label: "Form start", count: 40, dropOffPercent: 60, medianSecondsFromPrevious: 120 },
        { key: "lead", label: "Lead", count: 20, dropOffPercent: 50, medianSecondsFromPrevious: 30 },
        { key: "first_contact", label: "First contact", count: 15, dropOffPercent: 25, medianSecondsFromPrevious: 3600 },
    ],
    sideMetrics: { ctaClicks: 30, qualified: 8, medianSecondsLeadToQualified: 600 },
    instagram: { repliesSent: 42 },
};

let container: HTMLDivElement;
let root: Root;

async function flush() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

function rowTexts(): string[] {
    return Array.from(container.querySelectorAll("table:not([aria-label]) tbody tr")).map((tr) => tr.textContent ?? "");
}

describe("LandingFunnelReport", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockReport.mockResolvedValue(report);
        mockList.mockResolvedValue([
            { id: "exp-1", name: "Hero test", variants: [{ id: "v-a", name: "A" }, { id: "v-b", name: "B" }] },
        ]);
        mockCampaigns.mockResolvedValue({
            campaigns: [{ pages: [{ id: "page-a", title: "Spring offer", slug: "spring", status: "published" }] }],
        });
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
    });

    it("loads the last 30 days and shows each step with its drop-off and median time", async () => {
        await act(async () => {
            root.render(<LandingFunnelReport />);
        });
        await flush();

        expect(mockReport).toHaveBeenCalledWith(expect.objectContaining({ from: expect.any(String), to: expect.any(String) }));
        const rows = rowTexts();
        expect(rows).toHaveLength(4);
        expect(rows[0]).toContain("Visit");
        expect(rows[0]).toContain("100");
        expect(rows[1]).toContain("Form start");
        expect(rows[1]).toContain("60% drop-off");
        expect(rows[1]).toContain("2 min");
        expect(rows[3]).toContain("25% drop-off");
        expect(rows[3]).toContain("1 h");
    });

    it("shows where sign-ups came from, and asks again when the grouping changes", async () => {
        mockReport.mockResolvedValue({
            ...report,
            sources: {
                dimension: "utm_source",
                rows: [
                    { source: "google", leads: 9, contacted: 8, replied: 3, meetings: 2, won: 1 },
                    { source: "(none)", leads: 4, contacted: 2, replied: 0, meetings: 0, won: 0 },
                ],
            },
        });
        await act(async () => {
            root.render(<LandingFunnelReport />);
        });
        await flush();

        const sourceRows = Array.from(container.querySelectorAll("table[aria-label='Sign-ups by source'] tbody tr")).map((tr) => tr.textContent ?? "");
        expect(sourceRows).toHaveLength(2);
        expect(sourceRows[0]).toContain("google");
        expect(sourceRows[1]).toContain("(none)");
        expect(rowTexts()).toHaveLength(4);

        const select = container.querySelector("select[aria-label='Group sign-ups by']") as HTMLSelectElement;
        await act(async () => {
            select.value = "utm_campaign";
            select.dispatchEvent(new Event("change", { bubbles: true }));
        });
        await flush();
        expect(mockReport).toHaveBeenLastCalledWith(expect.objectContaining({ groupBy: "utm_campaign" }));
    });

    it("shows the side metrics and the team-wide Instagram count", async () => {
        await act(async () => {
            root.render(<LandingFunnelReport />);
        });
        await flush();

        expect(container.textContent).toContain("CTA anchor clicks");
        expect(container.textContent).toContain("30");
        expect(container.textContent).toContain("Instagram keyword replies sent");
        expect(container.textContent).toContain("42");
    });

    it("refetches for the chosen page and hides the Instagram count, which is not filtered by page", async () => {
        await act(async () => {
            root.render(<LandingFunnelReport />);
        });
        await flush();
        mockReport.mockResolvedValue({ ...report, instagram: null, filters: { landingPageId: "page-a", variantId: null } });

        const pageSelect = container.querySelector("select[aria-label='Page']") as HTMLSelectElement;
        expect(pageSelect).not.toBeNull();
        await act(async () => {
            pageSelect.value = "page-a";
            pageSelect.dispatchEvent(new Event("change", { bubbles: true }));
        });
        await flush();

        expect(mockReport).toHaveBeenLastCalledWith(expect.objectContaining({ landingPageId: "page-a" }));
        expect(container.textContent).not.toContain("Instagram keyword replies sent");
    });

    it("still shows the table when there are no tracked visits but leads came in", async () => {
        mockReport.mockResolvedValue({
            ...report,
            steps: report.steps.map((s, i) => (i === 0 ? { ...s, count: 0, dropOffPercent: null, medianSecondsFromPrevious: null } : s)),
        });
        await act(async () => {
            root.render(<LandingFunnelReport />);
        });
        await flush();

        expect(container.textContent).not.toContain("No visits in this range yet");
        expect(rowTexts()).toHaveLength(4);
    });

    it("shows an empty message when the range has no visits", async () => {
        mockReport.mockResolvedValue({
            ...report,
            steps: report.steps.map((s) => ({ ...s, count: 0, dropOffPercent: null, medianSecondsFromPrevious: null })),
        });
        await act(async () => {
            root.render(<LandingFunnelReport />);
        });
        await flush();

        expect(container.textContent).toContain("No visits in this range yet");
    });
});
