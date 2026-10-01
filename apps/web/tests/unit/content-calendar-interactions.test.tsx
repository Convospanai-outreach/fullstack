// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));

import { PostComposer } from "@/components/content/PostComposer";
import { StageMixMeter } from "@/components/content/StageMixMeter";
import ContentCalendarPage from "@/app/(dashboard)/content/calendar/page";
import { startOfDay, viewRange, type CalendarAccount, type CalendarPost } from "@/lib/contentCalendar";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const account: CalendarAccount = { id: "acc-fb", platform: "FACEBOOK_PAGE", handle: "Maker Page", status: "CONNECTED" };
const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
const post = (overrides: Partial<CalendarPost> = {}): CalendarPost => ({
    id: "post-1",
    body: "Hello",
    mediaUrls: [],
    funnelStage: "TOFU",
    status: "DRAFT",
    scheduledAt: future.toISOString(),
    timezone: "UTC",
    approvalRequestId: null,
    reviewNote: null,
    targets: [{ id: "t-1", status: "PENDING", lastError: null, socialAccount: account }],
    ...overrides,
});

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let root: Root;
let container: HTMLDivElement;
const fetchMock = vi.fn();

async function render(node: React.ReactNode, fallback: Record<string, unknown> = {}) {
    await act(async () => {
        root.render(<SWRConfig value={{ fallback, provider: () => new Map(), revalidateOnMount: false, dedupingInterval: 0 }}>{node}</SWRConfig>);
    });
}

const byText = (text: string, selector = "button") =>
    Array.from(document.querySelectorAll<HTMLElement>(selector)).find((el) => el.textContent?.trim() === text);

async function click(el: Element | undefined) {
    expect(el).toBeTruthy();
    await act(async () => {
        el!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
}

async function type(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    await act(async () => {
        Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
        el.dispatchEvent(new Event("input", { bubbles: true }));
    });
}

describe("content calendar interactions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        vi.stubGlobal("fetch", fetchMock);
        fetchMock.mockReset();
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        document.body.innerHTML = "";
        vi.unstubAllGlobals();
    });

    describe("PostComposer", () => {
        const open = (props: Partial<React.ComponentProps<typeof PostComposer>> = {}) => {
            const onChanged = vi.fn();
            const onClose = vi.fn();
            return {
                onChanged,
                onClose,
                node: <PostComposer open onClose={onClose} post={null} defaultWhen={future} accounts={[account]} onChanged={onChanged} {...props} />,
            };
        };

        it("saves a new post and sends it for approval", async () => {
            fetchMock
                .mockResolvedValueOnce(json(201, { post: { id: "post-9" } }))
                .mockResolvedValueOnce(json(200, { approvalRequestId: "req-9" }));
            const { node, onChanged, onClose } = open();
            await render(node);

            await type(document.querySelector("textarea")!, "Three mistakes new founders make");
            await click(byText("Send for approval"));

            const [createUrl, createInit] = fetchMock.mock.calls[0];
            expect(createUrl).toBe("/api/proxy/content/posts");
            expect(createInit.method).toBe("POST");
            const body = JSON.parse(createInit.body);
            expect(body).toMatchObject({ body: "Three mistakes new founders make", funnelStage: "TOFU", accountIds: ["acc-fb"], mediaUrls: [] });
            expect(new Date(body.scheduledAt).getTime()).toBe(new Date(future.getFullYear(), future.getMonth(), future.getDate(), future.getHours(), future.getMinutes()).getTime());
            expect(fetchMock.mock.calls[1][0]).toBe("/api/proxy/content/posts/post-9/submit");
            expect(toast.success).toHaveBeenCalledWith("Sent for approval. It's in Inbox > Approvals.");
            expect(onChanged).toHaveBeenCalled();
            expect(onClose).toHaveBeenCalled();
        });

        it("keeps the panel open and shows the reason when sending fails", async () => {
            fetchMock
                .mockResolvedValueOnce(json(200, { post: { id: "post-1" } }))
                .mockResolvedValueOnce(json(400, { error: "Instagram posts need at least one image." }));
            const { node, onChanged, onClose } = open({ post: post() });
            await render(node);

            await click(byText("Send for approval"));

            expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");
            expect(toast.error).toHaveBeenCalledWith("Instagram posts need at least one image.");
            expect(onChanged).toHaveBeenCalled(); // the draft itself was saved
            expect(onClose).not.toHaveBeenCalled();
        });

        it("approves a post in review through the approvals route", async () => {
            fetchMock.mockResolvedValueOnce(json(200, { success: true }));
            const { node, onClose } = open({ post: post({ status: "IN_REVIEW", approvalRequestId: "req-1" }) });
            await render(node);

            expect(document.body.textContent).toContain("sends it back for approval");
            await click(byText("Approve"));

            expect(fetchMock.mock.calls[0][0]).toBe("/api/approvals/req-1");
            expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ action: "APPROVE" });
            expect(onClose).toHaveBeenCalled();
        });

        it("explains when someone without approval rights tries to approve", async () => {
            fetchMock.mockResolvedValueOnce(json(403, { error: "Forbidden" }));
            const { node, onClose } = open({ post: post({ status: "IN_REVIEW", approvalRequestId: "req-1" }) });
            await render(node);

            await type(document.querySelector<HTMLInputElement>('input[placeholder="Note for the author (optional)"]')!, "Fix the link");
            await click(byText("Send back"));

            expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ action: "REJECT", reason: "Fix the link" });
            expect(toast.error).toHaveBeenCalledWith("Only workspace owners and admins can approve posts.");
            expect(onClose).not.toHaveBeenCalled();
        });

        it("refuses non-JPEG images before uploading", async () => {
            const { node } = open();
            await render(node);

            const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
            const file = new File([new Uint8Array([0x89, 0x50])], "photo.png", { type: "image/png" });
            Object.defineProperty(input, "files", { value: [file], configurable: true });
            await act(async () => {
                input.dispatchEvent(new Event("change", { bubbles: true }));
            });

            expect(fetchMock).not.toHaveBeenCalled();
            expect(toast.error).toHaveBeenCalledWith("photo.png: only JPEG images work on Instagram.");
        });

        it("deletes after confirming", async () => {
            vi.stubGlobal("confirm", vi.fn(() => true));
            fetchMock.mockResolvedValueOnce(json(200, { deleted: true }));
            const { node, onChanged } = open({ post: post() });
            await render(node);

            await click(byText("Delete"));

            expect(fetchMock.mock.calls[0]).toEqual(["/api/proxy/content/posts/post-1", { method: "DELETE" }]);
            expect(onChanged).toHaveBeenCalled();
        });

        it("shows a published post read-only", async () => {
            const { node } = open({ post: post({ status: "PUBLISHED" }) });
            await render(node);
            expect(byText("Save draft")).toBeUndefined();
            expect(document.querySelector("fieldset")?.disabled).toBe(true);
        });
    });

    describe("StageMixMeter", () => {
        const MIX = "/api/proxy/content/stage-mix";

        it("rejects a target that doesn't add up to 100 and saves one that does", async () => {
            await render(<StageMixMeter posts={[post()]} />, { [MIX]: { target: { TOFU: 60, MOFU: 30, BOFU: 10, POST: 0 } } });
            await click(byText("Change target"));

            const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="number"]'));
            expect(inputs).toHaveLength(4);
            await type(inputs[0], "70");
            await click(byText("Save target"));
            expect(toast.error).toHaveBeenCalledWith("Use whole numbers that add up to 100.");
            expect(fetchMock).not.toHaveBeenCalled();

            await type(inputs[1], "20");
            fetchMock.mockResolvedValueOnce(json(200, { target: { TOFU: 70, MOFU: 20, BOFU: 10, POST: 0 } }));
            await click(byText("Save target"));
            expect(fetchMock.mock.calls[0][0]).toBe(MIX);
            expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ TOFU: 70, MOFU: 20, BOFU: 10, POST: 0 });
        });
    });

    describe("calendar page", () => {
        it("reschedules a dropped post to the same time on the new day", async () => {
            const { from, to } = viewRange("month", startOfDay(new Date()));
            const at = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 30, 10, 30);
            const list = `/api/proxy/content/posts?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
            fetchMock.mockResolvedValue(json(200, {}));
            await render(<ContentCalendarPage />, {
                [list]: { posts: [post({ scheduledAt: at.toISOString() })], unscheduled: [] },
                "/api/proxy/social/accounts": { accounts: [account] },
                "/api/proxy/content/stage-mix": { target: { TOFU: 60, MOFU: 30, BOFU: 10, POST: 0 } },
            });

            const chip = Array.from(document.querySelectorAll<HTMLElement>('[draggable="true"]')).find((el) => el.textContent?.includes("Hello"))!;
            const cells = Array.from(container.querySelectorAll<HTMLElement>("div.cursor-pointer"));
            const target = cells[31]; // the day after the post's day
            const data = new Map<string, string>();
            const dataTransfer = { setData: (k: string, v: string) => data.set(k, v), getData: (k: string) => data.get(k) ?? "" };
            await act(async () => {
                const start = new Event("dragstart", { bubbles: true });
                Object.assign(start, { dataTransfer });
                chip.dispatchEvent(start);
                const drop = new Event("drop", { bubbles: true, cancelable: true });
                Object.assign(drop, { dataTransfer });
                target.dispatchEvent(drop);
            });

            const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
            expect(patch?.[0]).toBe("/api/proxy/content/posts/post-1");
            const moved = new Date(JSON.parse(patch![1].body).scheduledAt);
            expect([moved.getDate(), moved.getHours(), moved.getMinutes()]).toEqual([new Date(from.getFullYear(), from.getMonth(), from.getDate() + 31).getDate(), 10, 30]);
        });

        it("opens a new post on the clicked day", async () => {
            const { from, to } = viewRange("month", startOfDay(new Date()));
            const list = `/api/proxy/content/posts?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
            await render(<ContentCalendarPage />, {
                [list]: { posts: [], unscheduled: [] },
                "/api/proxy/social/accounts": { accounts: [account] },
                "/api/proxy/content/stage-mix": { target: { TOFU: 60, MOFU: 30, BOFU: 10, POST: 0 } },
            });

            await click(container.querySelectorAll<HTMLElement>("div.cursor-pointer")[41]);
            expect(document.body.textContent).toContain("New post");
            expect(document.querySelector<HTMLInputElement>('input[type="datetime-local"]')?.value).toMatch(/T09:00$/);

            await click(byText("week"));
            expect(container.querySelectorAll("div.cursor-pointer")).toHaveLength(7);
        });
    });
});
