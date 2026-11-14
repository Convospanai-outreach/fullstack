// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/browserBase", () => ({ getBrowserApiBase: () => "/api/proxy" }));

import GovernanceLogTab from "./GovernanceLogTab";

const row = { id: "req-1:requested", at: "2026-11-10T10:00:00.000Z", actor: "Asha", action: "Requested approval: send email (lead)", argumentNames: ["body", "subject"], requestId: "req-1", outcome: "Sent for review" };

function mockFetch(response: { ok: boolean; rows?: unknown[] }) {
    const fetchMock = vi.fn(async () => ({ ok: response.ok, json: async () => ({ data: { rows: response.rows } }) }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

describe("GovernanceLogTab", () => {
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
            root.render(<GovernanceLogTab campaignId="c1" />);
        });
        await act(async () => {});
    }

    it("lists who asked, the request id and the outcome", async () => {
        const fetchMock = mockFetch({ ok: true, rows: [row] });
        await render();
        expect(fetchMock).toHaveBeenCalledWith("/api/proxy/campaigns/c1/governance", { cache: "no-store" });
        expect(container.querySelectorAll("tbody tr")).toHaveLength(1);
        expect(container.textContent).toContain("Asha");
        expect(container.textContent).toContain("req-1");
        expect(container.textContent).toContain("body, subject");
        expect(container.textContent).toContain("Sent for review");
    });

    it("always states what the log leaves out", async () => {
        mockFetch({ ok: true, rows: [] });
        await render();
        expect(container.textContent).toContain("not message content or personal data");
        expect(container.textContent).toContain("No approvals or campaign changes have been recorded");
    });

    it("tells a failed load apart from an empty log", async () => {
        mockFetch({ ok: false });
        await render();
        expect(container.textContent).toContain("Couldn't load the governance log");
        expect(container.textContent).not.toContain("No approvals or campaign changes");
    });
});
