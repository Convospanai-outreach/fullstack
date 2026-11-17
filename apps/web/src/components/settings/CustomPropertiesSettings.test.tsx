// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CustomPropertiesSettings, { parseChoiceOptions } from "./CustomPropertiesSettings";

const PROPS = [
    { id: "p1", key: "budget", label: "Budget", type: "number", options: null },
    { id: "p2", key: "plan", label: "Plan", type: "choice", options: ["starter", "pro"] },
];

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("parseChoiceOptions", () => {
    it("splits on commas and new lines, trims, and drops empty entries", () => {
        expect(parseChoiceOptions(" starter, pro\n\nteam , ")).toEqual(["starter", "pro", "team"]);
    });
});

describe("CustomPropertiesSettings", () => {
    let container: HTMLDivElement;
    let root: Root;
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
            if (init?.method === "POST") return jsonResponse({ id: "p3", key: "city" }, 201);
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

    it("lists the team's properties with their types", async () => {
        await act(async () => {
            root.render(<CustomPropertiesSettings />);
        });
        await flush();

        expect(fetchMock).toHaveBeenCalledWith("/api/proxy/settings/custom-properties", expect.anything());
        expect(container.textContent).toContain("Budget");
        expect(container.textContent).toContain("Plan");
    });

    it("creates a property with the chosen type and its options", async () => {
        await act(async () => {
            root.render(<CustomPropertiesSettings />);
        });
        await flush();

        const form = container.querySelector("form#custom-property-form") as HTMLFormElement;
        const setValue = (name: string, value: string) => {
            const el = form.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
            const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
            Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
            el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
        };
        await act(async () => {
            setValue("key", "city");
            setValue("label", "City");
            setValue("type", "choice");
        });
        await act(async () => {
            setValue("options", "Pune, Delhi");
        });
        await act(async () => {
            form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        });
        await flush();

        const post = fetchMock.mock.calls.find((call) => (call[1] as RequestInit | undefined)?.method === "POST");
        expect(post).toBeDefined();
        expect(JSON.parse((post![1] as RequestInit).body as string)).toEqual({ key: "city", label: "City", type: "choice", options: ["Pune", "Delhi"] });
    });
});
