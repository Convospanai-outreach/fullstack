// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DmFlowEditor, type DraftStep } from "@/components/content/DmFlowEditor";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const PROPERTIES = [
    { key: "budget", label: "Budget" },
    { key: "city", label: "City" },
];

let seen: DraftStep[] = [];
function Harness({ initial }: { initial: DraftStep[] }) {
    const [steps, setSteps] = useState<DraftStep[]>(initial);
    seen = steps;
    return <DmFlowEditor steps={steps} onChange={setSteps} properties={PROPERTIES} />;
}

let root: Root;
let container: HTMLDivElement;
let renders = 0;

async function render(initial: DraftStep[] = []) {
    renders += 1;
    await act(async () => {
        root.render(<Harness key={renders} initial={initial} />);
    });
}

const button = (label: string) =>
    Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
        (b) => b.textContent?.trim() === label || b.getAttribute("aria-label") === label
    );

async function click(el: HTMLElement | undefined) {
    expect(el).toBeTruthy();
    await act(async () => {
        el!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
}

async function type(el: HTMLTextAreaElement | HTMLInputElement | HTMLSelectElement, value: string) {
    const proto =
        el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    await act(async () => {
        Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
        el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
    });
}

const alerts = () => Array.from(container.querySelectorAll('[role="alert"]')).map((el) => el.textContent?.trim());

describe("DmFlowEditor", () => {
    beforeEach(() => {
        seen = [];
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
    });

    it("adds message and question steps in order", async () => {
        await render();
        await click(button("Add message"));
        await click(button("Add question"));
        expect(seen.map((s) => s.type)).toEqual(["message", "question"]);
    });

    it("removes a step and moves a step up and down", async () => {
        await render([
            { type: "message", text: "One", property: "" },
            { type: "message", text: "Two", property: "" },
            { type: "message", text: "Three", property: "" },
        ]);
        await click(button("Move step 3 up"));
        expect(seen.map((s) => s.text)).toEqual(["One", "Three", "Two"]);
        await click(button("Move step 1 down"));
        expect(seen.map((s) => s.text)).toEqual(["Three", "One", "Two"]);
        await click(button("Remove step 2"));
        expect(seen.map((s) => s.text)).toEqual(["Three", "Two"]);
    });

    it("keeps end as the last step: added steps go before it, it is not offered twice, and it cannot move", async () => {
        await render([{ type: "message", text: "Hi", property: "" }]);
        await click(button("Add end"));
        expect(button("Add end")).toBeFalsy();
        await click(button("Add message"));
        expect(seen.map((s) => s.type)).toEqual(["message", "message", "end"]);
        expect((button("Move step 2 down") as HTMLButtonElement).disabled).toBe(true);
    });

    it("stops adding at twelve steps", async () => {
        await render(Array.from({ length: 12 }, (_, i) => ({ type: "message" as const, text: `m${i}`, property: "" })));
        expect((button("Add message") as HTMLButtonElement).disabled).toBe(true);
        expect((button("Add question") as HTMLButtonElement).disabled).toBe(true);
    });

    it("offers only the team's properties for a question, and saves the chosen key", async () => {
        await render([{ type: "question", text: "What is your budget?", property: "" }]);
        const select = container.querySelector("select") as HTMLSelectElement;
        expect(Array.from(select.options).map((o) => o.value)).toEqual(["", "budget", "city"]);
        await type(select, "budget");
        expect(seen[0]).toMatchObject({ type: "question", property: "budget" });
    });

    it("shows the first problem in the same words the API uses", async () => {
        await render([{ type: "message", text: "  ", property: "" }]);
        expect(alerts()).toEqual(["Step 1 needs text."]);

        await render([{ type: "question", text: "Budget?", property: "" }]);
        expect(alerts()).toEqual(["Step 1 needs a property key (lowercase letters, digits and underscores)."]);
    });

    it("says a link step sends the landing page chosen above", async () => {
        await render([{ type: "link", text: "Here is the guide", property: "" }]);
        expect(container.textContent).toContain("Sends the landing page you pick above");
    });
});
