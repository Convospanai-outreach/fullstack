// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/dashboard/DomainHealthBanner", () => ({ DomainHealthBanner: () => null }));
vi.mock("@/components/dashboard/NeedsYou", () => ({ NeedsYou: () => null }));
vi.mock("@/components/dashboard/GoalProgress", () => ({ GoalProgress: () => null }));
vi.mock("@/components/dashboard/KPIRow", () => ({ KPIRow: () => null }));
vi.mock("@/components/dashboard/WorkflowSection", () => ({ WorkflowSection: () => <div data-testid="workflow" /> }));
vi.mock("@/components/dashboard/BottomGrid", () => ({ BottomGrid: () => null }));
vi.mock("@/components/dashboard/PipelineTrendCard", () => ({ PipelineTrendCard: () => null }));
vi.mock("@/components/dashboard/RecentLeadsCard", () => ({ RecentLeadsCard: () => null }));
vi.mock("@/components/dashboard/LeadDrilldown", () => ({ LeadDrilldown: () => null }));
vi.mock("@/lib/api/browserBase", () => ({ getBrowserApiUrl: (path: string) => `/api/proxy${path}` }));

import DashboardPage from "./page";

const summary = {
    kpis: { meetingsBooked: 0, meetingsDelta: 0, activeLeads: 0, draftsReady: 0, draftsPendingSend: 0, openRatePct: 0, openRateDelta: 0 },
    workflow: { leadsImported: false, leadsCount: 0, draftsGenerated: false, draftsCount: 0, followUpsReviewed: false, followUpsCount: 0, pendingSendCount: 0 },
    recentActivity: [],
    recentLeads: [],
    pipelineTrend: [],
};

function mockFetch(status: { ok: boolean; body?: unknown }) {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
        if (url === "/api/dashboard/summary") return { ok: true, json: async () => summary };
        if (url === "/api/proxy/setup/status") return { ok: status.ok, json: async () => status.body };
        throw new Error(`unexpected fetch ${url}`);
    }));
}

describe("Dashboard launch readiness", () => {
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
            root.render(<DashboardPage />);
        });
        await act(async () => {});
    }

    it("shows the same percentage the setup wizard reports", async () => {
        mockFetch({ ok: true, body: { completionPercent: 36 } });
        await render();
        expect(container.textContent).toContain("Launch readiness · 36% complete");
    });

    it("shows no percentage when setup status is unavailable, but keeps the workflow visible", async () => {
        mockFetch({ ok: false });
        await render();
        expect(container.textContent).not.toContain("Launch readiness");
        expect(container.querySelector('[data-testid="workflow"]')).not.toBeNull();
    });

    it("shows the rest of the dashboard without waiting for setup status", async () => {
        vi.stubGlobal("fetch", vi.fn(async (url: string) => {
            if (url === "/api/dashboard/summary") return { ok: true, json: async () => summary };
            return new Promise(() => undefined); // setup status never answers
        }));
        await render();
        expect(container.querySelector('[data-testid="workflow"]')).not.toBeNull();
        expect(container.textContent).not.toContain("Launch readiness");
    });

    it("hides the setup section once setup is complete", async () => {
        mockFetch({ ok: true, body: { completionPercent: 100 } });
        await render();
        expect(container.textContent).not.toContain("Launch readiness");
        expect(container.querySelector('[data-testid="workflow"]')).toBeNull();
    });
});
