// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LeadCustomFieldsPanel from "./LeadCustomFieldsPanel";

const PROPS = [
    { id: "p1", key: "budget", label: "Budget", type: "number", options: null },
    { id: "p2", key: "plan", label: "Plan", type: "choice", options: ["starter", "pro"] },
    { id: "p3", key: "notes", label: "Notes", type: "text", options: null },
];

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("LeadCustomFieldsPanel", () => {
    let container: HTMLDivElement;
    let root: Root;
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
            if (init?.method === "PATCH") return jsonResponse({ customFields: {} });
            return jsonResponse({ properties: PROPS });
        });
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        vi.unstubAllGlobals();
    });

    async function flush() {
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
    }

    function field(name: string) {
        return container.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLSelectElement;
    }

    function setValue(el: HTMLInputElement | HTMLSelectElement, value: string) {
        const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
        el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
    }

    it("shows each property with the value already saved on the lead", async () => {
        await act(async () => {
            root.render(<LeadCustomFieldsPanel leadId="lead-1" customFields={{ budget: 300, plan: "pro" }} />);
        });
        await flush();

        expect(fetchMock).toHaveBeenCalledWith("/api/proxy/settings/custom-properties", expect.anything());
        expect(field("budget").value).toBe("300");
        expect(field("plan").value).toBe("pro");
        expect(field("notes").value).toBe("");
    });

    it("saves only the changed keys, and sends null for a cleared value", async () => {
        await act(async () => {
            root.render(<LeadCustomFieldsPanel leadId="lead-1" customFields={{ budget: 300, plan: "pro" }} />);
        });
        await flush();

        await act(async () => {
            setValue(field("budget"), "");
            setValue(field("notes"), "call after 5pm");
        });
        await act(async () => {
            container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        });
        await flush();

        const patch = fetchMock.mock.calls.find((call) => (call[1] as RequestInit | undefined)?.method === "PATCH");
        expect(patch![0]).toBe("/api/proxy/leads/lead-1/custom-fields");
        expect(JSON.parse((patch![1] as RequestInit).body as string)).toEqual({ budget: null, notes: "call after 5pm" });
    });
});
