// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { ProductAutomations } from "@/components/checkout/ProductAutomations";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const URL = "/api/proxy/checkout/products/prod-1/automation";
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const data = (over: Record<string, unknown> = {}) => ({
    automation: { deliveryUrl: null, deliveryMailboxId: null, cartAbandonSequenceId: null, cartAbandonHours: null, active: false, activatedAt: null, ...over },
    mailboxes: [{ id: "mb-1", email: "me@maker.co" }],
    sequences: [
        { id: "seq-1", name: "Cart reminder", usable: true },
        { id: "seq-2", name: "LinkedIn touch", usable: false },
    ],
    recentDeliveries: [{ id: "o-1", deliveryStatus: "FAILED", deliveryError: "The delivery mailbox isn't connected.", updatedAt: "2026-10-02T10:00:00Z" }],
});

let root: Root;
let container: HTMLDivElement;
const fetchMock = vi.fn();

async function render() {
    await act(async () => {
        root.render(
            <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
                <ProductAutomations productId="prod-1" />
            </SWRConfig>,
        );
    });
    for (let i = 0; i < 3; i++) await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
}

const byText = (text: string) => Array.from(document.querySelectorAll<HTMLElement>("button")).find((el) => el.textContent?.trim() === text);

async function click(el: Element | undefined) {
    expect(el).toBeTruthy();
    await act(async () => {
        el!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
}

async function setValue(el: HTMLInputElement | HTMLSelectElement, value: string) {
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    await act(async () => {
        Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
        el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
    });
}

const puts = () => fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT").map(([, init]) => JSON.parse(init.body));

describe("Product funnel automations", () => {
    beforeEach(() => {
        vi.clearAllMocks();
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

    it("saves the setup switched off, and shows failed deliveries", async () => {
        fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => (init?.method === "PUT" ? json(200, { automation: {} }) : json(200, data())));
        await render();
        expect(container.textContent).toContain("Funnel automations: Off");
        expect(container.textContent).toContain("The delivery mailbox isn't connected.");

        await click(byText("Edit"));
        await setValue(document.getElementById("delivery-url-prod-1") as HTMLInputElement, " https://school.example/c ");
        await setValue(document.getElementById("delivery-mailbox-prod-1") as HTMLSelectElement, "mb-1");
        await setValue(document.getElementById("abandon-seq-prod-1") as HTMLSelectElement, "seq-1");
        await setValue(document.getElementById("abandon-hours-prod-1") as HTMLInputElement, "6");
        expect((document.querySelector('option[value="seq-2"]') as HTMLOptionElement).disabled).toBe(true);
        await click(byText("Save"));

        expect(fetchMock).toHaveBeenCalledWith(URL, expect.objectContaining({ method: "PUT" }));
        expect(puts()).toEqual([{ deliveryUrl: "https://school.example/c", deliveryMailboxId: "mb-1", cartAbandonSequenceId: "seq-1", cartAbandonHours: 6, postPurchaseSequenceId: null }]);
        expect(toast.success).toHaveBeenCalledWith("Saved. Switch it on when you're ready.");
    });

    it("switches on, and shows the server's reason when it can't", async () => {
        fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
            init?.method === "PUT" ? json(400, { error: "Add a delivery link or a cart-abandon sequence before switching on." }) : json(200, data()),
        );
        await render();
        await click(byText("Switch on"));
        expect(puts()).toEqual([{ active: true }]);
        expect(toast.error).toHaveBeenCalledWith("Add a delivery link or a cart-abandon sequence before switching on.");
    });
});
