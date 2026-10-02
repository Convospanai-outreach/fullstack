// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const search = vi.hoisted(() => ({ value: "" }));
vi.mock("sonner", () => ({ toast }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search.value) }));

import { KeywordTriggers, type KeywordTrigger } from "@/components/content/KeywordTriggers";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const BASE = "/api/proxy/content/keyword-triggers";
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const trigger = (overrides: Partial<KeywordTrigger> = {}): KeywordTrigger => ({
    id: "trig-1",
    socialAccountId: "acc-ig",
    scope: "COMMENT",
    keywords: ["guide"],
    match: "CONTAINS",
    contentPostId: null,
    replyText: "Here's the guide",
    publicCommentReply: null,
    landingPageId: null,
    active: false,
    sentLast7Days: 4,
    lastError: null,
    ...overrides,
});

const list = (triggers: KeywordTrigger[] = []) => ({
    triggers,
    accounts: [
        { id: "acc-ig", platform: "INSTAGRAM", handle: "@maker", status: "CONNECTED" },
        { id: "acc-fb", platform: "FACEBOOK_PAGE", handle: "Maker Page", status: "CONNECTED" },
    ],
    landingPages: [{ id: "lp-1", slug: "free-guide", title: "Free guide" }],
    posts: [{ id: "post-1", body: "Launch day!", accountIds: ["acc-fb"] }],
});

let root: Root;
let container: HTMLDivElement;
const fetchMock = vi.fn();

async function render() {
    await act(async () => {
        root.render(
            <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
                <KeywordTriggers />
            </SWRConfig>
        );
    });
    for (let i = 0; i < 3; i++) await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
}

const byText = (text: string, selector = "button") =>
    Array.from(document.querySelectorAll<HTMLElement>(selector)).find((el) => el.textContent?.trim() === text);

async function click(el: Element | undefined) {
    expect(el).toBeTruthy();
    await act(async () => {
        el!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
}

async function setValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    await act(async () => {
        Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
        el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
    });
}

const field = <T extends Element>(label: string, selector: string) =>
    Array.from(document.querySelectorAll("label")).find((l) => l.textContent?.startsWith(label))?.querySelector<T & Element>(selector) as unknown as T;

describe("Keyword auto-replies", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        search.value = "";
        global.fetch = fetchMock as any;
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
    });

    it("shows nothing when the creator funnel is off", async () => {
        fetchMock.mockResolvedValue(json(404, { error: "Not found" }));
        await render();
        expect(container.textContent).toBe("");
    });

    it("creates an auto-reply, saved switched off", async () => {
        fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
            if (url === BASE && init?.method === "POST") return json(201, { trigger: trigger() });
            return json(200, list());
        });
        await render();

        await click(byText("New auto-reply"));
        await setValue(field<HTMLInputElement>("Keywords", "input"), "guide, Free Guide ");
        await setValue(field<HTMLTextAreaElement>("Message they get", "textarea"), "Here's the guide");
        await setValue(field<HTMLSelectElement>("Link to landing page", "select"), "lp-1");
        await setValue(field<HTMLInputElement>("Public reply", "input"), "Sent you a DM!");
        await click(byText("Save"));

        const post = fetchMock.mock.calls.find(([url, init]) => url === BASE && init?.method === "POST");
        expect(JSON.parse(post![1].body)).toEqual({
            socialAccountId: "acc-ig",
            scope: "COMMENT",
            keywords: ["guide", "Free Guide"],
            match: "CONTAINS",
            contentPostId: null,
            replyText: "Here's the guide",
            publicCommentReply: "Sent you a DM!",
            landingPageId: "lp-1",
        });
        expect(toast.success).toHaveBeenCalledWith("Saved. Switch it on when you're ready.");
    });

    it("counts the message in bytes and won't save one that's too long; DM-only hides the post and public reply", async () => {
        fetchMock.mockResolvedValue(json(200, list()));
        await render();
        await click(byText("New auto-reply"));
        await setValue(field<HTMLInputElement>("Keywords", "input"), "guide");
        await setValue(field<HTMLTextAreaElement>("Message they get", "textarea"), "é".repeat(351));
        expect(container.textContent).toContain("702 / 700 bytes");
        expect((byText("Save") as HTMLButtonElement).disabled).toBe(true);

        await setValue(field<HTMLSelectElement>("Reply to", "select"), "DM");
        expect(field("Post", "select")).toBeFalsy();
        expect(field("Public reply", "input")).toBeFalsy();
    });

    it("opens the editor for a live post from the calendar, on that post's account", async () => {
        search.value = "trigger=new&post=post-1";
        fetchMock.mockResolvedValue(json(200, list()));
        await render();
        expect(field<HTMLSelectElement>("Account", "select").value).toBe("acc-fb");
        expect(field<HTMLSelectElement>("Post", "select").value).toBe("post-1");
    });

    it("switches an auto-reply on, and shows the server's reason when it can't", async () => {
        fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
            if (init?.method === "PATCH") return json(409, { error: "Reconnect this account and allow: instagram_manage_comments." });
            return json(200, list([trigger({ lastError: "(#10) blocked" })]));
        });
        await render();
        expect(container.textContent).toContain("Off · 4 sent in the last 7 days");
        expect(container.textContent).toContain("Last problem: (#10) blocked");

        await click(byText("Switch on"));
        const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
        expect(patch![0]).toBe(`${BASE}/trig-1`);
        expect(JSON.parse(patch![1].body)).toEqual({ active: true });
        expect(toast.error).toHaveBeenCalledWith("Reconnect this account and allow: instagram_manage_comments.");
    });
});
