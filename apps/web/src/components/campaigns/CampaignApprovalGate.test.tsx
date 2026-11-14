// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("@/lib/api/browserBase", () => ({ getBrowserApiBase: () => "/api/proxy" }));

import { CampaignApprovalGate } from "./CampaignApprovalGate";

const request = {
    requestId: "req-1", actionType: "MESSAGE_SEND", tier: "QUEUED", reason: null, requestedBy: "Asha",
    createdAt: "2026-11-14T10:00:00.000Z", expiresAt: null, draft: { subject: "Intro", body: "Hello there" },
};

describe("CampaignApprovalGate", () => {
    let container: HTMLDivElement;
    let root: Root;
    let fetchMock: ReturnType<typeof vi.fn>;
    let pending: unknown[];
    let canDecide: boolean;
    let decisionOk: boolean;

    beforeEach(() => {
        pending = [request];
        canDecide = true;
        decisionOk = true;
        fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
            if (url === "/api/proxy/campaigns/c1/approvals") return { ok: true, json: async () => ({ data: { canDecide, requests: pending } }) };
            if (url === "/api/approvals/req-1" && init?.method === "POST") {
                if (decisionOk) pending = [];
                return { ok: decisionOk, json: async () => (decisionOk ? { success: true } : { error: "You cannot approve your own request" }) };
            }
            throw new Error(`unexpected fetch ${url}`);
        });
        vi.stubGlobal("fetch", fetchMock);
        vi.stubGlobal("confirm", vi.fn(() => true));
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    async function render() {
        await act(async () => {
            root.render(<CampaignApprovalGate campaignId="c1" />);
        });
        await act(async () => {});
    }
    const button = (label: string) => [...container.querySelectorAll("button")].find((b) => b.textContent === label)!;
    async function click(label: string) {
        await act(async () => {
            button(label).click();
        });
        await act(async () => {});
    }

    it("shows the proposed action, its draft and the request id", async () => {
        await render();
        expect(container.textContent).toContain("1 action requires review");
        expect(container.textContent).toContain("Proposed: message send");
        expect(container.textContent).toContain("Intro");
        expect(container.textContent).toContain("Request req-1");
        expect(container.querySelector('a[href="/approvals"]')?.textContent).toBe("Edit draft");
    });

    it("renders nothing when nothing is waiting", async () => {
        pending = [];
        await render();
        expect(container.innerHTML).toBe("");
    });

    it("approves through the approvals endpoint after confirmation, then clears", async () => {
        await render();
        await click("Approve");
        expect(fetchMock).toHaveBeenCalledWith("/api/approvals/req-1", expect.objectContaining({ method: "POST", body: JSON.stringify({ action: "APPROVE" }) }));
        expect(toast.success).toHaveBeenCalledWith("Request approved");
        expect(container.innerHTML).toBe("");
    });

    it("does nothing when the confirmation is declined", async () => {
        vi.stubGlobal("confirm", vi.fn(() => false));
        await render();
        await click("Approve");
        expect(fetchMock).not.toHaveBeenCalledWith("/api/approvals/req-1", expect.anything());
    });

    it("rejects with a reason", async () => {
        await render();
        await click("Reject");
        expect(fetchMock).toHaveBeenCalledWith("/api/approvals/req-1", expect.objectContaining({ body: JSON.stringify({ action: "REJECT", reason: "Rejected from the campaign page" }) }));
    });

    it("shows the server's refusal and keeps the request", async () => {
        decisionOk = false;
        await render();
        await click("Approve");
        expect(toast.error).toHaveBeenCalledWith("You cannot approve your own request");
        expect(container.textContent).toContain("Request req-1");
    });

    it("offers no decision buttons to someone who may not decide", async () => {
        canDecide = false;
        await render();
        expect(container.querySelectorAll("button")).toHaveLength(0);
        expect(container.textContent).toContain("Waiting for a manager");
    });
    it("disables Approve once the request has expired, but still allows Reject", async () => {
        pending = [{ ...request, expiresAt: "2020-01-01T00:00:00.000Z" }];
        await render();
        expect(button("Approve").disabled).toBe(true);
        expect(button("Reject").disabled).toBe(false);
    });

    it("ignores a late response for a previous campaign", async () => {
        let releaseOld: (v: unknown) => void = () => {};
        fetchMock.mockImplementation((url: string) => {
            if (url === "/api/proxy/campaigns/c1/approvals") return new Promise((r) => { releaseOld = r; });
            if (url === "/api/proxy/campaigns/c2/approvals") return Promise.resolve({ ok: true, json: async () => ({ data: { canDecide: true, requests: [] } }) });
            throw new Error(`unexpected fetch ${url}`);
        });
        await act(async () => { root.render(<CampaignApprovalGate campaignId="c1" />); });
        await act(async () => { root.render(<CampaignApprovalGate campaignId="c2" />); });
        await act(async () => { releaseOld({ ok: true, json: async () => ({ data: { canDecide: true, requests: [request] } }) }); });
        await act(async () => {});
        expect(container.innerHTML).toBe("");
    });
});
