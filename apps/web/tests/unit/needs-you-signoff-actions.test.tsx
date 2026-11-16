// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { NeedsYou } from "@/components/dashboard/NeedsYou";

const at = "2026-09-30T05:30:00.000Z";
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

function needsYou(editable: boolean) {
    return {
        needsYou: [
            { type: "approvals", count: 1, href: "/inbox?tab=approvals", top: [{ id: "a1", title: "Message send", detail: "Hi", href: "/inbox?tab=approvals", at, draft: { channel: "email", recipient: "asha@acme.test", subject: "Hi", body: "Original text", expiresAt: null, editable } }] },
        ],
    };
}

describe("sign-off card actions", () => {
    let container: HTMLDivElement;
    let root: Root;
    const fetchMock = vi.fn();

    beforeEach(() => {
        (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
        fetchMock.mockReset();
        vi.stubGlobal("fetch", fetchMock);
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });
    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        vi.unstubAllGlobals();
    });

    async function mount(editable: boolean, postStatus = 200) {
        fetchMock.mockImplementation((url: string, init?: RequestInit) =>
            Promise.resolve(init?.method === "POST" ? new Response("{}", { status: postStatus }) : new Response(JSON.stringify(needsYou(editable)), { status: 200 })),
        );
        await act(async () => { root.render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}><NeedsYou hasLeads /></SWRConfig>); });
        await flush();
    }
    const button = (label: string) => [...container.querySelectorAll("button")].find((b) => b.textContent === label)!;
    const posts = () => fetchMock.mock.calls.filter((c) => c[1]?.method === "POST");

    it("approves with the existing approvals call and nothing else in the body", async () => {
        await mount(true);
        await act(async () => { button("Approve").click(); });
        await flush();
        expect(posts()).toHaveLength(1);
        expect(posts()[0][0]).toBe("/api/approvals/a1");
        expect(JSON.parse(posts()[0][1].body)).toEqual({ action: "APPROVE" });
    });

    it("rejects with REJECT", async () => {
        await mount(true);
        await act(async () => { button("Reject").click(); });
        await flush();
        expect(JSON.parse(posts()[0][1].body)).toMatchObject({ action: "REJECT" });
    });

    it("sends the edited text with the approval when the draft was edited", async () => {
        await mount(true);
        await act(async () => { button("Edit draft").click(); });
        const area = container.querySelector("textarea")!;
        await act(async () => {
            Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(area, "Edited text");
            area.dispatchEvent(new Event("input", { bubbles: true }));
        });
        await act(async () => { button("Approve edited draft").click(); });
        await flush();
        expect(JSON.parse(posts()[0][1].body)).toEqual({ action: "APPROVE", body: "Edited text", subject: "Hi" });
    });

    it("sends nothing when a draft that cannot be edited here is only approved, and links Edit to the Inbox", async () => {
        await mount(false);
        const edit = [...container.querySelectorAll("a")].find((a) => a.textContent === "Edit draft")!;
        expect(edit.getAttribute("href")).toBe("/inbox?tab=approvals");
        expect(container.querySelector("textarea")).toBeNull();
    });
});
