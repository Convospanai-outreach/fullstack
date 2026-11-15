// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));
vi.mock("@/lib/api/browserBase", () => ({ getBrowserApiUrl: (p: string) => `/api/proxy${p}` }));

import { DripPlaybooks, dayLabel } from "./DripPlaybooks";

const pb = (kind: string, name: string, trigger: string, score: number) => ({
    kind,
    name,
    goal: `${name} goal`,
    trigger: { kind: trigger, label: `${name} starts`, automatic: trigger !== "manual" },
    metric: "Reply rate",
    score,
    reasons: [`${name} reason`],
    schedule: [
        { delayDays: 0, delayHours: 0, cta: "asset" },
        { delayDays: 3, delayHours: 0, cta: "reply" },
    ],
});
const listing = (hasProfile = true) => ({
    hasProfile,
    hasBookingLink: false,
    playbooks: [
        pb("welcome", "Welcome series", "landing_signup", 55),
        pb("b2bNurture", "Resource download nurture", "landing_signup", 50),
        pb("winBack", "Win-back", "inactivity", 40),
        pb("proposalFollowUp", "Proposal follow-up", "manual", 30),
    ],
});

let container: HTMLDivElement;
let root: Root;
const calls: { url: string; body?: any }[] = [];

function mockApi(extra: Record<string, unknown> = {}) {
    global.fetch = vi.fn(async (url: any, init?: any) => {
        const u = String(url);
        calls.push({ url: u, body: init?.body ? JSON.parse(init.body) : undefined });
        const route = Object.keys(extra).find((k) => u.endsWith(k));
        const body = route ? extra[route] : u.endsWith("/drip-playbooks") ? listing() : {};
        return new Response(JSON.stringify(body), { status: 200 });
    }) as any;
}

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) });
const button = (text: string) => [...document.body.querySelectorAll("button")].find((b) => b.textContent?.includes(text)) as HTMLButtonElement;
const click = async (el: HTMLElement) => { await act(async () => { el.click() }); await flush() };

beforeEach(() => {
    calls.length = 0;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = "";
});

describe("dayLabel", () => {
    it("shows hours for same-day follow-ups and days otherwise", () => {
        expect(dayLabel({ delayDays: 0, delayHours: 2 })).toBe("+2h");
        expect(dayLabel({ delayDays: 0, delayHours: 0 })).toBe("Day 0");
        expect(dayLabel({ delayDays: 5, delayHours: 0 })).toBe("Day 5");
    });
});

describe("DripPlaybooks", () => {
    it("lists playbooks in ranked order and marks the top three as recommended", async () => {
        mockApi()
        await act(async () => { root.render(<DripPlaybooks />) })
        await flush()
        const names = [...container.querySelectorAll("h3")].map((h) => h.textContent)
        expect(names).toEqual(["Welcome series", "Resource download nurture", "Win-back", "Proposal follow-up"])
        expect(container.textContent!.match(/Recommended/g)).toHaveLength(3)
        expect(container.textContent).toContain("Ranked for your business")
    })

    it("points to setup when there is no website scan yet", async () => {
        mockApi({ "/drip-playbooks": listing(false) })
        await act(async () => { root.render(<DripPlaybooks />) })
        await flush()
        expect(container.querySelector('a[href="/setup"]')).not.toBeNull()
    })

    it("drafts the emails, then switches a sign-up playbook on for the chosen page", async () => {
        mockApi({
            "/drip-playbooks/draft": { ok: true, campaignId: "camp1", sequenceId: "s1", emails: 2 },
            "/landing-agent/campaigns": { campaigns: [{ id: "c", name: "C", updatedAt: "", pages: [{ id: "pageA", slug: "guide", title: "Free guide", status: "published", updatedAt: "" }], _count: { wireframeOptions: 0, leads: 0 } }] },
            "/drip-playbooks/activate": { ok: true, active: true },
        })
        await act(async () => { root.render(<DripPlaybooks />) })
        await flush()
        await click(button("Set up"))

        const asset = document.body.querySelector("#drip-asset") as HTMLInputElement
        await act(async () => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(asset, "https://acme.test/guide.pdf")
            asset.dispatchEvent(new Event("input", { bubbles: true }))
        })
        await click(button("Write the emails"))
        const draft = calls.find((c) => c.url.endsWith("/drip-playbooks/draft"))!
        expect(draft.body).toMatchObject({ kind: "welcome", assetUrl: "https://acme.test/guide.pdf" })
        expect(document.body.querySelector('a[href="/campaigns/camp1"]')).not.toBeNull()

        const select = document.body.querySelector("#drip-page") as HTMLSelectElement
        expect(button("Switch on").disabled).toBe(true)
        await act(async () => {
            select.value = "pageA"
            select.dispatchEvent(new Event("change", { bubbles: true }))
        })
        await click(button("Switch on"))
        expect(calls.find((c) => c.url.endsWith("/drip-playbooks/activate"))!.body).toMatchObject({ campaignId: "camp1", active: true, landingPageId: "pageA" })
        expect(document.body.textContent).toContain("It is on.")
    })

    it("never offers to switch on a playbook the owner starts by hand", async () => {
        mockApi({ "/drip-playbooks/draft": { ok: true, campaignId: "camp2" } })
        await act(async () => { root.render(<DripPlaybooks />) })
        await flush()
        const setUps = [...container.querySelectorAll("button")].filter((b) => b.textContent === "Set up")
        await click(setUps[3]!)
        await click(button("Write the emails"))
        expect(button("Switch on")).toBeUndefined()
        expect(document.body.textContent).toContain("You start this one yourself")
    })
})
