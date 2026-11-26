// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FollowUpPlan, ReplyOutbox } from "@/components/inbox/FollowUpPlan";

vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

const now = Date.now();
const pending = { dueAt: now + 3_600_000, holdUntil: null, status: "draft", content: "Reviewed text", reason: null, revision: 1 };
const plan = { runId: "run-1", status: "active", reason: null, steps: [pending], history: [] };
const fetchMock = vi.fn();
let container: HTMLDivElement;
let root: Root;

async function render(child: React.ReactNode) {
    await act(async () => root.render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{child}</SWRConfig>));
    for (let i = 0; i < 3; i++) await act(async () => new Promise(resolve => setTimeout(resolve, 0)));
}

const button = (label: string) => Array.from(container.querySelectorAll("button")).find(item => item.textContent === label);
const click = async (label: string) => await act(async () => button(label)!.click());

describe("Inbox follow-up plan and Outbox", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
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

    it("shows queue controls and binds a send-now approval to the run, revision and text", async () => {
        fetchMock.mockResolvedValue(Response.json({ plan }));
        fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
            if (init?.method === "PATCH") return Response.json({ plan: { ...plan, steps: [{ ...pending, status: "queued" }] } });
            return Response.json({ plan });
        });
        await render(<FollowUpPlan replyId="reply-a" enabled />);
        expect(container.textContent).toContain("Follow-up plan");
        expect(button("Pause all")).toBeDefined();
        expect(button("Cancel plan")).toBeDefined();
        expect(button("Take over")).toBeDefined();
        await click("Edit text or timing");
        expect(container.querySelector("textarea")?.value).toBe("Reviewed text");
        expect(button("Reschedule")).toBeDefined();
        await click("Send now");
        const approved = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH")?.[1]?.body;
        expect(JSON.parse(approved)).toMatchObject({ runId: "run-1", action: { action: "approve", step: 0, revision: 1, content: "Reviewed text" } });
        expect(container.textContent).toContain("Approved and queued");
    });

    it("shows decision and actor history while blocking resume when the master is off", async () => {
        fetchMock.mockResolvedValueOnce(Response.json({ plan: { ...plan, status: "decision", reason: "new_inbound",
            history: [{ action: "paused", createdAt: new Date(now).toISOString(), user: { name: "Review rep" }, metadata: { reason: "new_inbound" } }] } }));
        await render(<FollowUpPlan replyId="reply-a" enabled={false} />);
        expect(container.textContent).toContain("Needs your decision");
        expect(container.textContent).toContain("Review rep");
        expect(button("Resume")?.disabled).toBe(true);
    });

    it("skips the exact run and step shown in the Outbox", async () => {
        const item = { id: "job-a", messageId: "reply-a", runId: "run-1", step: 0,
            recipient: "rep@example.test", sendAt: new Date(now).toISOString(), status: "queued" };
        fetchMock.mockImplementation(async () => Response.json({ items: [item] }));
        await render(<ReplyOutbox />);
        expect(container.querySelector('a[href="/inbox?reply=reply-a"]')?.textContent).toBe("rep@example.test");
        await click("Skip step");
        const init = fetchMock.mock.calls.find(([, call]) => call?.method === "PATCH")?.[1];
        expect(JSON.parse(init.body)).toEqual({ runId: "run-1", action: { action: "skip", step: 0 } });
    });
});
