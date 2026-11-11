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
    mauticPageUrl: null,
    flowId: null,
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
            mauticPageUrl: null,
            flowId: null,
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

    describe("Conversation flow on an auto-reply", () => {
        const FLOW = { id: "flow-1", name: "Guide flow", version: 1, steps: [{ type: "message", text: "Hi there" }, { type: "end" }] };
        const LINK_FLOW = { id: "flow-link", name: "Link flow", version: 1, steps: [{ type: "message", text: "Hi" }, { type: "link", text: "Here it is" }] };
        const PROPERTIES = {
            properties: [
                { key: "budget", label: "Budget", type: "text", archivedAt: null },
                { key: "pick", label: "Pick", type: "choice", options: ["a"], archivedAt: null },
            ],
        };

        // Routes each URL like the real API; a POST to the flows list adds the flow to the list.
        function mockApi(flows: any[] = [FLOW], triggers: KeywordTrigger[] = []) {
            fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
                if (url === "/api/proxy/settings/custom-properties") return json(200, PROPERTIES);
                if (url === "/api/proxy/content/dm-flows" && init?.method === "POST") {
                    const created = { id: "flow-new", version: 1, ...JSON.parse(init.body as string) };
                    flows.push(created);
                    return json(201, { flow: created });
                }
                if (url === "/api/proxy/content/dm-flows") return json(200, { flows });
                if (url === BASE && init?.method === "POST") return json(201, { trigger: trigger() });
                if (url === BASE && init?.method === "PATCH") return json(200, { trigger: trigger() });
                return json(200, list(triggers));
            });
        }

        const bodyOf = (method: string, url: string) => {
            const call = fetchMock.mock.calls.find(([u, init]) => u === url && init?.method === method);
            return call ? JSON.parse(call[1].body) : undefined;
        };

        async function fillBasics() {
            await click(byText("New auto-reply"));
            await setValue(field<HTMLInputElement>("Keywords", "input"), "guide");
            await setValue(field<HTMLTextAreaElement>("Message they get", "textarea"), "Here's the guide");
        }

        it("attaches an existing flow to a new auto-reply", async () => {
            mockApi();
            await render();
            await fillBasics();
            await setValue(field<HTMLSelectElement>("Conversation flow", "select"), "flow-1");
            await click(byText("Save"));
            expect(bodyOf("POST", BASE).flowId).toBe("flow-1");
        });

        it("detaches a flow by choosing no flow", async () => {
            mockApi([FLOW], [trigger({ flowId: "flow-1" })]);
            await render();
            await click(byText("Edit"));
            expect(field<HTMLSelectElement>("Conversation flow", "select").value).toBe("flow-1");
            await setValue(field<HTMLSelectElement>("Conversation flow", "select"), "");
            await click(byText("Save"));
            expect(bodyOf("PATCH", `${BASE}/trig-1`).flowId).toBeNull();
        });

        it("blocks saving a flow with a landing link until a landing page is picked", async () => {
            mockApi([LINK_FLOW]);
            await render();
            await fillBasics();
            await setValue(field<HTMLSelectElement>("Conversation flow", "select"), "flow-link");
            expect(container.textContent).toContain("This flow sends a landing page link. Pick a landing page above.");
            expect((byText("Save") as HTMLButtonElement).disabled).toBe(true);
            await setValue(field<HTMLSelectElement>("Link to landing page", "select"), "lp-1");
            expect((byText("Save") as HTMLButtonElement).disabled).toBe(false);
        });

        it("shows an archived flow as a problem, and blocks saving until it is detached", async () => {
            mockApi([], [trigger({ flowId: "flow-gone" })]);
            await render();
            await click(byText("Edit"));
            expect(container.textContent).toContain("This flow was archived. Choose another flow or none, then save.");
            expect((byText("Save") as HTMLButtonElement).disabled).toBe(true);
            await setValue(field<HTMLSelectElement>("Conversation flow", "select"), "");
            expect((byText("Save") as HTMLButtonElement).disabled).toBe(false);
        });

        it("creates a flow in the editor and attaches it to the auto-reply", async () => {
            mockApi([]);
            await render();
            await fillBasics();
            await setValue(field<HTMLSelectElement>("Conversation flow", "select"), "__new");
            await setValue(field<HTMLInputElement>("Flow name", "input"), "Budget check");
            await click(byText("Add message"));
            await setValue(container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Step 1 text"]')!, "Thanks for asking!");
            await click(byText("Add question"));
            await setValue(container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Step 2 text"]')!, "What is your budget?");
            await setValue(container.querySelector<HTMLSelectElement>('select[aria-label="Step 2 property"]')!, "budget");
            await click(byText("Create flow"));
            expect(bodyOf("POST", "/api/proxy/content/dm-flows")).toEqual({
                name: "Budget check",
                steps: [
                    { type: "message", text: "Thanks for asking!" },
                    { type: "question", text: "What is your budget?", property: "budget" },
                ],
            });
            await click(byText("Save"));
            expect(bodyOf("POST", BASE).flowId).toBe("flow-new");
        });

        it("edits an attached flow's steps and saves them", async () => {
            mockApi([FLOW]);
            await render();
            await fillBasics();
            await setValue(field<HTMLSelectElement>("Conversation flow", "select"), "flow-1");
            await click(byText("Edit flow"));
            await click(byText("Add question"));
            await setValue(container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Step 2 text"]')!, "Q?");
            await setValue(container.querySelector<HTMLSelectElement>('select[aria-label="Step 2 property"]')!, "budget");
            await click(byText("Save flow"));
            expect(bodyOf("PATCH", `${BASE.replace("keyword-triggers", "dm-flows")}/flow-1`)).toEqual({
                name: "Guide flow",
                steps: [
                    { type: "message", text: "Hi there" },
                    { type: "question", text: "Q?", property: "budget" },
                    { type: "end" },
                ],
            });
        });
    });
});
