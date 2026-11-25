// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReplySettingsPage from "@/app/(dashboard)/settings/replies/page";

vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

const fixture = {
    scheduledReplies: true, delayChoices: [1, 24], followUpPlans: false, maxSteps: 4, minSpacingHours: 24,
    approvalHours: 72, notifications: true, autoPause: { confidence: 0.7, holdHours: 24 },
};
const windowFixture = { enabled: false, days: [1, 2, 3, 4, 5], startHour: 8, endHour: 18, timeZone: "UTC" };

const fetchMock = vi.fn();
let container: HTMLDivElement;
let root: Root;

function respond(canEdit: boolean, fails = false) {
    fetchMock.mockImplementation(async (path: string, options?: RequestInit) => {
        if (path.endsWith("/account-reply-cooldown")) return Response.json({ hours: 48, canEdit });
        if (options?.method === "PUT") {
            if (fails) return Response.json({ error: "Could not save these limits." }, { status: 400 });
            return Response.json({ settings: JSON.parse(String(options.body)), sendWindow: windowFixture, canEdit });
        }
        return Response.json({ settings: fixture, sendWindow: windowFixture, canEdit });
    });
}

async function render() {
    await act(async () => root.render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}><ReplySettingsPage /></SWRConfig>));
    for (let i = 0; i < 3; i++) await act(async () => new Promise(resolve => setTimeout(resolve, 0)));
}

function master() {
    return Array.from(container.querySelectorAll("label")).find(label => label.textContent === "Follow-up plans")!.querySelector("input")!;
}

async function submit() {
    await act(async () => master().click());
    const button = Array.from(container.querySelectorAll("button")).find(item => item.textContent === "Save reply settings")!;
    await act(async () => button.click());
}

describe("Replies and Follow-ups settings", () => {
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

    it("shows controls, the moved cooldown and the Outbox link, and saves an admin's changes", async () => {
        respond(true);
        await render();
        expect(master().checked).toBe(false);
        expect(container.querySelector<HTMLSelectElement>("#account-reply-cooldown")?.value).toBe("48");
        expect(container.querySelector('a[href="/inbox?tab=outbox"]')).not.toBeNull();
        expect(container.textContent).toContain("Allowed sending hours");
        await submit();
        expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT")[0]?.[1]?.body).toContain('"followUpPlans":true');
        expect(container.querySelector('[role="status"]')?.textContent).toBe("Reply settings saved.");
    });

    it("keeps both forms read-only for non-admin members", async () => {
        respond(false);
        await render();
        expect(master().matches(":disabled")).toBe(true);
        expect(container.querySelector<HTMLSelectElement>("#account-reply-cooldown")?.disabled).toBe(true);
        expect(container.textContent).not.toContain("Save reply settings");
    });

    it("shows the API save error", async () => {
        respond(true, true);
        await render();
        await submit();
        expect(container.querySelector('[role="alert"]')?.textContent).toBe("Could not save these limits.");
    });
});
