// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const search = vi.hoisted(() => ({ value: "" }));
vi.mock("sonner", () => ({ toast }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));
vi.mock("next/navigation", () => ({
    useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
    useSearchParams: () => new URLSearchParams(search.value),
}));
vi.mock("@/app/(dashboard)/approvals/page", () => ({ default: () => null }));

import InboxPage from "@/app/(dashboard)/inbox/page";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const HOUR = 60 * 60 * 1000;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function igReply(overrides: Record<string, unknown> = {}) {
    return {
        id: "msg-ig",
        leadId: "lead-1",
        leadName: null,
        company: null,
        email: null,
        outcome: null,
        platform: "INSTAGRAM",
        subject: null,
        campaignName: null,
        sequenceName: null,
        snippet: "Is the course still open?",
        handle: "@asha.makes",
        replyWindowEndsAt: new Date(Date.now() + 20 * HOUR).toISOString(),
        isRead: true,
        sentimentScore: null,
        createdAt: new Date(Date.now() - 4 * HOUR).toISOString(),
        ...overrides,
    };
}

let root: Root;
let container: HTMLDivElement;
const fetchMock = vi.fn();

function serve(reply: ReturnType<typeof igReply>) {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.startsWith("/api/proxy/inbox?")) {
            return json(200, { replies: { items: [reply], page: 1, limit: 20, total: 1 }, meetings: [], counts: { unreadReplies: 0, openNudges: 0, meetingsToday: 0 } });
        }
        if (url === "/api/approvals") return json(200, { requests: [] });
        if (url.startsWith("/api/proxy/inbox/thread/")) {
            return json(200, {
                lead: { id: "lead-1", fullName: null, company: null, email: null, replyOutcome: null },
                messages: [{ id: "msg-ig", direction: "INBOUND", sender: null, text: "Is the course still open?", createdAt: reply.createdAt }],
            });
        }
        if (url === `/api/proxy/inbox/replies/${reply.id}/reply` && init?.method === "POST") return json(200, { id: "outbound-1" });
        return json(404, { error: "not mocked" });
    });
}

async function render() {
    await act(async () => {
        root.render(
            <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
                <InboxPage />
            </SWRConfig>
        );
    });
    // Let SWR resolve, then the deep-link effect open the thread.
    for (let i = 0; i < 3; i++) await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
}

const byText = (text: string, selector = "button") =>
    Array.from(document.querySelectorAll<HTMLElement>(selector)).find((el) => el.textContent?.trim() === text);

async function type(el: HTMLTextAreaElement, value: string) {
    await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(el, value);
        el.dispatchEvent(new Event("input", { bubbles: true }));
    });
}

describe("Action Inbox: Instagram and Facebook conversations", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        search.value = "reply=msg-ig";
        global.fetch = fetchMock as any;
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
    });

    it("names the person by handle, labels the platform, and replies inside the 24-hour window", async () => {
        serve(igReply());
        await render();

        expect(document.querySelector("h3")?.textContent).toBe("@asha.makes");
        expect(document.body.textContent).toContain("Instagram");
        expect(document.body.textContent).toContain("You can reply until");

        await type(document.querySelector("textarea")!, "Yes! Enrolment closes Friday.");
        expect(document.body.textContent).toContain("29 / 1000 bytes");
        await act(async () => {
            byText("Send reply")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });

        const sent = fetchMock.mock.calls.find(([url]) => url === "/api/proxy/inbox/replies/msg-ig/reply");
        expect(JSON.parse(sent![1].body)).toEqual({ content: "Yes! Enrolment closes Friday." });
        expect(toast.success).toHaveBeenCalledWith("Reply sent");
    });

    it("counts Instagram's limit in bytes and blocks sending past 1,000", async () => {
        serve(igReply());
        await render();

        await type(document.querySelector("textarea")!, "é".repeat(501));
        expect(document.body.textContent).toContain("1002 / 1000 bytes");
        expect((byText("Send reply") as HTMLButtonElement).disabled).toBe(true);
    });

    it("explains the closed window instead of offering a composer once 24 hours have passed", async () => {
        serve(igReply({ platform: "FACEBOOK", handle: null, replyWindowEndsAt: new Date(Date.now() - HOUR).toISOString() }));
        await render();

        expect(document.querySelector("h3")?.textContent).toBe("Facebook contact");
        expect(document.querySelector("textarea")).toBeNull();
        expect(document.body.textContent).toContain("Facebook only allows replies within 24 hours of the person's last message");
    });
});
