// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const push = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));

import { LaunchPlans } from "@/components/content/LaunchPlans";
import { LaunchPlanReview, type PlanDetail } from "@/components/content/LaunchPlanReview";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let root: Root;
let container: HTMLDivElement;
const fetchMock = vi.fn();

async function render(node: React.ReactNode) {
    await act(async () => {
        root.render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{node}</SWRConfig>);
    });
    for (let i = 0; i < 3; i++) await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
}

const byText = (text: string) => Array.from(document.querySelectorAll<HTMLElement>("button")).find((el) => el.textContent?.trim() === text);
async function click(el: Element | undefined) {
    expect(el).toBeTruthy();
    await act(async () => {
        el!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    for (let i = 0; i < 3; i++) await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
}
async function type(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    await act(async () => {
        Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
        el.dispatchEvent(new Event("input", { bubbles: true }));
    });
}

const plans = {
    runs: [{ id: "run-0", name: "Old plan", status: "READY", error: null, stale: false, createdAt: "2026-10-01T00:00:00Z", _count: { contentPosts: 12 } }],
    products: [{ id: "prod-1", name: "Batch Cooking Course", priceAmount: 49900, currency: "INR" }],
    icps: [{ id: "icp-1", name: "Busy parents" }],
};
const accounts = { accounts: [{ id: "acc-ig", platform: "INSTAGRAM", handle: "@maker", status: "CONNECTED" }] };

const plan = (over: Partial<PlanDetail> = {}): PlanDetail => ({
    id: "run-1",
    name: "Spring launch",
    status: "READY",
    error: null,
    stale: false,
    createdAt: "2026-10-02T00:00:00Z",
    bookingUrl: null,
    notes: null,
    leadMagnetPage: { id: "lp-1", campaignId: "lc-1", slug: "meal-plan", title: "Free meal plan", status: "draft" },
    salesPage: { id: "lp-2", campaignId: "lc-2", slug: "course", title: "Batch Cooking Course", status: "published" },
    keywordTrigger: { id: "trig-1", keywords: ["GUIDE"], active: false, socialAccount: { platform: "INSTAGRAM", handle: "@maker" } },
    sequences: [
        {
            id: "seq-1", campaignId: "camp-1", name: "Spring launch: nurture emails", status: "DRAFT", funnelStage: "MOFU",
            steps: [{ delayDays: 0, subject: "Your meal plan" }, { delayDays: 2, subject: "One more idea" }], _count: { enrollments: 0 },
        },
    ],
    nurtureActivatedAt: null,
    mailboxes: [{ id: "mb-1", email: "me@maker.test" }],
    productAutomation: { automationsActive: false, cartAbandonSequenceId: null, postPurchaseSequenceId: null },
    icpCreated: true,
    product: { id: "prod-1", name: "Batch Cooking Course" },
    icp: { id: "icp-1", name: "Audience: busy parents" },
    contentPosts: [
        {
            id: "p-1",
            body: "FB words",
            channelCaptions: { INSTAGRAM: "IG words", LINKEDIN: "LI words" },
            visualBrief: "A flat lay",
            funnelStage: "TOFU",
            status: "DRAFT",
            scheduledAt: "2030-01-08T04:30:00Z",
            targets: [{ status: "PENDING", socialAccount: { id: "acc-ig", platform: "INSTAGRAM", handle: "@maker" } }],
        },
    ],
    ...over,
});

describe("launch plans", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fetchMock.mockReset();
        global.fetch = fetchMock as any;
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        document.body.innerHTML = "";
    });

    const route = (handlers: Record<string, () => Response>) =>
        fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
            const key = `${init?.method ?? "GET"} ${url}`;
            const handler = handlers[key];
            if (!handler) throw new Error(`unexpected ${key}`);
            return handler();
        });

    it("says the feature is off on a 404", async () => {
        route({ "GET /api/proxy/content/playbooks": () => json(404, {}), "GET /api/proxy/social/accounts": () => json(404, {}) });
        await render(<LaunchPlans />);
        expect(container.textContent).toContain("isn't on for this workspace");
    });

    it("sends the wizard answers with a typed audience and opens the new plan", async () => {
        route({
            "GET /api/proxy/content/playbooks": () => json(200, plans),
            "GET /api/proxy/social/accounts": () => json(200, accounts),
            "POST /api/proxy/content/playbooks": () => json(202, { run: { id: "run-1", status: "GENERATING" } }),
        });
        await render(<LaunchPlans />);
        expect(container.textContent).toContain("Old plan");
        expect(container.textContent).toContain("12 posts");

        await type(document.querySelector<HTMLInputElement>("#plan-name")!, "Spring launch");
        await click(byText("Describe it"));
        await type(document.querySelector<HTMLTextAreaElement>("[aria-label='Audience description']")!, "Busy parents");
        await type(document.querySelector<HTMLTextAreaElement>("#plan-magnet")!, "Meal plan PDF");
        await act(async () => {
            document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        });
        for (let i = 0; i < 3; i++) await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

        const post = fetchMock.mock.calls.find((c) => c[1]?.method === "POST")!;
        const body = JSON.parse(post[1].body);
        expect(body).toMatchObject({
            name: "Spring launch",
            offer: { type: "product", productId: "prod-1" },
            audience: { description: "Busy parents" },
            leadMagnet: "Meal plan PDF",
            postsPerWeek: 3,
            accountIds: ["acc-ig"],
            keyword: "GUIDE",
        });
        expect(body.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(push).toHaveBeenCalledWith("/content/plans/run-1");
    });

    it("shows each drafted post's channel text and visual, and deletes the plan in one go", async () => {
        const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
        route({
            "GET /api/proxy/content/playbooks/run-1": () => json(200, { run: plan() }),
            "DELETE /api/proxy/content/playbooks/run-1": () => json(200, { deleted: 11, kept: 1, pagesDeleted: 1, pagesKept: 1, triggerKept: false, sequencesDeleted: 1, sequencesKept: 0 }),
        });
        await render(<LaunchPlanReview id="run-1" />);
        const text = container.textContent ?? "";
        expect(text).toContain("FB words");
        expect(text).toContain("IG words");
        expect(text).toContain("LI words");
        expect(text).toContain("Suggested visual: A flat lay");
        expect(text).toContain("Nothing is posted until it's approved");
        expect(text).toContain("stays if you delete this plan");
        // The rest of the bundle: both pages (with their editor) and the switched-off auto-reply.
        expect(text).toContain("Free meal plan");
        expect(text).toContain("Draft: edit and publish it");
        expect(container.querySelector('a[href="/landing-agent/lc-1/editor"]')).toBeTruthy();
        expect(text).toContain('"GUIDE" on @maker');
        expect(text).toContain("Off: publish the lead-magnet page, then switch it on");
        // 5c: the email sequences, each in its campaign, with nobody added.
        expect(text).toContain("Spring launch: nurture emails");
        expect(text).toContain("Right away: Your meal plan");
        expect(text).toContain("2 days later: One more idea");
        expect(text).toContain("Draft: nobody added yet");
        expect(container.querySelector('a[href="/campaigns/camp-1"]')).toBeTruthy();

        await click(byText("Delete plan and drafts"));
        expect(confirm).toHaveBeenCalled();
        expect(toast.success).toHaveBeenCalledWith("Deleted 11 drafts and 1 draft page and 1 email sequence. Kept 1 live post, 1 published page.");
        expect(push).toHaveBeenCalledWith("/content/plans");
        confirm.mockRestore();
    });

    it("switches the nurture on from a picked mailbox, and points the product at its sequences", async () => {
        route({
            "GET /api/proxy/content/playbooks/run-1": () => json(200, { run: plan({ sequences: [
                { id: "seq-n", campaignId: "camp-n", name: "Nurture", status: "DRAFT", funnelStage: "MOFU", steps: [{ delayDays: 0, subject: "Hi" }], _count: { enrollments: 0 } },
                { id: "seq-c", campaignId: "camp-c", name: "Reminders", status: "DRAFT", funnelStage: "BOFU", steps: [{ delayDays: 0, subject: "Still there?" }], _count: { enrollments: 0 } },
            ] }) }),
            "POST /api/proxy/content/playbooks/run-1/nurture": () => json(200, { active: true }),
            "POST /api/proxy/content/playbooks/run-1/product": () => json(200, { cartAbandon: true, postPurchase: false }),
        });
        await render(<LaunchPlanReview id="run-1" />);
        expect(container.textContent).toContain("Nurture emails: Off");
        expect(byText("Switch on")!.hasAttribute("disabled")).toBe(true); // a mailbox first
        const picker = document.querySelector<HTMLSelectElement>("[aria-label='Send the emails from']")!;
        await act(async () => {
            picker.value = "mb-1";
            picker.dispatchEvent(new Event("change", { bubbles: true }));
        });
        await click(byText("Switch on"));
        const sent = (path: string) => JSON.parse(fetchMock.mock.calls.find((c) => c[0] === `/api/proxy/content/playbooks/run-1/${path}`)![1].body);
        expect(sent("nurture")).toEqual({ active: true, mailboxId: "mb-1" });
        expect(toast.success).toHaveBeenCalledWith("Nurture emails switched on.");

        await click(byText("Use on product"));
        expect(sent("product")).toEqual({ mailboxId: "mb-1" });
        expect(toast.success).toHaveBeenLastCalledWith("Added to the product. They send once you switch its automations on in Settings > Payments.");
    });

    it("shows what the plan couldn't make", async () => {
        route({ "GET /api/proxy/content/playbooks/run-1": () => json(200, { run: plan({ notes: "No Instagram account or Facebook Page was picked.", keywordTrigger: null }) }) });
        await render(<LaunchPlanReview id="run-1" />);
        expect(container.textContent).toContain("No Instagram account or Facebook Page was picked.");
    });

    it("offers a retry for a failed plan", async () => {
        route({
            "GET /api/proxy/content/playbooks/run-1": () => json(200, { run: plan({ status: "FAILED", error: "Couldn't write the posts this time. Try again.", contentPosts: [] }) }),
            "POST /api/proxy/content/playbooks/run-1/retry": () => json(202, { ok: true }),
        });
        await render(<LaunchPlanReview id="run-1" />);
        expect(container.textContent).toContain("Couldn't write the posts this time");
        await click(byText("Try again"));
        expect(fetchMock.mock.calls.some((c) => c[0] === "/api/proxy/content/playbooks/run-1/retry" && c[1]?.method === "POST")).toBe(true);
    });
});
