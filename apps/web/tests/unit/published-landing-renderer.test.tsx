// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PublishedLandingRenderer from "@/components/landing-agent/PublishedLandingRenderer";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;
const fetchMock = vi.fn();

async function render(whatsappOptIn: string | null) {
    await act(async () => {
        root.render(<PublishedLandingRenderer slug="guide" version={1} renderedJson={{ html: "<p>Hi</p>", css: "" }} whatsappOptIn={whatsappOptIn} />);
    });
}

async function submit() {
    await act(async () => {
        container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    const call = fetchMock.mock.calls.find((c) => String(c[0]).endsWith("/guide/lead"))!;
    return JSON.parse(call[1].body);
}

describe("PublishedLandingRenderer WhatsApp opt-in", () => {
    beforeEach(() => {
        fetchMock.mockReset();
        // A failed submit keeps the test on the page (no navigation to the thank-you page).
        fetchMock.mockResolvedValue(new Response("{}", { status: 400 }));
        global.fetch = fetchMock as any;
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
    });

    it("shows the API's opt-in text unticked, and sends true only when ticked", async () => {
        await render("Yes, Asha's Kitchen can message me on WhatsApp at the phone number above.");
        const box = container.querySelector<HTMLInputElement>('input[name="whatsappConsent"]')!;
        expect(box.checked).toBe(false);
        expect(box.closest("label")!.textContent).toBe("Yes, Asha's Kitchen can message me on WhatsApp at the phone number above.");

        expect((await submit()).whatsappConsent).toBeUndefined();

        fetchMock.mockClear();
        await act(async () => box.click());
        expect((await submit()).whatsappConsent).toBe(true);
    });

    it("has no checkbox on other pages", async () => {
        await render(null);
        expect(container.querySelector('input[name="whatsappConsent"]')).toBeNull();
    });
});
